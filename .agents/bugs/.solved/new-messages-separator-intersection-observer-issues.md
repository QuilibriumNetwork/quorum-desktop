---
type: bug
title: New Messages Separator - Intersection Observer Dismissal Issues
status: done
created: 2025-11-12T00:00:00.000Z
updated: 2025-11-12T00:00:00.000Z
---

# New Messages Separator - Intersection Observer Dismissal Issues


**Priority**: High
**Component**: MessageList, NewMessagesSeparator

**Resolved**: 2025-11-12
**Solution**: Replaced Intersection Observer with Virtuoso's `rangeChanged` callback

---

## Problem Summary

The "New Messages" separator is not being dismissed when scrolled out of viewport, despite implementing an Intersection Observer. The separator persists indefinitely unless the page is refreshed.

---

## Root Causes Discovered

### 1. **Initial Issue: `innerRef` Prop Error**
The separator component was using `innerRef` prop which is not valid for DOM elements. FlexRow was passing it to a `<div>`, causing React warnings and preventing ref attachment.

**Solution Applied:**
- Changed NewMessagesSeparator to use `React.forwardRef`
- Changed prop from `innerRef` to standard `ref`

### 2. **Critical Issue: Intersection Observer Root Element**
The Intersection Observer was observing relative to the **browser viewport** instead of the **MessageList scroll container**.

**Context:**
- MessageList uses Virtuoso for virtualized scrolling
- Messages scroll inside a container, not the browser window
- Default Intersection Observer observes viewport, not nested scroll containers

**Solution Applied:**
```typescript
// Get the Virtuoso scroll container element
const virtuosoElement = (virtuoso.current as any).element;

// Pass as root to observe within scroll container
root: virtuosoElement,
```

### 3. **Timeout Clearing Issue**
Initial implementation used a 500ms `setTimeout` to delay observer setup, but:
- Component re-renders multiple times during auto-jump
- Each re-render triggers useEffect
- Timer gets cleared before it can fire
- Observer never gets set up

**Attempted Solutions:**
- Added `observerSetupRef` to prevent multiple setups
- Removed timeout delay, set up observer immediately

### 4. **Component Re-render Cascade**
MessageList re-renders frequently during:
- Auto-jump scroll animation
- Message loading
- State updates from parent (Channel.tsx)

This causes the useEffect to retrigger, potentially cleaning up the observer prematurely.

---

## Current Implementation Status

