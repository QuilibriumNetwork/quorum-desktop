---
type: bug
title: "Save Changes in Account tab throws 'missing inbox configuration' (false precondition)"
status: solved
severity: medium
scope: desktop
created: 2026-06-07
solved: 2026-06-08
---

# `Save Changes` in Account tab throws "missing inbox configuration"

## Symptom

Opening Space Settings → Account tab and clicking **Save Changes** showed the toast:

> Cannot update profile: missing inbox configuration

The display name and avatar changes were not saved. Notification toggles still autosaved (they go through a different path), so it was only the profile portion that failed.

Reproduced consistently across two different test accounts in different spaces (owner and non-owner). A third account on the live app saved cleanly — same code, different per-account state in IndexedDB.

## Root cause (corrected)

The original bug report blamed an incomplete `space_members` record (missing `inbox_address`) and proposed defensive recovery as the fix. That was wrong. The real root cause:

[`useSpaceProfile.ts:197-199`](../../src/hooks/business/spaces/useSpaceProfile.ts#L197) (introduced with the Account tab in commit `9c994e6c`, 2025-10-06) checked a precondition the underlying code never actually requires:

```ts
const member = await messageDB.getSpaceMember(spaceId, currentPasskeyInfo.address);
if (!member?.inbox_address) {
  throw new Error('Cannot update profile: missing inbox configuration');
}
```

Tracing what `submitChannelMessage` does for an `update-profile` message ([`MessageService.ts:4936-5018`](../../src/services/MessageService.ts#L4936-L5018)):
1. Signs with a **space-level inbox key** via `getSpaceKey(spaceId, 'inbox')` — a *space* key, not the *member's* `inbox_address` field.
2. Sends to the hub.
3. Updates the local `space_members` record under `if (participant)` — gracefully no-ops when the record is missing.

`member.inbox_address` is **never read** by the update-profile submit path. The receiver side at [`MessageService.ts:3033-3040`](../../src/services/MessageService.ts#L3033) even has an explicit comment confirming the message is designed to tolerate inbox key rotation:

> For update-profile: inbox address changes are legitimate (key rotation). The message IS the key rotation announcement, so skip inbox mismatch check.

So the guard was a phantom precondition. It rejected a flow the protocol explicitly tolerates.

## Fix

[`useSpaceProfile.ts`](../../src/hooks/business/spaces/useSpaceProfile.ts) — removed the guard entirely. The `member` record is still loaded, but only to harvest its cached `user_icon` as the avatar fallback. That access is now optional-chained (`member?.user_icon`) so a missing record falls back to the global `currentPasskeyInfo.pfpUrl` instead of crashing.

Net change: two lines (guard removed, optional chain added) plus a comment block explaining why the guard was wrong, so the next reader doesn't reinstate it.

## Why two test users failed and a third didn't

The `inbox_address` field on a member record is populated lazily — typically when the member actively participates in DM-bearing flows in that space. Test accounts that have only just joined a space, or that haven't exercised the full encryption-state lifecycle locally, can have the field empty. The "live app" account had populated it through normal use; the test accounts hadn't.

This is normal IndexedDB state, not corruption. There was nothing wrong with the data.

## Verification

Reproduced and confirmed fixed on a previously-failing test user in a previously-failing space. Save Changes now closes the modal cleanly and persists the new display name/avatar.

---
*Last updated: 2026-06-08*
