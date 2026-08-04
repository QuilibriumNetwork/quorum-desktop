---
type: task
title: "DM partner identity never recovers on an established session (desktop discards the profile it decrypts)"
status: in-progress
priority: high
created: 2026-08-01
updated: 2026-08-04
severity: user-visible — a DM partner renders forever as "Unknown User" / truncated address
area: DM receive path / conversation-row identity / mobile parity
repos: quorum-desktop (fix), quorum-mobile (reference implementation — already correct)
related_tasks:
  - ".agents/issues/2026-08-01-dm-unread-dot-stale-previews-snapshot.md"
related_bugs:
  - ".agents/issues/.done/2026-06-13-space-members-missing-no-join-row.md"
  - ".agents/issues/.done/2025-12-18-dm-unknown-user-identity-not-revealed.md"
related_docs:
  - ".agents/docs/features/identity-resolution-and-profile-sync.md"
  - ".agents/docs/debugging/dm-architecture-and-debug-playbook.md"
related_tools:
  - ".agents/tools/dm-debug/05-profile-sources.js"
---

# DM partner identity never recovers on an established session

## §0. The one-paragraph version

Desktop's DM receive path decrypts frames that **contain the sender's display name and
avatar**, reads that field to decide which ratchet-state shape to persist, and then
throws it away. Identity therefore only ever lands during session *setup* (init envelope
or the one-time reply-confirm). Once a DM session is established, the partner can send
any number of messages and none of them refresh identity. If the row was a placeholder at
that moment, and the partner has no public profile to fall back on, the conversation is
stuck showing "Unknown User" / a truncated address permanently. **Mobile does not have
this bug** — it applies the decrypted profile on the ordinary receive path. This is a
parity fix, not a new design.

## §1. Reported symptom (2026-08-01)

A DM between two test accounts, **both on desktop**. Partner B renders with no identity,
and the two surfaces disagree about how to say so:

| Surface | Renders | Why |
|---|---|---|
| DM sidebar list | `Unknown User` + `?` avatar | passes the raw row value through, **from a stale snapshot** (see below) |
| Conversation header | `QmYVto…LjDd` + `Q` initials | demotes the `"Unknown User"` literal, falls through to the address |

> 🔴 **The sidebar has a second, independent staleness source.** Per the sibling task
> `2026-08-01-dm-unread-dot-stale-previews-snapshot.md`, the DM list does not render the
> live conversation rows — it renders a frozen copy held in the `['conversation-previews']`
> query, keyed **only** on `conversationId:lastMessageId`. A profile update changes
> `displayName` / `icon` but **no** `lastMessageId`, so the key never changes and the
> snapshot is served indefinitely while the sidebar stays mounted.
>
> `useConversationsWithProfileBackfill` already invalidates `Conversations/direct` and
> `Conversation` after its write-back — but **not** `['conversation-previews']`. So even
> today, a successful backfill updates the header and leaves the sidebar wrong. The
> `primaryUsername` re-attach hack at `DirectMessageContactsList.tsx:70-78` exists because
> of exactly this, and it patches only that one field.
>
> **Consequence for this task: Slice 1 can land and work, and the sidebar may still look
> broken until remount.** Do not read that as Slice 1 having failed — check the header and
> IndexedDB first.
>
> ✅ **RESOLVED — shipped in PR #312, 2026-08-04.** The previews query no longer caches
> conversation rows at all — it returns `{ preview, previewIcon }` only, merged onto the live polled
> rows at render time. `displayName`, `icon` and `primaryUsername` therefore come from the
> live data on every render, and the re-attach hack is gone. **This whole callout no
> longer applies: the sidebar is a trustworthy test surface again**, so it is no longer
> necessary to fall back to the header and IndexedDB.

Operator notes, taken as given (not independently verified here):

- **B has no published public profile.** This removes the last automatic recovery path
  (`useConversationsWithProfileBackfill`), which is why the row never self-heals.
