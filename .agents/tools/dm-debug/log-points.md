---
type: tool
title: Log points for DM identity debugging
status: living
created: 2026-06-09
---

# Log points for DM identity debugging

When tracing where the profile-broadcast chain breaks, drop `console.log` at these four layers. Run on both sender and receiver, save bio, paste logs.

> ⚠️ **Strip all logs before committing.** Search `BIO-DEBUG` (or whatever tag you used) before staging.

## Layer 1 — Send call site

**File:** `src/hooks/business/user/useUserSettings.ts`
**Where:** Inside `saveChanges`, immediately before the `updateUserProfile(...)` call.

```ts
console.log('[BIO-DEBUG] saveChanges fired', {
  displayName, trimmedBio, previousBio, bioChanged,
  bioPassedToCallback: bioChanged ? trimmedBio : undefined,
});
```

**If absent:** the UserSettings modal isn't calling saveChanges (UI bug, not yours).
**If present but Layer 2 is missing:** `updateUserProfile` callback is a stale closure — restart dev server.

## Layer 2 — MessageDB callback entry

**File:** `src/components/context/MessageDB.tsx`
**Where:** Top of the `updateUserProfile` `useCallback`.

```ts
console.log('[BIO-DEBUG] updateUserProfile called', { displayName, hasUserIcon: !!userIcon, bio, hasSpaceTag: !!spaceTag });
```

**If absent after Layer 1 fires:** HMR didn't update the context provider. Hard reload or restart dev server.

## Layer 3 — DM block guard in MessageDB

**File:** `src/components/context/MessageDB.tsx`
**Where:** Inside the DM block, just before / inside the `if (ks) { ... }` for the broadcast.

```ts
const ks = actionQueueServiceRef.current?.getUserKeyset();
console.log('[BIO-DEBUG] updateUserProfile DM block', {
  hasKeyset: !!ks,
  hasMessageService: !!messageServiceRef.current,
  hasActionQueueRef: !!actionQueueServiceRef.current,
});
```

**If `hasKeyset` is false:** ActionQueueService isn't initialized yet — the broadcast silently skips. Race condition during early app load.

## Layer 4 — MessageService send loop

**File:** `src/services/MessageService.ts`
**Where:** Inside `broadcastProfileToAllDMs`, at the start of the loop and inside both success / catch arms.

```ts
console.log('[BIO-DEBUG] broadcast start', { dmCount: conversations.length, bio });
// ... inside loop, after encryptAndSendDm
console.log('[BIO-DEBUG] sent to partner', { partner: partnerAddress.slice(0, 12) });
// ... in catch
console.warn('[BIO-DEBUG] FAILED to partner', { partner: partnerAddress.slice(0, 12), err: err instanceof Error ? err.message : String(err) });
```

**If `start` fires but no per-partner logs:** the conversations table is empty — sender has no DMs.
**If `FAILED`:** the error message tells you what's wrong (no established session, missing keyset).
**If `sent` fires for all partners but receiver shows no log on Layer 5:** transport-level delivery failure.

## Layer 5 — Receive intercept

**File:** `src/services/MessageService.ts`
**Where:** Inside `interceptControlMessages`, top of the `if (raw.type === 'dm-update-profile')` branch.

```ts
console.log('[BIO-DEBUG] receive dm-update-profile', {
  senderAddress: senderAddress.slice(0, 12),
  claimedSenderId: profileMsg.senderId?.slice(0, 12),
  match: profileMsg.senderId === senderAddress,
  hasDisplayName: !!profileMsg.displayName,
  hasUserIcon: !!profileMsg.userIcon,
  bio: profileMsg.bio,
});
```

**If absent on receiver after sender's Layer 4 succeeded:** the message didn't arrive. Check `encryption_states` symmetry — if the receiver has no encryption state for this sender, the inbox subscription that would route the message doesn't exist.

## Render-side log (DM bio UI)

**File:** `src/components/direct/DirectMessage.tsx`
**Where:** Inside the `otherUser` useMemo.

```ts
console.log('[BIO-DEBUG] DirectMessage render', {
  partner: address?.slice(0, 12),
  conversationBio: conversation?.conversation?.bio,
  publicProfileBio: recipientPublicProfile?.bio,
  hasMemberEntry: !!members[address!],
});
```

**Use to confirm:** after a successful receive, the `conversation.bio` is populated AND the render reads it. Two separate failure modes.

---
*Last updated: 2026-06-09*
