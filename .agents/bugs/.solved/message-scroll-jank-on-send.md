# Bug: Message Scroll Issues - Send Jank & Delete Auto-Scroll

**Status**: RESOLVED
**Priority**: Medium (UX issue)
**Type**: Bug
**Component**: Channel, DirectMessage, MessageList, Virtuoso
**Affects**: Message sending and deletion UX in channels and DMs
**Created**: 2026-01-05
**Resolved**: 2026-01-05

---

## Summary

Two related scroll issues caused by Virtuoso's `followOutput` callback:

1. **Send Message Jank**: When sending a message, the UI exhibited scroll jank where the message briefly appeared behind the MessageComposer before scrolling to the correct position.

2. **Delete Auto-Scroll**: When deleting a message, the page auto-scrolled to the last message instead of staying at the current position.

---

## Issue 1: Send Message Scroll Jank

### Root Cause
Two independent scroll mechanisms were fighting each other:

1. **Virtuoso's `followOutput`** - fires automatically when new items added, returns `'smooth'`
2. **Manual `scrollToBottom()`** - fired 100ms later with `behavior: 'auto'` (instant)

The instant scroll interrupted the smooth scroll mid-animation.

### Solution
- Removed manual `scrollToBottom()` calls from Channel.tsx and DirectMessage.tsx
- Added `scroll-padding-bottom: $s-16` to `.message-list` in `_chat.scss` to account for sticky composer
- Let Virtuoso's `followOutput` handle all scrolling

---

## Issue 2: Delete Message Auto-Scroll

### Root Cause
When a message is deleted via optimistic update (`queryClient.setQueryData`), Virtuoso detects the list change and calls `followOutput` BEFORE our deletion handling code runs.

**Timeline (from debug logs):**
```
T+0ms (9052):    followOutput fires - deletionInProgress: false ← SCROLL HAPPENS
T+89ms (9141):   setDeletionInProgress(true) called ← TOO LATE!
```

The flow was:
1. User clicks delete → `handleDelete` in `useMessageActions.ts`
2. `queryClient.setQueryData` removes message from cache (optimistic update)
3. Virtuoso sees list changed → calls `followOutput` immediately
4. `handleSubmitMessage` runs → sets deletion flag (TOO LATE!)

### Solution
Added `onBeforeDelete` callback that fires BEFORE the optimistic update:

1. **useMessageActions.ts** - Added `onBeforeDelete` option, called before `queryClient.setQueryData`
2. **Message.tsx** - Added `onBeforeDelete` prop, passed to `useMessageActions`
3. **MessageList.tsx** - Uses a ref (`deletionInProgressRef`) for synchronous state, passes callback to Message:
   ```typescript
   onBeforeDelete={() => {
     deletionInProgressRef.current = true;
     setTimeout(() => {
       deletionInProgressRef.current = false;
     }, 500);
   }}
   ```

**Why a ref instead of state?**
React state updates are async and batched. By the time Virtuoso calls `followOutput`, a state update wouldn't have propagated yet. A ref updates synchronously, so the flag is `true` when `followOutput` checks it.

---

## Files Changed

| File | Changes |
|------|---------|
| `src/hooks/business/messages/useMessageActions.ts` | Added `onBeforeDelete` callback option, called before optimistic update |
| `src/components/message/Message.tsx` | Added `onBeforeDelete` prop, passed to `useMessageActions` |
| `src/components/message/MessageList.tsx` | Added `deletionInProgressRef`, `setDeletionInProgress` method, `onBeforeDelete` callback to Message |
| `src/components/space/Channel.tsx` | Removed manual scroll calls, removed `isDeletionInProgress` state |
| `src/components/direct/DirectMessage.tsx` | Same cleanup as Channel.tsx |
| `src/styles/_chat.scss` | Added `scroll-padding-bottom: $s-16` to `.message-list`, spacer to `$s-6` |

---

## Key Lessons

1. **Optimistic updates fire Virtuoso callbacks immediately** - Any code that runs after `setQueryData` is too late to prevent scroll behavior
2. **Use refs for synchronous state** - When you need a value to be immediately available (not waiting for React render cycle), use a ref
3. **Trace timing with `performance.now()`** - For race conditions, add timestamps to debug logs to understand the exact sequence of events
4. **`followOutput` fires on both add AND remove** - Virtuoso calls this callback whenever the list changes, not just when items are added

---

## Related Issues

- [auto-jump-unread-virtuoso-scroll-conflict.md](auto-jump-unread-virtuoso-scroll-conflict.md) - Similar Virtuoso scroll timing issues

---

*Last updated: 2026-01-05*
