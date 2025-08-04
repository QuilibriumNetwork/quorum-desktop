# Kick User UX Improvements

[← Back to INDEX](../../INDEX.md)

## Status: Attempted - Reverted

## Problem Statement

The current kick user experience has poor UX during the 3-5 second operation:

- App appears frozen during kick operation
- No visual feedback indicating progress
- User unsure if operation is working
- Modal doesn't auto-close after success
- Success message appears in chat but user might miss it

## Attempted Solution

### Changes Made (2025-01-30)

**1. KickUserModal.tsx Changes:**

- Added loading state logic to show different button states
- Implemented spinner icon display during kick operation
- Added auto-close functionality after successful kick

```tsx
// Added button state logic
const getButtonContent = () => {
  if (kicking) {
    return { text: t`Kicking...`, iconName: 'spinner' as const };
  }
  if (confirmationStep === 0) {
    return { text: t`Kick!`, iconName: undefined };
  }
  return { text: t`Click again to confirm`, iconName: undefined };
};
```

**2. useUserKicking.ts Changes:**

- Added confirmation state reset after successful operation
- Enhanced auto-close callback execution with proper cleanup

### Issue Encountered

**Modal closed immediately upon clicking "Click again to confirm"** instead of:

1. Showing "Kicking..." with spinner for 3-5 seconds
2. Auto-closing after operation completed

**Root Cause Analysis:**

- The `onSuccess` callback (props.onClose) was being called immediately
- Never observed the "Kicking..." state with spinner
- Console log "Kick operation completed for user: ..." appeared but timing unclear
- Suggests the `kickUser` function from MessageDB might be resolving immediately instead of waiting for actual completion

### Files Modified & Reverted

- `src/components/modals/KickUserModal.tsx` ✅ Reverted
- `src/hooks/business/user/useUserKicking.ts` ✅ Reverted

## Current State

Back to original working behavior:

- "Kick!" → "Click again to confirm"
- Button disabled during operation (no visual loading feedback)
- Modal stays open until manually closed
- Success message appears in chat

## Recommendations for Future Implementation

### Investigation Needed

1. **Debug MessageDB.kickUser timing**: Determine if it's truly async or resolving immediately
2. **Separate auto-close from loading state**: Don't tie modal closure to the kick operation directly
3. **Add intermediate loading feedback**: Show progress without auto-closing

### Alternative Approaches

1. **Manual close with better feedback**: Keep manual close but add loading spinner
2. **Toast notifications**: Use toast/notification system instead of relying on chat message
3. **Progress indicators**: Add progress steps (Preparing → Sending → Updating → Complete)

### Technical Considerations

- The `enqueueOutbound` pattern in MessageDB suggests operations are queued
- WebSocket operations may have different completion timing than Promise resolution
- React Query cache invalidation happens after MessageDB operation completes

## Priority: Medium

- Current system works functionally
- UX improvement would be nice but not critical
- Requires deeper investigation of MessageDB async patterns

---

**Created**: 2025-01-30  
**Status**: Deferred pending MessageDB investigation  
**Affects**: User experience during kick operations
