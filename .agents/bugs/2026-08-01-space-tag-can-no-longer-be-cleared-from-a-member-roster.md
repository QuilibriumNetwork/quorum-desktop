---
type: bug
title: "A deleted space tag never disappears from other members' rosters — the undefined-stripping merge swallowed the only clear signal"
status: CONFIRMED by isolated repro (not yet fixed)
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

## §6. Fix options, cheapest first

1. **A `null` tombstone in the merge.** Keep dropping `undefined` (that is the
   #290 property worth keeping — it is what makes a partial row safe), and let
   `null` mean "remove this field":

   ```ts
   const incoming = Object.fromEntries(
     Object.entries(userProfile)
       .filter(([, v]) => v !== undefined)
       .map(([k, v]) => [k, v === null ? undefined : v])
   );
   ```

   Then the two receive sites assign `null` instead of `undefined`.
   `SpaceMemberRow.spaceTag` widens to `BroadcastSpaceTag | null`; renderers
   already test truthiness. **Preferred** — it restores the lost expressiveness
   instead of special-casing one field.
2. **Clear `spaceTag` through a dedicated DB method.** Narrow, no type change,
   but leaves the general "no field can ever be removed" hole open for the next
   caller to fall into.
3. **Put a tombstone on the wire** (`spaceTag: null` from the sender). Correct in
   the long run and needed for cross-client agreement, but it is a wire change
   and both apps must understand it, so it is not the first move.

Whichever is chosen: **write the failing test first**. This defect is invisible
to `tsc` and to every existing test, which is how it shipped.

## §7. How it was found

Reading the receive path while wiring the on-connect identity announce
(`2026-08-01-space-member-identity-announce-on-connect.md`), to check whether
omitting `spaceTag` from the announce payload could wipe a member's tag. It
cannot — omission is now a no-op in every direction, which is the bug.

---
*Last updated: 2026-08-01*
