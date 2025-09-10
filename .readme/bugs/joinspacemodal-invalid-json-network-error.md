# JoinSpaceModal "Invalid JSON" Error Due to Network Issues


**Status**: Open (Low Priority)  
**Priority**: Low  
**Component**: Various
**Discovered**: 2025-08-03

**Issue Opened**

## Bug Description

Users encountering "invalid json" error messages in the JoinSpaceModal when trying to join spaces via invite links. The error appears to be related to network/connection issues rather than actual invalid invite links.

## Root Cause

The error occurs due to:

1. **Network issues** causing incomplete/corrupted API responses during invite validation
2. **No retry logic** in the invite validation flow
3. **Generic error handling** that displays raw JavaScript JSON parsing errors to users
4. **False solution pattern** where regenerating public links appears to "fix" the issue (but actually just retries the network request)

## Technical Details

### Error Flow

1. User enters invite link in JoinSpaceModal
2. `useInviteValidation` calls `apiClient.getSpaceManifest()`
3. Network issues cause corrupted/incomplete JSON response
4. `JSON.parse(manifest.data.space_manifest)` fails with native browser error
5. Error bubbles up to `useSpaceJoining` catch block
6. Raw error message (e.g., "invalid json", "Unexpected token") displayed to user

### Key Code Locations

- `src/hooks/business/spaces/useInviteValidation.ts:79` - JSON.parse of space manifest
- `src/hooks/business/spaces/useInviteValidation.ts:99-101` - JSON.parse of decrypted data
- `src/hooks/business/spaces/useSpaceJoining.ts:24-27` - Generic error handling that exposes raw errors
- `src/components/context/MessageDB.tsx` - Multiple JSON.parse calls in joinInviteLink function

### Problematic Error Handling

```typescript
// useSpaceJoining.ts:24-27
} catch (e: any) {
  console.error(e);
  const errorMessage = e.message || e.toString() || 'Failed to join space';
  setJoinError(errorMessage); // Raw browser error shown to user
  return false;
}
```

## Current Workaround

Users regenerate public invite links when encountering the error, which appears to solve it but is not optimal as it:

- Invalidates existing invite links unnecessarily
- Doesn't address the underlying network issue
- Creates confusion about whether links are actually invalid

## Proposed Solution

1. **Add retry logic** for network failures during invite validation
2. **Detect JSON parsing errors** specifically and retry API calls
3. **Improve error messages** to distinguish between network issues and invalid invites
4. **Add user-friendly error handling** instead of showing raw JavaScript errors

### Implementation Ideas

- Wrap `getSpaceManifest()` calls with retry logic
- Catch `SyntaxError` from JSON.parse and retry
- Show "Connection issue, retrying..." instead of "invalid json"
- Only show "Invalid invite link" for actual validation failures

## Impact

- **User Experience**: Confusing error messages and unnecessary link regeneration
- **Reliability**: Network hiccups cause permanent-seeming failures
- **Support**: Users may think invite system is broken when it's just network issues

## Priority

Medium-High - Affects user onboarding experience and creates confusion about invite system reliability.

---

_Updated: 2025-01-08_
