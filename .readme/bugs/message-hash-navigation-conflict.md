# Message Hash Navigation Conflict Bug

[← Back to INDEX](../INDEX.md)

**Status**: Open (Low Priority)  
**Priority**: Low  
**Component**: MessageList.tsx  
**Discovered**: 2025-08-03  
**Reporter**: During Message.tsx business logic extraction

**Issue Opened**

## Summary

When navigating to a message via hash link (e.g., pasted message link), subsequent message deletion operations cause the page to scroll back to the originally visited message and re-trigger the yellow highlight flash.

## Steps to Reproduce

1. Copy a message link and paste it in browser (or click shared link)
2. Page correctly scrolls to target message with yellow flash effect
3. Scroll to a different location in the chat
4. Delete ANY message in the chat
5. **Bug**: Page scrolls back to the originally visited message from step 1
6. **Bug**: Yellow highlight flash effect re-triggers

## Expected Behavior

- Hash navigation should work once and not interfere with subsequent interactions
- After navigating via hash link, message deletion should not cause re-navigation
- User should be able to scroll freely after initial hash navigation

## Current Test Results (Post-Fix)

### Confirmed Working

- ✅ **Reply action**: No re-navigation (correctly scrolls to last message sent)
- ✅ **Emoji reactions**: No re-navigation issue
- ✅ **Copy link**: No re-navigation issue

### Still Problematic

- ❌ **Delete action**: Still causes re-navigation to previously visited hash message
  - Scroll to previous message? **YES**
  - Flashing effect: **YES**

## Technical Analysis

### Root Cause

Located in `MessageList.tsx` lines 134-168, specifically the `useEffect` dependency array:

```typescript
useEffect(() => {
  // Hash navigation logic
}, [init, messageList, location.hash]);
```

The `messageList` dependency causes the hash navigation logic to re-run whenever:

- Messages are deleted (`messageList` changes)
- Reactions are added/removed (`messageList` changes)
- New messages arrive (`messageList` changes)

### Current Hash Logic Flow

1. User clicks hash link → `location.hash = "#msg-123"`
2. MessageList scrolls to message 123, shows highlight
3. After 1 second, hash is cleared via `history.replaceState`
4. User performs message operation → `messageList` changes
5. useEffect re-runs due to `messageList` dependency
6. **Problem**: During the 1-second window, hash still exists, causing re-navigation

### Attempted Fix

Added `hasProcessedHash` flag to prevent re-navigation, but issue persists. The conflict may be more complex involving:

- Timing of hash clearing vs message operations
- Virtuoso component internal state management
- React Router hash handling

## Environment

- **Pre-existing bug**: Confirmed to exist before Message.tsx refactoring
- **Affects**: Message deletion operations after hash navigation (other operations fixed)
- **Browser**: All browsers
- **Component**: MessageList.tsx, Message.tsx interaction

## Final Resolution

### Git Bisect Investigation

- Used git bisect to identify commit `210d4f6` as the first bad commit that introduced the bug
- Multiple fix attempts created regressions (infinite scrolling, continuous flashing)
- **Problematic fix attempt**: Commit `3cbc08b` ("Improve message hash navigation with state-based highlighting") introduced worse regressions including infinite scrolling loops
- Reverted to stable baseline commit `46b28e3` before applying final fix

### Applied Fix

**File**: `MessageList.tsx` line 168  
**Change**: Removed `messageList` and `hasProcessedHash` from useEffect dependency array

```typescript
// Before (problematic):
}, [init, messageList, location.hash, hasProcessedHash]);

// After (fixed):
}, [init, location.hash]); // Removed messageList and hasProcessedHash to prevent re-navigation on message changes
```

### Root Cause Analysis

The `messageList` dependency caused the hash navigation logic to re-run on every message operation:

- ✅ Message deletions changed `messageList` → triggered re-navigation (PARTIALLY FIXED)
- ✅ Emoji reactions changed `messageList` → triggered re-navigation (FIXED)
- ✅ New messages changed `messageList` → triggered re-navigation (FIXED)

The fix ensures hash navigation only responds to actual hash changes (`location.hash`), not message list updates.

### Current Status After Testing

**Partial Success**: Fixed emoji reactions and other operations, but message deletion still causes re-navigation.

**Scope Reduced**: Issue now isolated to message deletion operations only:

- ✅ Emoji reactions: Fixed
- ✅ Reply operations: Fixed
- ✅ Copy link: Fixed
- ❌ Message deletion: Still problematic

**Decision**: Keeping as low-priority open bug due to:

- Rare user workflow (visit via hash + delete message immediately)
- Issue scope significantly reduced (only affects deletions)
- Not critical to core functionality

### Fix Results Summary

- ✅ **Major improvement**: Fixed 75% of original problem scenarios
- ✅ **No regressions**: Avoided infinite scrolling and continuous flashing issues
- ❌ **Remaining issue**: Message deletion still triggers re-navigation

## Potential Solutions

### Option 1: Remove messageList Dependency

Only run hash navigation on `location.hash` changes, not messageList changes:

```typescript
}, [init, location.hash]); // Remove messageList dependency
```

### Option 2: Immediate Hash Clearing

Clear hash immediately after capturing target, not after 1 second:

```typescript
// Clear hash immediately after navigation starts
history.replaceState(
  null,
  '',
  window.location.pathname + window.location.search
);
```

### Option 3: Separate Hash State Management

Use separate state for hash processing instead of relying on browser location.hash

### Option 4: Virtuoso-specific Solution

Investigate if Virtuoso has built-in hash navigation support or scroll state management that conflicts.

## Related Files

- `src/components/message/MessageList.tsx` (lines 134-168)
- `src/components/message/Message.tsx` (isHashTarget logic)
- `src/components/message/Message.scss` (message-highlighted animation)

## Test Scenarios

When fixed, ensure these scenarios work:

1. ✅ Hash navigation works initially
2. ✅ User can scroll freely after hash navigation
3. ✅ Message operations don't trigger re-navigation
4. ✅ New hash links work correctly
5. ✅ Multiple hash navigations in sequence work
6. ✅ Hash highlighting shows and clears correctly

---

_Created: 2025-08-03_  
_Updated: 2025-08-03_  
_Priority: Low (UX issue, rare workflow, not blocking functionality)_  
_Status: Open for future investigation when higher priority items are resolved_
