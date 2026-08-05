---
type: bug
title: "The roster sync protocol has no self-exclusion: a peer's stale copy of YOUR row is pushed back onto you as a correction"
status: open
priority: medium
created: 2026-08-05
updated: 2026-08-05
severity: your own identity can be reverted by any peer holding an older copy of it, and the receive guard fails open on legacy rows
area: space sync protocol / quorum-shared / identity
repos: quorum-shared (structural) + quorum-desktop + quorum-mobile (appliers)
source: found by independent review during the 2026-08-04 stale-display-name investigation
related:
  - ".agents/issues/.open/2026-08-04-desktop-shows-a-stale-name-everywhere-except-the-user-settings-field.md"
  - ".agents/issues/.done/2026-08-01-space-sync-member-delta-blind-to-and-erases-global-slot.md"
  - ".agents/docs/features/identity-resolution-and-profile-sync.md"
---

# The roster diff treats your own row like a stranger's

## §1. The structural half — `quorum-shared`

`computeMemberDiff` and `buildMemberDelta` walk **every address in the digest map
with no special case for the requester's own address**. `buildSyncDelta` calls
`computeMemberDiff(theirDigests, ourDigests)`, so whichever peer answers a
`requestSync` will tell you that *you* are outdated about *yourself* whenever its
cached hash for your address differs from the one you reported — and then send you
its stored copy of your own row, verbatim.

This is not "a peer *can* hold a stale copy of you". There is **no mechanism in the
protocol by which it could be otherwise**: your identity is compared and corrected
exactly like anyone else's, at every step.

Note what this is NOT: `2026-08-01-space-sync-member-delta-blind-to-and-erases-global-slot.md`
(done) fixed the digest being blind to the global slot and the apply erasing it.
Self-exclusion is a separate property and was not addressed there.

## §2. The receive half — desktop, and it fails open

`MessageService.ts:6113-6116` guards the override slot with:

```ts
applyOverride = !(existing?.profileTimestamp && existing.profileTimestamp >= incomingOverrideTs)
```

When the local row has **no** `profileTimestamp`, `existing?.profileTimestamp &&
…` short-circuits to falsy and the guard becomes `!(false)` — **true, regardless
of how old the incoming value is**. Every join-stamped row is exactly that shape,
because the join path writes `display_name` and never a timestamp
(`InvitationService.ts:768-773`, `MessageService.ts:4922-4945`).

So a peer's arbitrarily old cached copy of your name is accepted unconditionally
onto any row that has never been through `applyProfileUpdate`.

## §3. Who owns which half

- **Receive-side self-exclusion on desktop** — refuse an override-slot write for
  our own address. A peer is never authoritative about our per-space choice. This
  is small, desktop-local, and is being folded into the stale-display-name fix.
- **Guard failing open on timestamp-less rows** — treat a missing local timestamp
  as 0 and require the incoming one to be strictly greater, rather than accepting
  unconditionally. Also desktop-local.
- **The protocol itself** — whether `quorum-shared` should exclude the requester's
  own address from the diff, or whether every caller must filter it, is a
  cross-client design question. Per the atlas rule, this is not ours to decide
  unilaterally: it changes shared behaviour both apps depend on. Frame it for the
  lead rather than shipping it.

## §4. Why it may matter less than it reads

MEASURED 2026-08-05: on a real account, all four stale override rows carried a
`profileTimestamp`, and three matched their `globalProfileTimestamp` exactly —
the signature of the on-connect announce, not of a sync delta. So on that account
the announce, not this path, is what kept the stale value alive.

That does not clear this path. It means the two mechanisms coexist and the
measurement happened to catch the other one. Do not use it as evidence that this
is harmless.

---

*Last updated: 2026-08-05*
