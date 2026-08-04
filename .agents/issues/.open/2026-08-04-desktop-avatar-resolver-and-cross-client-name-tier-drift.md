---
type: task
title: "Desktop has no avatar resolver, and three name tiers resolve differently from mobile"
status: open
priority: medium
created: 2026-08-04
updated: 2026-08-04
area: identity resolution / desktop-mobile parity / quorum-shared
source: split out of 2026-08-04-desktop-screens-inject-an-address-as-a-display-name-and-defeat-the-resolver (PR #310) — these were two of its Definition-of-Done items that are not part of that defect and are cross-client decisions rather than desktop ones
related:
  - ".agents/issues/.done/2026-08-04-desktop-screens-inject-an-address-as-a-display-name-and-defeat-the-resolver.md (§5 and §9 — the parent, and the measurements below)"
  - ".agents/docs/features/identity-resolution-and-profile-sync.md"
  - ".agents/docs/features/qns-username-display.md"
  - "quorum-mobile utils/resolveMemberName.ts (has both `resolveMemberName` and `resolveMemberAvatar`)"
---

# One rule for names, no rule for avatars, and three tiers that disagree across clients

## 1. Why this is its own item

PR #310 fixed a real defect: desktop call sites fed a truncated address INTO the
name resolver, so it outranked the `.q` name. That is done and verified.

While closing it, two of its DoD items turned out not to belong to it. Both are
cross-client design decisions with a wider blast radius than the bug had, and
neither should be smuggled into a bugfix branch.

## 2. Desktop has no avatar resolver at all

`resolveDisplayName` in `quorum-shared` covers **names only**. Desktop has no
`resolveAvatar` / `resolveMemberIcon` equivalent — a grep returns nothing. So
every avatar call site picks its own source, which is precisely the situation the
name resolver was built to end.

Mobile hit the same wall and solved it locally with `resolveMemberAvatar`
(`quorum-mobile utils/resolveMemberName.ts:167-178`):

```
override (profile_image) → global slot (global_profile_image) → self
```

No QNS step, because a `.q` name carries no picture. It returns `undefined` when
nothing resolves, so callers keep their own initials placeholder rather than
being handed a broken image source — a deliberate choice worth copying.

One narrow piece already landed in #310: `ReactionsModal` derives its avatar
initials from the **resolved name**, so the avatar and the label beside it cannot
disagree. That is a single surface, not a rule.

**The open question is where the rule lives**, and it is not a desktop-only call:
promote `resolveMemberAvatar` into `quorum-shared` and delete mobile's copy, or
implement a desktop-local twin and accept two implementations.

## 3. Three name tiers resolve differently on the two clients

All three predate PR #310 and none was introduced by it. Measurements and file
references are in the parent issue's §9.

### 3-A. The global slot is a TIER on mobile, only a COMPARATOR on desktop

Mobile passes `display_name: global` into shared's `resolveDisplayName`, so a
global name is genuinely rendered as a rung. Desktop's `resolveSpaceMemberName`
reads `globalDisplayName` **only** to compare it against the roster name and
decide whether that roster name was deliberately set; it is never returned.

Desktop currently reaches the same visible output by a different route:
`useMembersWithPublicProfileFallback.ts:147` merges the global name INTO
`displayName` before any render path sees it. So this is **latent, not live** —
but it means the correctness of desktop's global tier is a property of one hook
rather than of the resolver. Any desktop surface that resolves without that hook
renders a truncated address where mobile renders the global name.

Pinned by a test (`ReactionsModal.test.tsx`, "pins that globalDisplayName is a
COMPARATOR") so the behaviour is documented rather than assumed, and so the test
changes deliberately if a tier is added.

### 3-B. Echo detection exists only on desktop

Desktop compares roster against global to spot a row that merely echoes the
global value. Mobile deliberately does not, on the grounds that since the
follow-global work (2026-07-16) the override slot is no longer stamped at join,
so a non-empty override really is deliberate.

That reasoning holds for rows written after that date. For a **legacy** row
stamped before it, mobile's stale echo outranks the member's QNS `.q` name while
desktop demotes it, so the same member reads differently on the two clients until
the row is cleared. Already documented on both sides as an accepted, decaying
gap. Listed here for completeness, not necessarily to be fixed — it may simply
expire.

### 3-C. The address fallback is formatted differently — MEASURED

| Client | Same address, no name anywhere |
|---|---|
| Mobile — `truncateAddress(addr,'medium')` → `formatAddress(addr, 6, 4)` | `QmV5xWMo…F2nX` |
| Desktop — shared `resolveDisplayName`'s internal `truncate()` | `QmV5xW…F2nX` |

Evaluated against `QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZF2nX`.

Desktop shows two fewer entropy characters. Shared's `truncate()` is a naive
`addr.slice(0,6)…addr.slice(-4)` that spends two of its six characters on the
constant `Qm` CIDv0 prefix, which carries zero entropy. `formatAddress` is
Qm-aware: it keeps `Qm` visible but counts `start` **after** it.

Cosmetic, but it is a real cross-client difference on the one surface a user sees
when identity is missing entirely — and shared already contains the better
implementation, unused by its own resolver.

**This also contradicts a comment in mobile's source**, which states its address
rung "is already parity-matched with desktop". It is parity-matched with
desktop's `formatAddress` presets; it is not matched with desktop's *name
resolver*, which does not use `formatAddress`. Correct the comment when
correcting the behaviour.

### 3-D. Minor: desktop has no `isAddressFallback`

Mobile's resolver returns a flag saying "every tier missed, this is the
address". Desktop's `ResolvedMemberName` has `name` and `isQnsVerified` only, so
desktop call sites cannot cheaply tell "we do not know who this is" from "we have
a name" without string-comparing against the address. It is why mobile can vary
avatar-initial and mention-matching behaviour on that condition and desktop
cannot.

## 4. Suggested order

1. **3-C first.** Smallest, fully measured, and the fix is to make shared's
   `resolveDisplayName` use the Qm-aware `formatAddress` already sitting beside
   it. Touches every address label, so it needs a test pinning both clients'
   output to the same string.
2. **§2 next**, as a genuine design decision: promote `resolveMemberAvatar` to
   shared, or twin it on desktop.
3. **3-A and 3-D** together, since both change `ResolvedMemberName`'s contract.
4. **3-B** probably needs no action — confirm it is expiring rather than fix it.

## 5. Definition of done

- [ ] Avatar resolution has a single documented home, and the promote-to-shared question is decided rather than deferred
- [ ] The address fallback renders the identical string on both clients, with a test pinning it
- [ ] `globalDisplayName` is either a real resolver tier on desktop or documented as permanently a comparator, with the reason
- [ ] A decision recorded on `isAddressFallback` — adopt or reject
- [ ] Mobile's incorrect "already parity-matched with desktop" comment is corrected
- [ ] `.agents/docs/features/identity-resolution-and-profile-sync.md` reflects whatever is decided

*Last updated: 2026-08-04*
