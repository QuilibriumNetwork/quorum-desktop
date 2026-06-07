---
type: bug
title: "Save Changes in Account tab throws 'missing inbox configuration' when space_members record is incomplete"
status: open
severity: medium
scope: desktop
created: 2026-06-07
---

# `Save Changes` in Account tab throws "missing inbox configuration"

## Symptom

Opening Space Settings → Account tab and clicking **Save Changes** shows the toast:

> Cannot update profile: missing inbox configuration

The display name and avatar changes are not saved. Notification toggles still autosave (they go through a different path), so it's only the profile portion that fails.

## Where it fires

[`useSpaceProfile.ts:197-199`](../../src/hooks/business/spaces/useSpaceProfile.ts#L197) throws when the user's `space_members` IndexedDB record for the current space has no `inbox_address`:

```ts
const member = await messageDB.getSpaceMember(spaceId, currentPasskeyInfo.address);
if (!member?.inbox_address) {
  throw new Error('Cannot update profile: missing inbox configuration');
}
```

`getSpaceMember` reads directly from the IndexedDB `space_members` store with no fallback or recovery.

## When was it introduced

Commit `9c994e6c` on 2025-10-06, "Add Account tab to Space Settings with role display". The error check was added at the same time as the Account tab itself.

## Confirmed pre-existing, NOT a regression from any recent PR

Verified by independent investigation agent: same code exists on `origin/main`, same code exists at the branch point of the notification-alignment PR (`218329f5`), no PR has touched `useSpaceProfile.ts` since the original commit.

## When it manifests

The user's `space_members` record is missing or has an empty/null `inbox_address`. Likely causes:
- Space was joined under a different account/device and the membership data didn't fully sync
- The user joined the space with an older client version that didn't write `inbox_address` consistently
- The `space_members` record was partially written and never repopulated (incomplete join handshake)
- Cross-device sync timing issue where the space appears available to UI but the membership record isn't yet populated locally

## Suggested fix

Two layers worth considering:

1. **Defensive recovery in `useSpaceProfile.onSave`**: instead of throwing immediately, attempt to fetch the member's inbox via the network or trigger a space-membership re-sync. Only throw the error if recovery fails. Single try-once is enough; no infinite retry needed.

2. **Better user-facing message**: the current toast says "missing inbox configuration" which is meaningless to end users. Replace with something like *"Could not update your profile for this space. Try leaving and rejoining the space."* — actionable even when the underlying state can't be repaired.

The longer-term fix is to ensure `space_members` records are always written with `inbox_address` at join time, but that's a larger architectural question about the join handshake's atomicity. The two fixes above are local and ship-able independently.

## Severity rationale

**Medium**. It blocks the Account tab's Save Changes for any user in this state — but doesn't break the rest of the app, and may only affect a small fraction of users (those whose membership records are incomplete). Notification toggles in the same panel still work because they go through `useChannelMute` and `useMentionNotificationSettings` paths, not `useSpaceProfile`.

---
*Last updated: 2026-06-07*
