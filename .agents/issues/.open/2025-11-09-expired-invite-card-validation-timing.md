---
type: bug
title: Expired Invite Card Validation Timing Issue
status: open
created: 2026-01-09T00:00:00.000Z
updated: 2025-11-09T00:00:00.000Z
---

# Expired Invite Card Validation Timing Issue

## Problem

Expired or invalid invite cards display with an active "Join" button, only showing an error message **after** the user clicks the button. This creates a confusing UX where users are presented with a seemingly valid invite that fails when they attempt to join.

**Visual Issue:**
1. Card renders with space details (icon, name, description)
2. "Join" button appears active and clickable
3. User clicks "Join"
4. Error callout appears: "The invite link has expired or is invalid."
5. Button becomes disabled

**Expected Behavior:**
- Error should be detected and displayed immediately when the card renders
- Button should be disabled from the start if invite is invalid/expired
- User should not be able to attempt joining an expired invite

## Root Cause Analysis

### Two-Stage Validation Problem

The invite validation happens in **two separate stages**:

**Stage 1: `processInviteLink()` (Initial Display)**
- Location: `src/services/InvitationService.ts:508-558`
- Purpose: Decrypt invite link and retrieve space metadata
- **Does NOT validate expiration** ❌
- Only checks:
  - Link format validity
  - Space manifest decryption
  - Required fields present
- **Always succeeds** for properly formatted links, even if expired

**Stage 2: `joinInviteLink()` (On Join Click)**
- Location: `src/services/InvitationService.ts:626-636`
- Purpose: Actually join the space
- Calls `getSpaceInviteEval()` which **does** check expiration ✅
- Returns 404 if expired → Throws error
- **This is when expiration is discovered**

### Caching Amplifies the Problem

Module-level cache in `useInviteProcessing.ts` stores successful `processInviteLink()` results:

```typescript
// Lines 10, 37
const inviteCache = new Map<string, { space?: Space; error?: string }>();
inviteCache.set(inviteLink, { space: spaceData });
```

**Timeline:**
1. **Weeks ago:** Invite was valid
   - `processInviteLink()` succeeds → Space data cached
2. **Today:** Invite has expired
   - Component loads → Reads cache → Shows space with "Join" button
   - No re-validation occurs
   - User clicks "Join" → First time expiration is checked → Error

### Regression from Recent Changes

This issue may have been introduced or exacerbated by commit `7d3dfa94`:
- Added invite link support to MessageMarkdownRenderer
- Implemented caching to prevent skeleton flashing on remount
- Cache optimization may have inadvertently prevented expiration detection

## Impact

**User Experience:**
- Confusing: Button appears clickable but doesn't work
- Frustrating: Users waste time clicking invalid invites
- Trust: Makes the app feel broken or unreliable

**Occurrence:**
- Common in old DM conversations with expired invites
- Affects public invite links (not private direct invites)
- Worse when invites were valid initially but expired later

## Investigation History

### Attempted Fixes (2025-11-09)

**Attempt 1: Stale-While-Revalidate Pattern**
- Removed cache skip logic in `useInviteProcessing.ts`
- Made hook always call API to re-validate
- **Result:** No change - `processInviteLink()` doesn't validate expiration

**Attempt 2: Add Expiration Check to `processInviteLink()`**
- Added `getSpaceInviteEval()` call to `processInviteLink()`
- Location: `InvitationService.ts:557-575`
- **Result:** No change observed by user
- **Issue:** May need to investigate why this didn't work

**Attempt 3: Disable Button on Error**
- Added `|| !!displayError` to button disabled state
- Location: `InviteLink.tsx:114`
- **Result:** Button disables after error, but error still only shows on click

## Current Code State

**Modified Files (Need Review):**
1. `src/hooks/business/invites/useInviteProcessing.ts` - Removed cache skip
2. `src/services/InvitationService.ts` - Added expiration validation (lines 557-575)
3. `src/components/message/InviteLink.tsx` - Disable button on error
4. `src/hooks/business/invites/useInviteUI.ts` - "Invite sent" text for senders
5. `src/components/message/MessageMarkdownRenderer.tsx` - Pass sender context
6. `src/components/message/Message.tsx` - Pass sender context

**Changes to Keep:**
- Button text behavior (showing "Invite sent" for senders) - Good UX improvement
- Sender detection logic - Useful feature

