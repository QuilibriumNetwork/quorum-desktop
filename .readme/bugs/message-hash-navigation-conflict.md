# Message Hash Navigation Conflict Bug

**Status**: Open  
**Priority**: Medium  
**Component**: MessageList.tsx  
**Discovered**: 2025-08-03  
**Reporter**: During Message.tsx business logic extraction  

## Summary

When navigating to a message via hash link (e.g., pasted message link), any subsequent message operations (delete, react, etc.) cause the page to scroll back to the originally visited message and re-trigger the yellow highlight flash.

## Steps to Reproduce

1. Copy a message link and paste it in browser (or click shared link)
2. Page correctly scrolls to target message with yellow flash effect
3. Scroll to a different location in the chat
4. Perform any message action (delete, react, reply, copy link) on ANY message
5. **Bug**: Page scrolls back to the originally visited message from step 1
6. **Bug**: Yellow highlight flash effect re-triggers

## Expected Behavior

- Hash navigation should work once and not interfere with subsequent interactions
- After navigating via hash link, normal message operations should not cause re-navigation
- User should be able to scroll freely after initial hash navigation

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
- **Affects**: All message operations after hash navigation
- **Browser**: All browsers
- **Component**: MessageList.tsx, Message.tsx interaction

## Investigation Notes

### Confirmed Facts
- Issue exists in original codebase (pre-refactoring)
- Not caused by MessageActions or useMessageActions extraction
- Reproducible 100% of the time
- Affects both desktop and mobile interactions

### Areas to Investigate
1. **Virtuoso component behavior** - May have internal scroll management conflicting with manual scrollToIndex
2. **Hash clearing timing** - 1-second delay may be too long
3. **messageList dependency** - May need different approach to dependency management
4. **React Router history** - Potential interference with hash state

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
history.replaceState(null, '', window.location.pathname + window.location.search);
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
_Priority: Medium (UX issue, not blocking functionality)_  
_Next: Complete Message.tsx business logic extraction, then investigate_