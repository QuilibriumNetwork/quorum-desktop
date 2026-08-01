---
type: bug
title: "A deleted space tag never disappears from other members' rosters — the undefined-stripping merge swallowed the only clear signal"
status: FIXED on branch fix/space-tag-clear-survives-partial-merge (awaiting the announce PR to merge first)
priority: medium — cosmetic but permanent, and self-inflicted 3 commits ago
created: 2026-08-01
updated: 2026-08-01
severity: a tag deleted by the space owner keeps rendering next to every member's name on every other client, forever
area: space member roster / space tags / IndexedDB merge semantics
repos: quorum-desktop (mobile unverified — see §5)
introduced_by: "PR #290 `4be71e3fd` — the saveSpaceMember partial-merge fix"
related_bugs:
  - "2026-08-01-space-sync-member-delta-blind-to-and-erases-global-slot.md"
related_docs:
  - ".agents/docs/features/space-tags.md"
  - ".agents/docs/features/identity-resolution-and-profile-sync.md"
---

# A deleted space tag can no longer be cleared from a member roster

## §1. What happens

A space owner deletes the space's tag. Every member's client is supposed to stop
rendering that tag next to their name. Instead it renders forever, on every
client except the one whose own config changed.

## §2. Why — two correct-looking changes that cancel each other out

**Half one, the sender.** `rebroadcastTagIfChanged` (`MessageService.ts` ~872)
handles deletion by building `resolvedTag = undefined` and then OMITTING
`spaceTag` from the payload. Deletion is therefore signalled by absence — there
is no explicit tombstone on the wire.

**Half two, the receiver.** Both `update-profile` receive sites
(`MessageService.ts:2176` and `:2724`) translate that absence into an explicit
local clear:

```ts
participant.spaceTag =
  inboundTag && validateSpaceTagLetters(...) && isValidSpaceTagUrl(...)
    ? inboundTag
    : undefined;          // <- the clear
await this.messageDB.saveSpaceMember(spaceId, participant);
```

That worked while `saveSpaceMember` was a full-row `put`. **PR #290 changed it to
a partial merge that drops explicit `undefined`s**, precisely so a sync delta
could not punch holes in the global identity slot:

```ts
const incoming = Object.fromEntries(
  Object.entries(userProfile).filter(([, v]) => v !== undefined)
);
store.put({ ...existing, ...incoming, spaceId });
```

`spaceTag: undefined` is now filtered out, `{...existing}` restores the old tag,
and the clear is silently discarded. The two halves are individually right and
jointly wrong: after #290 the row has **no way to express "remove this field"**.

## §3. Isolated repro (run as-is)

```js
const existing = { user_address: 'a', spaceTag: { letters: 'QQQ', url: 'u' } };
const participant = { ...existing };
participant.spaceTag = undefined;               // what the receive handler does
const incoming = Object.fromEntries(
  Object.entries(participant).filter(([, v]) => v !== undefined)
);
console.log({ ...existing, ...incoming });
// → { user_address: 'a', spaceTag: { letters: 'QQQ', url: 'u' } }   ← not cleared
```

## §4. Scope — what else lost its clear

`spaceTag` is the case found, but the merge is field-agnostic, so **any** field a
caller clears by assigning `undefined` is now unclearable. Worth auditing before
fixing:

- `isKicked` — if anything un-kicks by assigning `undefined` rather than `false`
- the override slot: `applyProfileUpdate` deliberately uses `''` for a clear, not
  `undefined`, so it is **safe** — and is the pattern the fix should follow
- the global slot: same, `''`

The override slot getting this right is what makes the fix obvious: the wire
already distinguishes "omitted = no change" from "`''` = deliberately cleared".
`spaceTag` is an object, so it has no `''`, which is exactly why it has no
tombstone.

## §5. Mobile

Unverified. Mobile stores the roster in its own layer and did not receive #290,
so it is probably unaffected — but its receive handler has the same
`participant.spaceTag = ... : undefined` shape, so confirm rather than assume.

## §6. The fix — and the wrong fix that the test suite caught

> ⚠️ **Read this before "restoring the old behaviour".** The obvious fix is to
> make absence mean "clear" again, the way it did before #290. That is WORSE
> than the current bug, and it was written, run and reverted on 2026-08-01.

Most `update-profile` messages carry no tag at all — a global avatar save, and
now the on-connect identity announce. If absence means "clear", every one of
those strips every member's tag, and the announce does it on **every
reconnect**. So the pre-#290 behaviour was not correct-then-broken; it was
**over-clearing**, and #290 traded it for **under-clearing**. Neither is right,
because absence genuinely cannot carry both "I have nothing to say about the
tag" and "the tag is gone".

The three-state fix:

| Wire | Meaning | Why |
|---|---|---|
| field absent | no change | the common case: the sender is talking about something else |
| `spaceTag: null` | **clear** — the tombstone | deletion needs its own signal |
| a tag object | set it, if it validates | an INVALID tag is REJECTED, not treated as a clear, or a malformed tag becomes a one-message way to blank somebody else's |

Implemented as:

- `resolveInboundSpaceTag` (`MessageService.ts`, exported and unit-tested) —
  the three-state decision, used by both receive sites.
- `saveSpaceMember(spaceId, row, { clearFields: ['spaceTag'] })` — carries the
  clear through the merge. Absence stays the safe default for every partial
  writer, which is the #290 property worth keeping.
- `rebroadcastTagIfChanged` sends `spaceTag: null` on deletion instead of
  omitting the field. It is the ONLY sender entitled to speak about the tag —
  it fires only when the tag actually changed. Every other sender omits it
  precisely because it has nothing to say.

Old clients see a falsy value and behave exactly as they did, so the wire change
is additive.

**Mobile is unverified.** Its receive handler has the same shape and would need
to learn the tombstone too; until then a mobile client will keep showing a
deleted tag. Not a regression — that is what it does today.

## §7. How it was found

Reading the receive path while wiring the on-connect identity announce
(`2026-08-01-space-member-identity-announce-on-connect.md`), to check whether
omitting `spaceTag` from the announce payload could wipe a member's tag. It
cannot — omission is now a no-op in every direction, which is the bug.

---
*Last updated: 2026-08-01*
