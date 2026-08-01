---
type: bug
title: "Space sync member reconciliation is blind to the global identity slot, and erases it on apply"
status: open — UNVERIFIED, found by code reading; reproduction steps in §4
priority: high (if confirmed) — it disables the one mechanism that should make a space identity cadence unnecessary
created: 2026-08-01
updated: 2026-08-01
severity: user-visible — space members render as a truncated address; existing identity can be lost
area: space sync protocol / space_members / identity resolution
repos: quorum-desktop (both defects), quorum-shared (defect 1's hash)
related_bugs:
  - "2026-06-13-space-members-missing-no-join-row.md"
related_tasks:
  - ".agents/tasks/2026-08-01-space-member-identity-announce-on-connect.md"
  - ".agents/tasks/2026-08-01-identity-announce-cadence-research.md"
related_docs:
  - ".agents/docs/features/identity-resolution-and-profile-sync.md"
related_tools:
  - ".agents/tools/dm-debug/06-space-member-sources.js"
---

# Space sync member reconciliation ignores — and erases — the global identity slot

> ⚠️ **Found by reading code during the identity-cadence research
> (2026-08-01). NOT reproduced live.** §4 is the verification procedure; run it
> before acting. Context and the work that consumes this fix:
> `.agents/tasks/2026-08-01-identity-announce-cadence-research.md` Slice 3.

## §1. Why this matters more than it looks

The space side already ships a **receiver-driven, fingerprint-first member
identity reconciliation** — `requestSync` fires on every connect
(`src/components/context/MessageDB.tsx:611-631`), peers exchange `MemberDigest`
(SHA-256 of name + icon), and the responder returns full `SpaceMember` rows for
exactly the members the requester lacks or has stale.

That is the mechanism people keep proposing to build. It exists. If it worked on
the identity that actually renders, spaces would need no periodic announce at all.
These two defects are why it doesn't.

## §2. Defect 1 — the digest hashes the wrong slot

`computeMemberHash` (`quorum-shared/src/sync/utils.ts:140-147`) hashes:

```ts
const displayNameHash = computeHash(member.display_name || '');
const iconHash        = computeHash(member.profile_image || '');
```

Both are the **per-space OVERRIDE slot**. Desktop's adapter, which builds the
shared `SpaceMember` from the DB row, drops the global slot entirely
(`src/adapters/indexedDbAdapter.ts:142-154`) — no `global_display_name`, no
`global_user_icon`, no `global_bio`, no `bio`, no `profileTimestamp`, no
`globalProfileTimestamp`.

Since the follow-global work (2026-07-16) deliberately **stopped stamping the
override fields**, the override slot is empty for most members and the global slot
is what renders (see the identity-resolution doc, "The TWO-SLOT wire model").

**Consequences:**

1. Two clients holding completely different global identity data for a member
   produce **identical digests** (`hash('')` on both fields) → `computeMemberDiff`
   (`sync/utils.ts:364-395`) reports no difference → nothing is transferred.
2. A member the requester is missing *entirely* IS transferred — as a row with
   **no identity in any slot**. It then renders as a truncated address while
   looking "present" to everything downstream, including the `join`-row recovery
   paths. This matches the symptom in
   `2026-06-13-space-members-missing-no-join-row.md` (46 of 89 senders with no
   usable row).

## §3. Defect 2 — applying a member delta erases the global slot

`src/services/MessageService.ts:5645-5669` applies the delta:

```ts
const dbMember = {
  ...member,                                    // wire member — no global_* (defect 1)
  user_address: userAddress,
  user_icon: member.profile_image || member.user_icon,
  joinedAt: member.joinedAt ?? existing?.joinedAt,   // ← the ONLY field preserved
};
await this.messageDB.saveSpaceMember(spaceId, dbMember);
```

and `saveSpaceMember` does a **full-row replace** (`src/db/messages.ts:1211`):

```ts
store.put({ ...userProfile, spaceId });
```

IndexedDB `put` replaces the whole record. Every field absent from `dbMember` is
destroyed: `global_display_name`, `global_user_icon`, `global_bio`, `bio`,
`profileTimestamp`, `globalProfileTimestamp` — all real fields, written by
`applyGlobalProfileSlots` (`MessageService.ts:222-239`).

So a member whose *override* hash differs (the case that does produce a delta)
loses their global identity on the receiver, and the staleness guards lose their
timestamps at the same time.

This is the same **"empty means absent"** rule that `utils/conversationProfile.ts`
enforces, violated at a different write site — the same shape as the deferred
Slice 4 in `2026-08-01-dm-partner-identity-lost-on-established-sessions.md`, where
`db.saveMessage` unconditionally stamps the conversation row.

## §4. How to verify (~20 minutes, two desktop clients)

1. Clients A and B, both members of one space, both with a global display name and
   avatar set, and **no per-space override** in that space.
2. On A, confirm B's row carries `global_display_name` / `global_user_icon` —
   `.agents/tools/dm-debug/06-space-member-sources.js`, or read `space_members`
   directly in DevTools.
3. Make the two clients disagree about B's global identity (e.g. B renames while A
   is offline), then reconnect A. `requestSync` fires on the 10s connect timer.
4. **Defect 1 is confirmed** if no `memberDelta` is produced for B despite the
   disagreement. Watch for `[MessageService] sync-delta` logs.
5. **Defect 2 is confirmed** if, after a delta that *does* include B, B's
   `global_display_name` / `global_user_icon` / `profileTimestamp` are gone from
   A's row.

## §5. Fix shape (do not implement before §4)

**Defect 2 first** — it is destructive, smaller, and independent.

- Merge instead of replace: read the existing row and preserve any field the wire
  member does not carry, exactly as `joinedAt` already is. Preferably fix it in
  `db.saveSpaceMember` so every caller benefits, but note that is a shared write
  path and needs its own regression pass.

**Defect 1** — two parts, and they must ship together or the digest lies:

- Carry the global slot through `dbMemberToShared` / `sharedMemberToDb`
  (`src/adapters/indexedDbAdapter.ts:142-166`), which needs the shared
  `SpaceMember` type to declare the global fields (still outstanding as
  `.agents/tasks/.done/2026-07-16-quorum-shared-type-two-slot-global-identity-fields.md`
  — carried via casts today).
- Include them in `computeMemberHash`. **This changes the digest for every member
  on both platforms**, so the first exchange after deploy produces a large delta.
  Bound it, and check mobile computes the identical hash before shipping either
  side — a one-sided change makes every member look permanently out of sync.

## §6. Relationship to the announce work

If both defects are fixed, the space side needs only a **bootstrap** announce for
members nobody has a row for (the sibling task's Slice 1), behind a bounded,
terminating gate. It does **not** need a periodic cadence, and specifically must
not copy the DM 24h placeholder — see
`.agents/tasks/2026-08-01-identity-announce-cadence-research.md` Slice 3.

---
*Last updated: 2026-08-01*