**Changes to Revert:**
- Cache skip removal (may cause performance issues)
- Expiration validation in `processInviteLink()` (didn't work as expected)
- Button error disable logic (symptom fix, not root cause)

## Investigation Findings (2025-11-09)

### API Behavior Analysis

Through console logging and testing, discovered the following behavior:

1. **`getSpaceInviteEval()` API Returns:**
   - During `processInviteLink()`: Returns **200 with valid encrypted data** ✅
   - During `joinInviteLink()`: Returns **200 with error text** (e.g., "Decryption failed") ❌

2. **Error Pattern:**
   ```
   Failed to join space: SyntaxError: Unexpected token 'D', "Decryption"... is not valid JSON
   at JSON.parse (<anonymous>)
   at InvitationService.joinInviteLink (InvitationService.ts:707:18)
   ```

3. **Console Logs Show:**
   ```
   [processInviteLink] getSpaceInviteEval succeeded: {data: '{"ciphertext":"..."}', status: 200}
   [useInviteProcessing] processInviteLink succeeded
   ```
   Then on Join click:
   ```
   Failed to join space: SyntaxError: Unexpected token 'D', "Decryption"... is not valid JSON
   ```

### Root Cause Confirmed

**The issue is NOT client-side validation timing.** The API behavior is inconsistent:

1. **Initial processing** (`processInviteLink`): API returns valid encrypted JSON → Space displays with Join button
2. **Join attempt** (`joinInviteLink`): API returns plain text error → JSON.parse fails

### Why This Happens

Likely causes (from related bug reports):

1. **Single-use invite evals**: First call to `getSpaceInviteEval()` during `processInviteLink` might consume the eval
2. **Intermittent expiration**: Related to `.agents/bugs/public-invite-link-intermittent-expiration.md`
3. **API state changes**: Space membership/ratchet ID changes between calls
4. **Network/timing issues**: Related to `.agents/bugs/joinspacemodal-invalid-json-network-error.md`

### Why Client-Side Fix Won't Work

**Cannot add expiration validation to `processInviteLink()`** because:
- Calling `getSpaceInviteEval()` during processing might **consume** the invite eval
- The same invite eval needs to be available for `joinInviteLink()` to actually join
- API returns 200 with valid data during processing, so no way to detect it will fail later

### Current Behavior is Actually Correct

The existing error handling already:
- Shows "The invite link has expired or is invalid" message after Join fails ✅
- Disables the Join button after error ✅
- Prevents repeated clicking ✅

**The user complaint is about seeing the Join button at all**, but this is unavoidable with current API behavior.

### Next Steps

This requires **server-side/API investigation**, not client-side fixes:

1. **Understand invite eval lifecycle:**
   - Are invite evals single-use or multi-use?
   - Why does first call succeed but second fails?

2. **API consistency:**
   - Should expired invites return 404 instead of 200?
   - Should error messages be in response body with error status codes?

3. **Alternative API patterns:**
   - Provide a "validate only" endpoint that doesn't consume the eval
   - Include expiration timestamp in manifest so client can check without eval
   - Return consistent error codes (404) instead of 200 with error text

## Proposed Solution (After Investigation)

### Option A: Fix Validation in `processInviteLink()`
- Debug why current expiration check doesn't work
- Ensure `getSpaceInviteEval()` is actually called
- Verify error is properly propagated to UI

### Option B: Separate Validation Hook
```typescript
// New hook: useInviteExpiration
const useInviteExpiration = (inviteLink, space) => {
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    // Call getSpaceInviteEval separately from processInviteLink
    // Update isExpired state
  }, [inviteLink]);

  return isExpired;
};
```

### Option C: Cache with TTL
- Add timestamp to cache entries
- Revalidate after X minutes
- Clear cache for specific invites when join fails

## Priority

**High** - User-facing bug that creates confusing UX and makes the app appear broken. Common occurrence in old conversations.

## Files Involved

- `src/services/InvitationService.ts` - Invite validation logic
- `src/hooks/business/invites/useInviteProcessing.ts` - Processing and caching
- `src/components/message/InviteLink.tsx` - UI component
- `src/hooks/business/invites/useInviteJoining.ts` - Join action handler
- `src/hooks/business/invites/useInviteUI.ts` - Button state logic

## Related Issues

- May be related to caching performance improvements in commit `7d3dfa94`
- Similar to `directmessage-invite-loading-performance.md` (caching tradeoffs)

---


*Status: Blocked - Requires Server-Side Investigation*
*Conclusion: Cannot be fixed client-side due to API behavior. Invite evals appear valid during processing but fail during join. Likely single-use or intermittent API issue.*
