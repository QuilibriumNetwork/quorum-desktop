---
type: bug
title: "Global notifications panel crashes on any mention it cannot resolve"
status: done
priority: high
created: 2026-08-04
updated: 2026-08-04
severity: crash — the NavRail notifications panel is replaced by the error boundary
area: notifications / message formatting
repos: quorum-desktop
---

# Global notifications panel crashes on any mention it cannot resolve

## Status

**2026-08-04 — shipped in PR #312** (`fix(dm): the unread dot clears when you read
a conversation`), as its own commit "fix(notifications): the global panel no
longer crashes on a mention it cannot resolve".

It rode that PR because it was found while operator-testing the DM branch; it is
unrelated to the DM previews work. Closed rather than left open because the fix
is verified by a test that was confirmed red without it — the reported
`TypeError` reproduces at the same column when the guard is removed.

## Symptom

Clicking the notifications button in the NavRail renders the error boundary
fallback instead of the panel. Console:

```
TypeError: Cannot read properties of undefined (reading 'displayName')
    at Object.processTextToken (useMessageFormatting.ts:161:34)
    at renderMessageContent (NotificationItem.tsx:50:36)
    at NotificationItem (NotificationItem.tsx:146:27)

The above error occurred in the <NotificationItem> component.
```

Reported by the operator 2026-08-04.

## Root cause

[`GlobalNotificationsModal.tsx:36`](../../../src/components/notifications/GlobalNotificationsModal.tsx#L36):

```tsx
// Required by the shared props but unused in global mode.
mapSenderToUser={() => undefined}
```

The comment was wrong. `NotificationPanel` passed that prop straight down to
`NotificationItem`, which feeds it to `useMessageFormatting`, whose user-mention
branch dereferenced the result with no guard:

```ts
const mention = mapSenderToUser(userId);
return { …, displayName: mention.displayName || `@${userId.substring(0, 8)}...` };
```

So any notification whose body contains a legacy `@<address>` mention that is
also listed in `message.mentions.memberIds` threw during render — which is
exactly the class of notification the panel exists to display. The per-space
panel was unaffected: it supplies a real channel-roster map.

Pre-existing; both files unchanged since PR #213. Not introduced by the branch it
was fixed on (`git diff main..HEAD -- src/components/notifications src/hooks/business/messages`
was empty at the time it was reported).

## Fix

Two parts:

1. `processTextToken` guards the lookup (`mention?.displayName`). The prop is
   typed `(senderId: string) => any`, so `undefined` is a legal return for an
   unresolvable sender; it now degrades to the `@xxxxxxxx...` address label,
   which is what the same expression already did for a resolved row with no
   display name. This protects every caller, not just the global panel.
2. `NotificationPanel` routes in-body mentions through `resolveGlobalSender`
   bound to each row's own space — the resolver it already used for the row
   header. Mentions in the global panel now render real names instead of address
   labels. The per-space panel keeps its channel-roster map.

The stub in `GlobalNotificationsModal` is now genuinely unreachable and its
comment says so.

## Test

[`src/dev/tests/hooks/messageFormattingUnresolvedMention.unit.test.ts`](../../../src/dev/tests/hooks/messageFormattingUnresolvedMention.unit.test.ts)
— three cases: resolver returns `undefined` (the crash), returns a row with a
display name, returns a row without one. It asserts the fallback rather than the
absence of a throw, so it pins the contract instead of the symptom.

Verified red: removing the `?.` reproduces the reported `TypeError` at the same
column.

> Fixture note: the mention regex is `Qm` + exactly 44 base58 chars. A test
> address one character too long silently fails to match and the mention branch
> is never entered, so all three cases pass vacuously. Check `address.length === 46`
> when writing mention fixtures.

---
*Last updated: 2026-08-04*