- **It used to render correctly, then stopped.** Consistent with §4's history finding:
  the working period was a fresh session where identity landed at init/confirm, and
  something later reset the session or the row. These are heavily reused test accounts.
- B sending more messages does not fix it. That is the core bug, not a symptom of the
  test data.

## §2. Root cause (confirmed in code)

`DoubleRatchetInboxDecrypt` returns a union. The second variant carries `user_profile`:

```ts
// node_modules/@quilibrium/quilibrium-js-sdk-channels/dist/index.d.ts:778
declare const DoubleRatchetInboxDecrypt: (…) =>
  | { ratchet_state: string; message: string }
  | { receiving_inbox; user_profile: UserProfile; tag; sending_inbox; ratchet_state; message };
```

The sender populates it on every send — `ActionQueueHandlers.ts:735-741` passes
`senderDisplayName` / `senderUserIcon` into `DoubleRatchetInboxEncrypt` (this was the
2025-12-18 fix, still in place).

The receiver reads it at `MessageService.ts:4108` purely as a shape discriminator:

```ts
if (maybeInit.user_profile) {
  advancedState = JSON.stringify({ ratchet_state: keep(maybeInit.ratchet_state), … });
} else { … }
```

…and then discards it 50 lines later at `MessageService.ts:4155-4160`:

```ts
return {
  outcome: 'ok' as const,
  content,
  sentAccept: fresh.sentAccept,
  updatedUserProfile: undefined,   // ← the bug
};
```

### The four ways identity can reach a DM row, and why all four are dead here

| # | Path | Code | Fires when | Dead because |
|---|---|---|---|---|
| 1 | init envelope | `MessageService.ts:3679-3683` | first frame of a NEW session | session is established |
| 2 | `ConfirmDoubleRatchetSenderSession` | `MessageService.ts:4037-4039` | one-time reply-confirm | already consumed |
| 3 | `dm-update-profile` control msg | `MessageService.ts:690`, `:740` | partner *edits* their profile | B hasn't edited |
| 4 | public-profile pull + write-back | `useConversationsWithProfileBackfill.ts` | partner opted into a public profile | B has none |

Path 5 — "learn it from the messages they're already sending you" — is the one that
should always work, and it is the one desktop discards.

### The storage layer is fine

The fix the operator remembered **did ship**, in two of its three pieces:

| Piece | Where | Status |
|---|---|---|
| Persist partner identity to IndexedDB | `MessageDB.tsx:365-380` | ✅ shipped 2025-12-18 |
| Update it only when they push a change | `MessageService.ts:740-762` | ✅ shipped |
| **Capture it from incoming messages** | `MessageService.ts:4159` | ❌ init/confirm only |

`addOrUpdateConversation` merges with `??`, so it cannot blank a good value. Feed it and
it works. It is simply never fed on an established session.

## §3. Mobile is already correct — this is a parity fix

`quorum-mobile/context/WebSocketContext.tsx:4739-4741`:

```ts
const rowProfile = isSelfSyncEcho ? undefined : msgResult.user_profile;
const senderDisplayName = rowProfile?.display_name || existingConversation?.displayName || resolvedSenderAddress.substring(0, 8);
const senderIcon       = rowProfile?.user_icon    || existingConversation?.icon        || '';
```

Note the `isSelfSyncEcho` guard: on a multi-device self-echo the `user_profile` is
*ours*, not the partner's, and must not be written to the partner's row. Desktop's
existing init and confirm branches already apply the equivalent guard
(`… .user_address != self_address`), so the same shape is available at the fix site
(`self_address` is a parameter of the enclosing `handleNewMessage`, declared at
`MessageService.ts:3417`).

## §4. History — this is NOT a #236 regression