**What Works:**
- ✅ Separator appears on auto-jump
- ✅ Unread count displays correctly
- ✅ Count stays fixed (doesn't decrease as messages are read)
- ✅ Ref forwarding implemented correctly
- ✅ Observer setup reaches completion (logs confirm)

**What Doesn't Work:**
- ❌ Separator never dismisses when scrolled out of view
- ❌ No intersection events fire when scrolling

**Console Logs Show:**
```
[NewMessagesSeparator] Setting up observer immediately...
[NewMessagesSeparator] Observer setup complete
// But then... no intersection events when scrolling
```

---

## Alternative Approaches to Consider

### Option A: Use Virtuoso's Built-in Scroll Events ⭐ **RECOMMENDED**
Instead of Intersection Observer, leverage Virtuoso's scroll tracking:

```typescript
// In MessageList.tsx
<Virtuoso
  rangeChanged={(range) => {
    // Check if first unread message is in visible range
    const firstUnreadIndex = messageList.findIndex(
      m => m.messageId === newMessagesSeparator?.firstUnreadMessageId
    );

    if (firstUnreadIndex !== -1) {
      const isVisible = firstUnreadIndex >= range.startIndex &&
                       firstUnreadIndex <= range.endIndex;

      if (!isVisible && separatorWasVisible) {
        onDismissSeparator();
      }
      if (isVisible) {
        setSeparatorWasVisible(true);
      }
    }
  }}
/>
```

**Pros:**
- ✅ Works natively with Virtuoso's virtualization
- ✅ No DOM observation needed
- ✅ Reliable - not affected by ref timing issues
- ✅ Simpler mental model

**Cons:**
- ⚠️ Couples dismissal logic to Virtuoso API
- ⚠️ Need to track separator visibility state

### Option B: Use Virtuoso's `itemsRendered` Callback
```typescript
<Virtuoso
  itemsRendered={(items) => {
    const firstUnreadIndex = messageList.findIndex(
      m => m.messageId === newMessagesSeparator?.firstUnreadMessageId
    );

    const isRendered = items.some(item => item.originalIndex === firstUnreadIndex);

    if (!isRendered && separatorWasVisible) {
      onDismissSeparator();
    }
  }}
/>
```

**Pros:**
- ✅ Even simpler than rangeChanged
- ✅ Directly tracks if separator message is rendered
- ✅ No manual range calculations

**Cons:**
- ⚠️ Tied to Virtuoso's rendering lifecycle

### Option C: Time-Based Dismissal (Fallback)
```typescript
useEffect(() => {
  if (!newMessagesSeparator) return;

  const timer = setTimeout(() => {
    onDismissSeparator();
  }, 10000); // 10 seconds

  return () => clearTimeout(timer);
}, [newMessagesSeparator]);
```

**Pros:**
- ✅ Dead simple
- ✅ No observer complexity
- ✅ Works reliably

**Cons:**
- ❌ Poor UX - dismisses even if user is reading
- ❌ Arbitrary timing
- ❌ Can't "rediscover" separator if user scrolls back

### Option D: Manual "Dismiss" Button
```typescript
<NewMessagesSeparator
  count={...}
  onDismiss={onDismissSeparator}
/>
```

**Pros:**
- ✅ User has explicit control
- ✅ Zero complexity
- ✅ 100% reliable

**Cons:**
- ❌ Adds UI clutter
- ❌ Requires user action
- ❌ Less elegant than auto-dismiss

### Option E: Hybrid Approach
Combine Virtuoso scroll tracking with a minimum visibility time:

```typescript
const [separatorVisibleSince, setSeparatorVisibleSince] = useState<number | null>(null);

// In Virtuoso rangeChanged
if (isVisible && !separatorVisibleSince) {
  setSeparatorVisibleSince(Date.now());
} else if (!isVisible && separatorVisibleSince) {
  const visibleDuration = Date.now() - separatorVisibleSince;
  if (visibleDuration > 2000) { // Visible for at least 2 seconds
    onDismissSeparator();
  }
}
```

**Pros:**
- ✅ Prevents accidental dismissal during fast scrolling
- ✅ Ensures user sees separator
- ✅ Still auto-dismisses naturally

**Cons:**
- ⚠️ More complex logic
- ⚠️ Requires state management

---

## Recommendation

**Use Option A (Virtuoso's `rangeChanged`)** because:

1. **Native Integration**: Works with Virtuoso's virtualization system
2. **Reliability**: No ref timing issues or Intersection Observer quirks
3. **Performance**: Already computed by Virtuoso internally
4. **Maintainability**: Clear cause-and-effect logic
5. **Proven Pattern**: Similar to how "Jump to Present" button works

### Proposed Implementation

```typescript
// In MessageList.tsx
const [separatorWasVisible, setSeparatorWasVisible] = useState(false);

<Virtuoso
  // ... existing props
  rangeChanged={(range) => {
    if (!newMessagesSeparator) {
      setSeparatorWasVisible(false);
      return;
    }

    const firstUnreadIndex = messageList.findIndex(
      m => m.messageId === newMessagesSeparator.firstUnreadMessageId
    );

    if (firstUnreadIndex === -1) return;

    const isVisible = firstUnreadIndex >= range.startIndex &&
                     firstUnreadIndex <= range.endIndex;

    if (isVisible && !separatorWasVisible) {
      // First time separator becomes visible
      setSeparatorWasVisible(true);
    } else if (!isVisible && separatorWasVisible) {
      // Separator scrolled out of view - dismiss it
      onDismissSeparator?.();
      setSeparatorWasVisible(false);
    }
  }}
/>
```

**Benefits of This Approach:**
- Removes all Intersection Observer complexity
- Removes ref management issues
- Works with Virtuoso's internal state
- ~30 lines of simple, readable code
- No timing issues or race conditions

---

## Current Code Issues

### File: `MessageList.tsx` (lines 406-493)

**Problems:**
1. Intersection Observer may not work reliably with Virtuoso's virtualization
2. Complex ref management and timing coordination
3. Multiple useEffect dependencies causing re-renders
4. Observer cleanup timing is fragile

### File: `NewMessagesSeparator.tsx`

**Status:** ✅ Working correctly after forwardRef refactor

---

## Testing Checklist

When implementing the fix, verify:

- [ ] Separator appears on auto-jump ✅
- [ ] Count displays correctly ✅
- [ ] Separator dismisses when scrolled up past it
- [ ] Separator dismisses when scrolled down past it
- [ ] No console errors ✅
- [ ] Works on fast scrolling
- [ ] Works on slow scrolling
- [ ] Separator reappears on channel revisit with unreads ✅
- [ ] No performance issues with large message lists
- [ ] Works after message arrives (separator stays visible)

---

## Related Files

- `src/components/message/MessageList.tsx:406-493` - Intersection Observer logic
- `src/components/message/NewMessagesSeparator.tsx:25-54` - Separator component
- `src/components/space/Channel.tsx:124-128,391-394,424-427` - State management

---

## Documentation

- [new-messages-separator.md](../docs/features/messages/new-messages-separator.md) - Feature spec
- [auto-jump-first-unread.md](../docs/features/messages/auto-jump-first-unread.md) - Related feature

---

## Final Solution Implemented

✅ **Option A (Virtuoso `rangeChanged`)** has been implemented and is working perfectly.

**Implementation Details:**
- File: `MessageList.tsx:415-446`
- Uses `handleRangeChanged` callback with Virtuoso
- Tracks separator visibility via `separatorWasVisible` state
- ~30 lines of simple, reliable code

**Cleanup Completed:**
- ✅ Removed all Intersection Observer code
- ✅ Removed `separatorRef` (no longer needed)
- ✅ Simplified NewMessagesSeparator (removed forwardRef)
- ✅ Removed all debug logging
- ✅ Updated comments to reflect new approach

**Testing Results:**
- ✅ Separator dismisses when scrolled up past it
- ✅ Separator dismisses when scrolled down past it
- ✅ No console errors
- ✅ Works reliably with Virtuoso's virtualization
- ✅ Performance is excellent

---

*Last updated: 2025-11-12*
