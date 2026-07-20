---
type: task
title: "Space deletion: instant/offline UX via action queue + tombstone-driven multi-device cleanup (kills ghost spaces)"
status: open — design agreed, implement on a SEPARATE branch (not fix-multidevice-signing-key)
priority: high
created: 2026-07-19
severity: data-integrity + UX (blocking-leave, no offline; garbage accumulation compounds #108)
spans-repos:
  - quorum-desktop
  - quorum-mobile (mirror — same add-only sync bug, tracked as mobile M2)
related:
  - .agents/bugs/2025-12-09-encryption-state-evals-bloat.md (#108 — 2MB/created-space bloat this compounds)
  - .agents/docs/features/action-queue.md (delete-space is "not yet integrated"; recommended pattern lines 731-753)
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

## Cross-platform
Mobile has the identical add-only bug (M2) and no delete-space queueing. Mirror
the tombstone + reconciliation contract so behaviour matches; `deletedSpaceIds`
is a config/wire addition both apps must agree on — additive, but confirm with
the lead alongside #108. Do NOT change the encryption-state blob shape here.

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

## Non-goals / relation to #108
Does NOT fix the 2MB-per-created-space creation bloat (#108 — separate
blob-contract decision). Even ghost-free, 2+ created spaces approach the ~4MB
upload limit until #108 lands. This task stops accumulation + fixes the leave UX;
#108 fixes per-space size. Implement on a SEPARATE branch, not
`fix-multidevice-signing-key`.

*Last updated: 2026-07-19*