Checked `54759a208^` (the commit before *"fix: serialize DM Double Ratchet state
operations per conversation (#236)"*). The pre-#236 `DoubleRatchetInboxDecrypt` branch
also never assigned `updatedUserProfile`; it used `maybeInit.user_profile` only as a
shape discriminator, exactly as today. #236 made an existing implicit gap explicit by
writing `undefined` where the variable had previously just been left unassigned.

**The gap is long-standing.** Do not go looking for a regression window.

## §5. Relationship to the spaces bug — same disease, different organ

`.agents/issues/.done/2026-06-13-space-members-missing-no-join-row.md` describes the same
structural failure on the space side: identity rides only on control messages (`join` /
`update-profile`), ordinary message traffic never writes it, and desktop's control
messages are fire-and-forget with no durable replay (mobile has hub-log catch-up).

**The two fixes are not the same, and the spaces doc's reasoning must not be copied
here.** That doc explicitly rejected "recover identity from message traffic" for three
reasons. All three fail for DMs:

| Spaces rejection | Why it does not apply to DMs |
|---|---|
| *"mobile doesn't do it → desktop-only divergence"* | **False for DMs.** Mobile does exactly this (§3). Desktop is the one diverging. |
| *"writes canonical shared protocol state from a derived source"* | The `conversations` row is **local render state**, not `space_members`. The repo already write-throughs to it (`MessageDB.tsx:369`, `useConversationsWithProfileBackfill.ts:183`). |
| *"a `post` carries no name/avatar, so the win is marginal"* | **False for DMs.** The decrypted frame carries `user_profile` directly, authenticated, from the sender. |

So: **fix the DM side now** (cheap, parity-restoring, low blast radius). The spaces side
still needs the hub-log architecture decision (port-from-mobile candidate #32, lead-dev
call). Do not bundle them.

## §5b. Does this heal conversations that are ALREADY broken? (and do we need a "fix" button?)

Short answer: **Slice 3 is the heal mechanism, Slice 1 is best-effort, and a repair button
cannot work here.**

| Mechanism | Heals existing rows? | Requires |
|---|---|---|
| Slice 1 (capture from frames) | **Best-effort.** Heals the moment B sends a frame that carries `user_profile`. Since that is the union's second variant and not necessarily every frame, timing is not guaranteed. | A's client updated; B sends something |
| Slice 3 (re-broadcast on reconnect) | **Yes, deterministically.** On B's next connect, B pushes `dm-update-profile` to every DM partner; A's `handleDMProfileUpdate` writes it to the row. No user action on either side. | **Both** clients updated (both users are on desktop here) |
| A "repair identities" button | **No.** See below. | — |

### Why a button cannot fix this, unlike the missing-Spaces button

The missing-Spaces button works because the data is **already on the device** — it
re-derives the list from the synced `UserConfig` blob. Here there is nothing to re-derive:
A has no local copy of B's name or avatar, by definition. The identity can only come from

1. a frame B sends that carries `user_profile` (Slice 1),
2. a `dm-update-profile` B pushes (Slice 3), or
3. B's public profile — **which B does not have** (§1).

A button on A's side could at most force a public-profile refetch and invalidate the
caches. For a partner with no public profile that is a no-op. It would produce a "Fix"
button that visibly does nothing, which is worse than no button.

**Recommendation:** implement Slice 3 and treat it as the migration path for existing
broken conversations. Do not build a repair button for this.

### The one repair action that *would* be legitimate

Clearing the poisoned `"Unknown User"` / `/unknown.png` literals off existing rows (Slice
4 writes them today) so they fall back cleanly to the address render instead of asserting
a name the app does not have. That is cosmetic cleanup, not identity recovery, and it
belongs with Slice 4 as a one-shot migration rather than a user-facing button.

## §5c. The 24h retry interval is a placeholder — ✅ DECIDED

> ✅ **2026-08-01: researched and decided in
> `.agents/issues/.done/2026-08-01-identity-announce-cadence-research.md`.**
>
> **Keep the 24h interval, cap it at 3 retries** per (partner, identity-version),
> then stop until the identity changes. ~99% cheaper, same convergence, ~5 lines.
> The retry is a transitional safety net — with reliable delivery one send is
> enough. ⚠️ The migration is what bites: stamp legacy records with
> `at = Date.now()`, **not** the stored value, or the whole fleet fires on the
> first connect after deploy.
>
> **Also relevant to this file: Slice 4 below is promoted, not deferred.** The
> `db.saveMessage` re-stamp is the mechanism that un-converges an already-fixed
> row, and it is the reason the retries can safely be capped. It is Slice 2 of
> that task.
>
> The prose below is the original framing; its cost figures omit the per-device
> fan-out multiplier (a DM send emits one frame **per destination inbox**, ~9 on
> aged accounts).

`RESEND_INTERVAL_MS` in `src/utils/dmProfileGate.ts` is **24h, chosen to bound
an anti-loss retry, not researched.** It pays a cost on EVERY pair to fix a
failure that occurs on a small fraction of pairs, so it scales with the
population rather than with the problem. Rough order: 10k users × 20 partners ×
~30 KB ≈ 6 GB/day.

Do not treat that constant as settled, and do not copy it into the space
implementation. Better shapes (receiver-driven request, fingerprint-first,
backoff, piggyback) are laid out in
`.agents/issues/.done/2026-08-01-identity-announce-cadence-research.md`.

## §6. Work — vertical slices

### §6.0 Branching and sequencing

**This task and `2026-08-01-dm-unread-dot-stale-previews-snapshot.md` are separate
branches and separate PRs. Do not merge them into one.** They are different bugs that
happen to surface on the same screen: this one is "the data never arrives" (DM receive
path, protocol-adjacent); that one is "the data arrives but the render layer serves a
stale copy" (React Query cache shape). Combining them would put Double Ratchet receive
code and a cache refactor in a single unreviewable diff, in the area with this repo's
worst regression history.

**One-way dependency: land the previews task FIRST.**

1. It removes the cause that Slice 2's `['conversation-previews']` invalidation item only
   works around. Doing this task first means adding an invalidation the other task then
   deletes, in the same lines — a guaranteed conflict.
2. It gives a trustworthy test surface. While the snapshot is stale the sidebar lies, so
   "did B's avatar appear?" is not answerable there. Verify via the conversation header
   and IndexedDB until it lands.

Recommended order, one PR per step:

| # | Step | Observable outcome |
|---|---|---|
| 1 | previews snapshot task — ✅ shipped in PR #312, 2026-08-04 | sidebar renders live conversation rows |
| 2 | **Slice 1** (this task) | B sends one message → name + avatar land and survive reload |
| 3 | **Slice 3** (this task) | already-broken conversations heal on next reconnect |
| 4 | **Slices 2 + 4** (this task) | consistent empty-state render; no placeholder stamping |

Slice 1 ships alone before Slice 3: it is ~6 lines and immediately testable, whereas
Slice 3 needs a cooldown design and the mobile-parity question in its own checklist
answered first.

### Slice 1 — Partner identity lands from ordinary messages *(the fix)*

**User-visible outcome:** open the stuck DM, have B send **one** message from their
desktop. B's real name and avatar appear in the conversation header, the message list,
and the sidebar — and are still there after a full reload.

`MessageService.ts:4155-4160`:

```ts
return {
  outcome: 'ok' as const,
  content,
  sentAccept: fresh.sentAccept,
  updatedUserProfile:
    maybeInit.user_profile && maybeInit.user_profile.user_address !== self_address
      ? maybeInit.user_profile
      : undefined,
};
```

Nothing downstream needs to change: the caller at `:4186` already assigns
`updatedUserProfile = dm.updatedUserProfile`, and `:5643` / `:5690` already prefer it
over the stored row before calling `saveMessage` + `addOrUpdateConversation`, which
persists to IndexedDB.

- [ ] Apply the change with the self-address guard
- [ ] Verify it does not fire on a multi-device self-echo (§3's `isSelfSyncEcho` case)
- [ ] `npx tsc --noEmit --jsx react-jsx --skipLibCheck` clean
- [ ] Behavioural test per the outcome above, desktop ↔ desktop

> ⚠️ **Scope caveat, verify during implementation:** `user_profile` is present only on the
> union's second variant, not necessarily on *every* frame. So this improves recovery from
> "never" to "whenever the ratchet re-emits sender info" — which may still not be every
> message. **Measure how often it actually fires** before closing this task; if it turns
> out to be rare, Slice 3 becomes the load-bearing fix rather than a nice-to-have.

### Slice 2 — One consistent "no identity yet" render

**User-visible outcome:** the sidebar and the conversation header say the same thing about
an unidentified contact. No more `Unknown User` + `?` in the list sitting next to
`QmYVto…LjDd` + `Q` in the header.

Today only `DirectMessage.tsx:266-276` demotes the `"Unknown User"` literal and the
default icon before rendering. The sidebar surfaces pass the raw row value straight
through:

- `DirectMessageContact.tsx:93` (expanded row)
- `DirectMessageContactsList.tsx:381` (collapsed strip)

- [ ] Extract the demotion (`localName && localName !== 'Unknown User' ? … : undefined`,
      same for the default icon) into one shared helper
- [ ] Use it on all three surfaces
- [ ] Decide the single canonical empty-state render — recommend the header's
      (truncated address + address-derived initials), since it matches mobile and does
      not assert a name the app does not have
- [x] ~~**Bust the previews snapshot on identity change.** Add
      `['conversation-previews']` to the invalidations in
      `useConversationsWithProfileBackfill.ts:184-191` and in `handleDMProfileUpdate`
      (`MessageService.ts:758-761`).~~ **Not needed — do not implement.** The check this
      item asked for has been made: `2026-08-01-dm-unread-dot-stale-previews-snapshot.md`
      landed its Slice 1 first (PR #312, 2026-08-04), removing the cause instead of
      adding a third invalidation. The previews cache no longer holds `displayName` / `icon` /
      `primaryUsername`, so there is nothing left to bust. Adding the invalidation now
      would re-read N messages from IndexedDB on every profile update for no effect.

### Slice 3 — Heal already-broken rows without requiring a profile edit

**User-visible outcome:** conversations that are *already* stuck recover on the next
reconnect, without either user opening settings and re-saving their profile.

`broadcastProfileToAllDMs` (`MessageService.ts:535`) has exactly one caller —
`MessageDB.tsx:492`, in the profile-save flow. There is no on-reconnect re-broadcast.
This mirrors the space-side gap where mobile re-broadcasts `update-profile` on every
connect and desktop does neither.

- [ ] Fire `broadcastProfileToAllDMs` on WS (re)connect, debounced/cooldowned so a flappy
      connection cannot spam every DM partner
- [ ] Confirm it is safe when no session is established yet (the method already logs and
      skips per-partner failures)
- [ ] **Open question:** does mobile re-broadcast the DM profile on connect, or only the
      space `update-profile`? Verify before implementing, so desktop does not diverge in
      the other direction.

### Slice 4 — Stop writing the placeholder into the row on send *(DEFERRED — spec was wrong)*

> 🔴 **2026-08-01: this slice's spec below is WRONG and it was NOT implemented.**
> `addOrUpdateConversation` is not the stamper. `db.saveMessage`
> (`src/db/messages.ts:1360-1370`) **unconditionally** `put`s `icon` and
> `displayName` onto the conversation row for EVERY message saved — DMs and
> spaces alike — from the profile its caller passes. On the send path
> (`MessageService.ts:3455`) that caller passes
> `conversation?.conversation?.displayName ?? 'Unknown User'`.
>
> Consequences:
> 1. Changing only the `addOrUpdateConversation` call (what the spec below says)
>    is a literal **no-op** — `saveMessage` already stamped 14 lines earlier.
> 2. The real fix has to make the DB layer preserve the stored value when the
>    caller supplies an empty one — the same EMPTY MEANS ABSENT rule as
>    `utils/conversationProfile.ts`, applied at the last place that violates it.
>    That is a **shared write path used by spaces too**, so it needs its own
>    branch, its own review, and space-side regression testing. It was
>    deliberately kept out of the identity PR, which was already verified
>    working end to end.
> 3. **Latent race worth knowing about**: because the send path reads the
>    conversation row once at the top of the send and `saveMessage` then
>    re-stamps from that read, a `dm-update-profile` landing mid-send can be
>    reverted to the placeholder. Narrow (the steady state re-stamps the same
>    real value once the row has one) but real.
>
> Next step: split into its own task against `db.saveMessage`, covering both DM
> and space callers.

<details>
<summary>Original (incorrect) spec, kept for the record</summary>

**User-visible outcome:** no behavioural change expected; this is hygiene. A row with no
known identity stays *empty* rather than being stamped `"Unknown User"` / `/unknown.png`.

`MessageService.ts:3390-3400` — every outgoing message calls `addOrUpdateConversation`
with `conversation?.conversation?.displayName ?? 'Unknown User'` and
`?? DefaultImages.UNKNOWN_USER`. Because `??` only fires on nullish, this cannot clobber
a real name. It does convert "no identity yet" into "explicitly placeholder", which makes
the row harder to reason about and is the reason the sidebar has a literal string to
render in the first place.

- [ ] Pass `undefined` instead of the placeholders, and let the render layer decide
- [ ] Confirm `addOrUpdateConversation`'s `if (display_name || user_icon)` guard then
      correctly skips the write

</details>

## §7. How to verify / diagnose

Run as **user A**, DevTools console:

1. `.agents/tools/dm-debug/05-profile-sources.js` — per DM, the stored row's name/icon
   side by side with the public-profile API. Columns that matter: `storedName`,
   `storedIconIsDefault`, `pubHasImage`, `sidebarCanRecoverAvatar`.
2. Before the fix: the affected row shows a placeholder name/icon and
   `sidebarCanRecoverAvatar: "NO source"` (B has no public profile).
3. After Slice 1: have B send one message, re-run — the stored row should now carry B's
   real `display_name` and a non-default icon.

Reload the app between steps. The whole point is that the value **persists**, not that it
renders once from an in-memory fallback.

## §8. Files of interest

| Concern | File |
|---|---|
| The discard (fix site) | `src/services/MessageService.ts:4155-4160` |
| Shape discriminator that proves the data is there | `src/services/MessageService.ts:4108` |
| Init-envelope capture (works) | `src/services/MessageService.ts:3679-3683` |
| Confirm-branch capture (works) | `src/services/MessageService.ts:4037-4039` |
| Consumer of `updatedUserProfile` | `src/services/MessageService.ts:4186`, `:5643`, `:5690` |
| Persist to IndexedDB | `src/components/context/MessageDB.tsx:354-380` |
| `dm-update-profile` receive | `src/services/MessageService.ts:690`, `:740-762` |
| `dm-update-profile` send (profile-save only) | `src/services/MessageService.ts:535`, `MessageDB.tsx:492` |
| Sender attaches name/avatar | `src/services/ActionQueueHandlers.ts:735-741` |
| Public-profile fallback + write-back | `src/hooks/business/conversations/useConversationsWithProfileBackfill.ts` |
| Header demotion (only surface that does it) | `src/components/direct/DirectMessage.tsx:266-276` |
| Sidebar raw pass-through | `src/components/direct/DirectMessageContact.tsx:93`, `DirectMessageContactsList.tsx:381` |
| Send-path placeholder stamping | `src/services/MessageService.ts:3390-3400` |
| Mobile reference implementation | `quorum-mobile/context/WebSocketContext.tsx:4739-4741` |

---
*Last updated: 2026-08-04*
