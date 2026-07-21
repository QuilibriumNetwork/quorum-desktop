---
type: task
title: "Space deletion: instant/offline UX via action queue + tombstone-driven multi-device cleanup (kills ghost spaces)"
status: open — design agreed, implement on a SEPARATE branch (not fix-multidevice-signing-key)
priority: high
created: 2026-07-19
severity: data-integrity + UX (blocking-leave, no offline; garbage accumulation compounds #108)
spans-repos:
  - quorum-desktop (this task — implement here)
  - quorum-mobile (mirror — has BOTH the same add-only receive bug AND a
    mobile-only write-side gap: delete/leave never publish. Tracked separately as
    the mobile bug below; do NOT implement mobile changes from this desktop task.)
related:
  - .agents/bugs/2025-12-09-encryption-state-evals-bloat.md (#108 — 2MB/created-space bloat this compounds)
  - .agents/docs/features/action-queue.md (delete-space is "not yet integrated"; recommended pattern lines 731-753)
  - ../../quorum-mobile/.agents/bugs/2026-07-19-config-sync-add-only-deleted-spaces-linger.md (MOBILE side — shared tombstone/reconciliation contract + mobile-only write-side publish gap; severity high. Any wire/config change here must stay in sync with this.)
  - ../../quorum-mobile/.agents/reports/2026-07-19-signing-key-multidevice-hunt-tracker.md (M2 add-only sync; D7 corrupted-space delete)
---

# Space deletion: instant + offline UX, and stop leaking ghost spaces

## Evidence (live desktop account, 2026-07-19)

- `config.spaceIds` = 4 (UI truth: 2 created + 2 joined); `getSpaces()` = 13 →
  **9 ghost space rows**; `analyzeEncryptionStates()` = 10 bloated ~2MB states
  (8 are ghosts ≈ 16MB local garbage) + 1 `undefined/undefined` corrupt row +
  history-duplicate rows. All invisible in the UI until inspected.

## Three root problems (confirmed in code)

1. **Leave is synchronous/blocking, no offline.** `useSpaceLeaving.leaveSpace`
   does `await deleteSpace()` THEN closes the modal
   (`useSpaceLeaving.ts:50`). `SpaceService.deleteSpace` (`:563`) calls the
   network `postHubDelete` (`:619`) and only cleans local rows afterward
   (`:654-685`). Offline / network failure → throws → modal stays open, nothing
   happens. `delete-space` is NOT integrated with the action queue
   (action-queue.md:126, listed under "Potential Future Actions").
2. **Config-apply is add-only → ghosts.** `ConfigService.getConfig` loops the
   synced config's spaces and only ADDS missing ones (`ConfigService.ts:110`,
   `if (!existingSpace)`). Nothing removes a local space that dropped out of the
   config. So a space deleted on device B is never cleaned off device A (mirrors
   mobile M2). This is the ghost factory.
3. **Ambiguity: "DB space not in config" is overloaded.** The existing "Restore
   Spaces" button (`useSpaceRecovery.ts:47`) treats that exact set as
   "lost → re-add to config"; naive reconciliation would treat it as
   "deleted → purge." They contradict. Resolve with explicit tombstones.

Secondary: D7 corrupted space (missing hub key) hard-throws before cleanup →
untrappable debris. Unbounded `encryption_states` history (`messages.ts:1395`
always appends) → per-conversation row growth.

## Design constraint (from lead) and how it is honored

> "Delete locally only if the deletion actually propagated — otherwise other
> users still see the space and you've lost it locally."

Honored via **pre-seal + durable queue**, not blocking:
- At click, WHILE the space keys exist, build and SEAL the leave: the hub 'leave'
  control envelope + the signed `postHubDelete` payload. These are ciphertext +
  signatures only (no private keys) — safe to store in the queue per its
  security rule.
- Then optimistically wipe local + close modal. Local wipe can no longer strand
  the leave, because the sealed payload is already captured and durable.
- The queue guarantees eventual propagation (retry up to 3 days, offline-safe).
  So propagation is guaranteed-eventual rather than blocked-on. Residual: if the
  queued leave permanently fails, best-effort semantics (left locally, server
  membership may linger) — same contract the doc already accepts, surfaced via
  the offline banner / failed-action state.

This SUPERSEDES the earlier "gate local wipe on network success" idea: the
action-queue integration is the correct mechanism and gives instant + offline
UX without the strand risk.

## Fix — vertical slices (each ends in an observable outcome)

### Slice 1 — Instant, offline-capable leave (action-queue integration)
Outcome: clicking Delete/Leave closes the modal and removes the space from the
sidebar IMMEDIATELY, works offline, and the leave still reaches the hub when
back online.

- Refactor `SpaceService.deleteSpace` into: (a) `buildLeavePayload(spaceId)` —
  seals the leave envelope + `postHubDelete` payload from local keys (returns
  plain data, no private keys); (b) `purgeSpaceLocal(spaceId)` — the local
  cleanup block from `:654-685` (states/keys/members/messages/row), network-free.
- New flow in `leaveSpace`:
  1. `buildLeavePayload` (needs keys — do first).
  2. Optimistic: tombstone id in config `deletedSpaceIds` + remove from
     `spaceIds`/`items` → enqueue `save-user-config`; remove from React Query
     cache (sidebar updates); `purgeSpaceLocal`; navigate away + close modal.
  3. Enqueue `delete-space-notify` with the sealed payload → handler POSTs
     hub-delete + sends the leave envelope, retrying/offline per the queue.
- Follow the `kick-user` handler shape (already queued, similar crypto).

### Slice 2 — Tombstone-driven multi-device reconciliation (kills ghosts safely)
Outcome: a space deleted on one device disappears (with its storage) on the
other device after sync; `getSpaces()` stops diverging from `config.spaceIds`.

- Add `deletedSpaceIds` to the synced config (mirror the existing
  `deletedBookmarkIds` / `deletedUserNoteAddresses` tombstone pattern, including
  the reset-after-successful-sync lifecycle with enough retention for all
  devices to catch up).
- On config apply, after the add-loop, `purgeSpaceLocal` for any local space
  whose id is in `config.deletedSpaceIds`. **Only tombstoned ids — never "absent
  from config."** This defuses the transient/partial-config wipe risk AND the
  Restore-button conflict.
- One-time heal for already-affected users: since existing ghosts predate
  tombstones, provide a guarded manual sweep (or a bounded migration) that uses
  `config.spaceIds` as oracle — but gate hard (valid, non-empty config; the
  `keep.size===0` abort). Keep this conservative; prefer tombstones going forward.

### Slice 3 — Delete always works, even for corrupted spaces (D7)
Outcome: the "Bb"-style corrupted space (missing hub key) can be removed; Delete
never dead-ends with "incomplete configuration."

- When `buildLeavePayload` can't seal (missing hub key), skip the network notify
  and still run the optimistic local purge + tombstone. Surface a quiet note
  ("couldn't notify the server; removed locally"). NOT a separate settings
  button — the same Delete button, graceful fallback.

### Slice 4 — Reconcile the "Restore Spaces" button with tombstones
Outcome: the recovery tool can no longer resurrect a space you deleted.

- `restoreMissingSpaces` must exclude tombstoned ids (`config.deletedSpaceIds`)
  from the "restore" set. Today it re-adds any DB-not-in-config space (it already
  skips >500KB states, so not the 2MB ghosts, but it WOULD resurrect small
  deleted ones). Decide with lead: keep as a narrow sync-loss recovery tool, or
  retire once reconciliation makes sync-loss rare.

### Slice 5 (optional, lower priority) — Bound encryption-state history
Outcome: storage stops growing per conversation. Cap/prune `encryption_states`
history (keep latest N per conversationId). Independent of the above.

## Field-tested addendum (2026-07-21, live desktop — verify mobile too)

Three more delete-space defects observed on desktop. #2 and #3 are small,
independent quick wins that can ship WITHOUT the full action-queue rework (they
also survive it). #1 is a symptom the Slice 1 rewrite structurally resolves;
recorded here so it isn't lost.

### A. "Delete failed" toast, but the space is actually deleted (refresh confirms)
Symptom: deleting a space sometimes shows a failure message, yet after a page
refresh the space is gone — deletion actually succeeded. The error and the
persisted state disagree.

Diagnosis (in code): `SpaceService.deleteSpace` (`:563`) does the network work in
two independent steps before the local wipe:
1. `enqueueOutbound(async () => [message])` (`:618`) — sends the hub 'leave'
   envelope **fire-and-forget** (`enqueueOutbound` returns `void`, is not awaited
   and not inside the caller's try/catch).
2. `await postHubDelete(...)` (`:619`) — the actual hub delete.
3. Local wipe + config save + `messageDB.deleteSpace` (`:654-685`).

For the space to be gone on refresh, step 3 (`messageDB.deleteSpace`, `:685`) MUST
have run — i.e. `deleteSpace` reached completion. So the failure the user sees is
NOT `postHubDelete` throwing (that would abort before step 3 and leave the DB row,
which `getSpaces()` would still show on refresh). Two candidate sources, to
confirm by repro with the console open:
- **Most likely:** the fire-and-forget leave-envelope send (step 1) fails
  asynchronously and surfaces a global error toast, while hub-delete + local wipe
  both succeed. Matches "sometimes fails" (flaky outbound) + "actually deleted".
- Or a throw AFTER `deleteSpace` returns — in `navigate(...)` / `onSuccess` /
  `onClose` — caught by the hook's catch and shown as a generic failure.

Fix: Slice 1's pre-seal + optimistic-wipe + durable `delete-space-notify` queue
makes deletion no longer depend on (and never contradict) the notify result —
success/failure of propagation is a queue state (offline banner / failed-action),
not a modal error over an already-completed delete. If a pre-Slice-1 stopgap is
wanted, stop surfacing the fire-and-forget send failure as a hard "delete failed"
toast. Belongs to **Slice 1** (and Slice 3 for the corrupted-space path).

### B. After delete, redirect goes to Contacts, not the Spaces list
Symptom: deleting a space drops you on the DM/contacts list instead of the spaces
page.

Diagnosis: both delete call sites navigate to a contacts destination.
`useSpaceManagement.handleDeleteSpace` does `navigate('/')`
(`useSpaceManagement.ts:146`), and `/` redirects to `/messages` = `DirectMessages`
(contacts) (`Router.web.tsx:107-114`, `:115-128`). `useSpaceLeaving.leaveSpace`
does `navigate('/messages')` directly (`useSpaceLeaving.ts:51`). The spaces list
lives at `/spaces` (`DiscoverPage mode="spaces-empty"`, `Router.web.tsx:143-158`).

Fix: navigate both delete paths to `/spaces` instead. Two one-line changes
(`useSpaceManagement.ts:146`, `useSpaceLeaving.ts:51`). Independent quick win.

### C. Deleted space lingers in the sidebar/spaces list until refresh
Symptom: even on an immediately-successful delete, the just-deleted space still
appears in the spaces list; only a page refresh clears it.

Diagnosis: the sidebar (`SpacesSidebar.tsx:80`) and spaces list read from
`useSpaces` → query key `['Spaces']` (`buildSpacesKey`), backed by
`messageDB.getSpaces()`. `deleteSpace` invalidates/updates only the **config**
query cache (`buildConfigKey`, `SpaceService.ts:681`) and `messageDB.deleteSpace`
the DB row — but never invalidates the `['Spaces']` query, so React Query serves
the stale cached list until a hard reload. A `useInvalidateSpaces` hook already
exists (`hooks/queries/spaces/useInvalidateSpaces.ts`) and is not called here.

Fix: after the local wipe, invalidate `['Spaces']`. `deleteSpace` already receives
`queryClient`, so add
`queryClient.invalidateQueries({ queryKey: buildSpacesKey({}) })` alongside the
existing config-cache update (`:681`), or have the hook call `useInvalidateSpaces`
after `deleteSpace` resolves. This is also the correct sidebar-update mechanism
for Slice 1's optimistic path. Independent quick win.

## Cross-platform — READ BEFORE TOUCHING THE CONFIG/WIRE SHAPE
Mobile is affected too, but **mobile work is tracked separately and is OUT OF
SCOPE for this desktop task.** Do not edit the mobile repo from here. Mobile has:
- the identical add-only *receive* reconciliation bug (M2), AND
- a mobile-only *write-side* gap: `useDeleteSpace`/`useLeaveSpace` never publish
  the deletion (no `saveConfig` write-back, no hub leave) — see the mobile bug.

Both are captured in
`../../quorum-mobile/.agents/bugs/2026-07-19-config-sync-add-only-deleted-spaces-linger.md`
(severity high; write-side section + fix steps added 2026-07-21). When mobile is
scheduled, it becomes its own task/branch that mirrors this contract.

**Shared-contract obligation (the reason this matters to the desktop implementer):**
`deletedSpaceIds` is a `UserConfig`/wire addition both apps must agree on. It is
**additive**, but:
- Keep it strictly additive + optional-typed so it can't break the mobile client
  that hasn't shipped its side yet (see the "don't break mobile on shared changes"
  rule). If the type lives in `quorum-shared`, coordinate that change there.
- Match the reset-after-successful-sync lifecycle and retention window to whatever
  mobile will implement, so tombstones aren't dropped before the other device
  catches up.
- Confirm the field with the lead alongside #108 before shipping.

Do NOT change the encryption-state blob shape here.

Addendum defects (A/B/C) checked against mobile 2026-07-21 — mobile does NOT
share them in the same form (delete/leave live in `hooks/chat/useSpaceSettings.ts`
`useDeleteSpace`/`useLeaveSpace`, triggered from `components/SpaceSettingsModal.tsx`):
- **A (fail toast vs. actually-deleted): not present.** Mobile delete/leave are
  **local-only** (no `postHubDelete`, no leave envelope — leave is a stub with a
  `TODO: Send leave message`). No fire-and-forget network send that can fail while
  the local delete succeeds, so no toast/state mismatch. Mobile's real gap here is
  the deeper one: leave/delete never propagate at all — confirmed 2026-07-21 that
  `useDeleteSpace`/`useLeaveSpace` only wipe local MMKV, with NO `saveConfig`
  write-back and NO hub leave (whereas mobile create/join DO `saveConfig`,
  `spaceService.ts:404-407`). Tracked + diagnosed in mobile bug
  `2026-07-19-config-sync-add-only-deleted-spaces-linger.md` (write-side section
  added same day; severity raised to high).
- **B (redirect to contacts): not present in that form.** Mobile navigates via
  `router.back(); router.back()` (pop within the spaces tab stack —
  `app/(tabs)/spaces/[id]/index.tsx:171`, `[channelId].tsx:372`), not a hardcoded
  contacts route. Worth a visual confirm, but no wrong-destination bug in code.
- **C (stale spaces list): already correct on mobile — mirror it on desktop.**
  Both mobile mutations do `onSuccess: invalidateQueries(['spaces'])`
  (`useSpaceSettings.ts:124-126,153-155`). Desktop is the one missing this.

## Test plan
1. Online leave: modal closes + sidebar updates instantly; hub-delete fires;
   local rows fully purged.
2. Offline leave: modal closes + space vanishes instantly; `delete-space-notify`
   sits in the queue; on reconnect it POSTs; other device then reconciles.
3. Multi-device: delete on A → B purges local rows + state after sync;
   `getSpaces()` on B matches `config.spaceIds`.
4. Reconciliation safety: a failed/empty/partial config fetch removes NOTHING
   (only tombstoned ids are ever purged).
5. Corrupted space (missing hub key): Delete removes it locally without throwing;
   does not reappear.
6. Restore button: a tombstoned (deleted) space is NOT offered for restore; a
   genuinely sync-lost, non-tombstoned space still is.
7. Regression: DM states never touched by reconciliation.
8. Redirect (B): after deleting a space you land on `/spaces` (spaces list), not
   the contacts/DM list — from both the settings-modal delete and the leave flow.
9. Live sidebar (C): a successful delete removes the space from the spaces
   list/sidebar immediately, with no page refresh.
10. Toast/state agreement (A): a delete never shows a "failed" toast while the
    space is actually gone; propagation failures surface as queue/offline state,
    not as an error over a completed delete.

## Non-goals / relation to #108
Does NOT fix the 2MB-per-created-space creation bloat (#108 — separate
blob-contract decision). Even ghost-free, 2+ created spaces approach the ~4MB
upload limit until #108 lands. This task stops accumulation + fixes the leave UX;
#108 fixes per-space size. Implement on a SEPARATE branch, not
`fix-multidevice-signing-key`.

*Last updated: 2026-07-21*
