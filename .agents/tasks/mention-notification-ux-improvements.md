# Mention Notification UX Improvements

**Status:** Ready for Implementation (Revised - Pragmatic Approach)
**Priority:** High
**Created:** 2025-10-09
**Revised:** 2025-10-09 (Simplified based on architecture review)
**Related:** [mention-notification-system.md](../docs/features/mention-notification-system.md)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Limitations Analysis](#current-limitations-analysis)
3. [Industry Best Practices Research](#industry-best-practices-research)
4. [Proposed Solutions (Pragmatic Approach)](#proposed-solutions-pragmatic-approach)
5. [Implementation Plan](#implementation-plan)
6. [Technical Considerations](#technical-considerations)
7. [Testing Strategy](#testing-strategy)
8. [Future Enhancements](#future-enhancements)
9. [Revision Notes](#revision-notes)

---

## Executive Summary

### Problem Statement

The current mention notification system (Phase 1) has three UX limitations that negatively impact user experience:

1. **No real-time bubble updates** - Notification bubbles don't decrease until page refresh (MOST NOTICEABLE)
2. **Read tracking is not viewport-based** - All messages marked as read when viewing channel, regardless of visibility
3. **Highlights re-trigger on scroll** - Users see confusing repeated highlights for already-seen mentions (MINOR POLISH)

### Impact Assessment

| Limitation | User Impact | Frequency | Severity | Priority |
|------------|-------------|-----------|----------|----------|
| No real-time bubble updates | High - Stale UI every session | Every channel visit | **Critical** | 1 |
| Non-viewport read tracking | Medium - Lose track of off-screen mentions | Channel visits with multiple mentions | High | 2 |
| Repeated highlighting | Low - Confusing but temporary | Occasional scroll-back | Low | 3 |

### Recommended Priority (Revised)

**Priority Order** (changed from original):
1. **Fix #2 (Critical)**: Real-time bubble updates - Most user-facing issue, simplest fix
2. **Fix #1 (High)**: Viewport-based read tracking - Important UX improvement
3. **Fix #3 (Low)**: Persistent highlight state - Minor polish

**Rationale:** Bubble staleness happens **every single time** a user views mentions. Viewport tracking only affects users with multiple mentions at different scroll positions. Re-highlighting is rare and temporary (6s fade).

---

## Current Limitations Analysis

### Limitation #1: No Real-Time Bubble Updates (MOST CRITICAL)

#### Current Behavior

**File:** `src/components/space/Channel.tsx` (lines 438-440)

```typescript
messageDB.saveReadTime({
  conversationId,
  lastMessageTimestamp: latestMessageTimestamp,
});
// NOTE: Intentionally NOT invalidating query cache here
// Bubble will update on next page refresh when cache is refetched
```

#### Why This Limitation Exists

Phase 1 intentionally skipped cache invalidation to keep implementation simple and avoid potential flickering issues.

#### User Impact Scenarios

**Scenario A: Every Single Time**
```
User sees bubble: "3 mentions" on #general
User opens channel, views all 3 mentions
Bubble still shows "3 mentions"
User switches channels → bubble still shows "3"
User refreshes page → bubble disappears
Result: User confused, doesn't trust notification system
```

**Impact:** This happens to **every user, every time** they view mentions. It's the most noticeable limitation.

---

### Limitation #2: Read Tracking Not Viewport-Based

#### Current Behavior

**File:** `src/components/space/Channel.tsx` (lines 423-463)

```typescript
// Marks ALL messages as read when viewing channel
useEffect(() => {
  if (messageList.length > 0) {
    const latestMessageTimestamp = Math.max(
      ...messageList.map((msg) => msg.createdDate || 0)
    );

    setTimeout(() => {
      messageDB.saveReadTime({
        conversationId,
        lastMessageTimestamp: latestMessageTimestamp,
      });
    }, 2000);
  }
}, [messageList, messageDB, spaceId, channelId]);
```

#### User Impact Scenarios

**Scenario A: Multiple Mentions at Different Positions**
```
User has 5 unread mentions in #general
User opens channel, sees first mention at top
After 2 seconds, ALL 5 mentions marked as read
User scrolls down to see others → bubble already gone
Result: User doesn't know there were 4 more mentions below
```

**Impact:** Only affects users with multiple mentions at different scroll positions (less common than bubble staleness).

---

### Limitation #3: Highlight Re-triggers on Scroll (MINOR POLISH)

#### Current Behavior

**File:** `src/hooks/business/messages/useViewportMentionHighlight.ts` (lines 33-86)

```typescript
export function useViewportMentionHighlight(...) {
  const hasTriggeredRef = useRef(false);  // Component-scoped, resets on remount

  useEffect(() => {
    hasTriggeredRef.current = false;  // Resets when messageId changes
  }, [messageId]);
}
```

#### User Impact Scenarios

**Scenario A: Scroll Back Up**
```
User scrolls to mention → highlights for 6 seconds
User scrolls past mention
User scrolls back up to mention
Result: Mention highlights AGAIN (confusing)
```

**Impact:** Only affects users who scroll back to already-seen mentions. Highlight fades after 6s anyway. Low priority polish issue.

---

## Industry Best Practices Research

### Research Summary

Comprehensive research from leading chat applications (Slack, Discord), UX design authorities (Nielsen Norman Group, Smashing Magazine), and technical implementation guides (MDN, web.dev).

### Key Findings

#### 1. Real-Time Badge Updates

**Best Practice:** Notification badges should update in near-real-time to maintain user trust.

**Industry Standards:**
- **Slack**: Immediate visual feedback as user views content
- **Discord**: Counters decrement instantly
- **WhatsApp**: Real-time badge updates via optimistic UI

**Key UX Principles (Nielsen Norman Group):**
> "Updates within 100-200ms feel instant to users"

**Implementation Pattern:**
- Invalidate query cache after read tracking
- Let React Query refetch automatically (50-100ms on IndexedDB)
- No need for optimistic updates if refetch is <200ms

#### 2. Viewport-Based Read Tracking

**Best Practice:** Messages should only be marked as read when actually visible to the user for sufficient duration.

**Industry Standards:**
- **Slack**: Viewport detection + 1-2s time threshold
- **Discord**: Marks as read when scrolled past with 50%+ visibility
- **Telegram**: More aggressive (immediate on viewport entry)

**Implementation Pattern:**
- IntersectionObserver with 50% threshold
- Time threshold: 1.5s (user actually looked at it)
- Batch updates for performance

#### 3. One-Time Highlights

**Best Practice:** Visual highlights should only trigger once per notification.

**Industry Standards:**
- **Discord**: Highlights unread messages on scroll, but only first time
- **Telegram**: Persistent blue line until read
- **Slack**: Uses "New messages" divider instead of per-message highlighting

---

## Proposed Solutions (Pragmatic Approach)

> **Architecture Philosophy:** These solutions follow the project's pragmatic approach:
> - Extend existing systems rather than creating new abstractions
> - Ship incrementally (3 small PRs instead of 1 large PR)
> - Optimize only when measurements prove it's necessary
> - Keep implementation simple and maintainable

---

### Solution #1: Enable Real-Time Bubble Updates (Priority: Critical)

**Estimated Effort:** 1-2 hours (simple invalidation only)

#### Approach: Simple Query Invalidation

The simplest solution: just invalidate the query cache when read time is saved. React Query will automatically refetch, and IndexedDB queries are fast enough (<100ms) that users won't notice.

#### Technical Design

**Update Channel.tsx read tracking:**

```typescript
// In Channel.tsx, lines 432-440
setTimeout(() => {
  messageDB.saveReadTime({
    conversationId,
    lastMessageTimestamp: latestMessageTimestamp,
  });

  // NEW: Invalidate mention counts cache
  queryClient.invalidateQueries({
    queryKey: ['mention-counts', spaceId],
  });
}, 2000);
```

**That's it.** No optimistic updates, no complex cache manipulation, no new hooks.

#### Why This Works

- ✅ React Query refetches automatically after invalidation
- ✅ IndexedDB queries are fast (50-100ms typical)
- ✅ Updates feel instant to users (<200ms threshold)
- ✅ No race conditions or rollback logic needed
- ✅ Single source of truth (database)

#### Implementation Steps

1. **Import queryClient in Channel.tsx** (5 min)
   ```typescript
   import { useQueryClient } from '@tanstack/react-query';
   const queryClient = useQueryClient();
   ```

2. **Add invalidation to both read tracking effects** (10 min)
   - Line 440: After debounced save
   - Line 458: After unmount save

3. **Test bubble behavior** (30 min)
   - Open channel with 3 mentions
   - View all mentions
   - Verify bubble updates within 1-2 seconds

4. **Optional: Measure refetch time** (15 min)
   - Add console.time() around invalidation
   - Verify it's <200ms
   - **Only** add optimistic updates if it's slower

**Total Time:** 1 hour implementation + 30 min testing

#### Benefits

✅ Bubbles update in real-time (or near-real-time)
✅ Users trust the notification system
✅ Minimal code changes (2 lines added)
✅ Zero new abstractions
✅ Easy to test and maintain

#### Potential Future Optimization

**IF** measurements show refetch time >200ms (unlikely):
- Add optimistic cache update before invalidation
- Decrement count immediately for instant feedback
- But start simple and measure first!

---

### Solution #2: Implement Viewport-Based Read Tracking (Priority: High)

**Estimated Effort:** 3-4 hours (extend existing hook)

#### Approach: Extend Existing Hook with Callback

The existing `useViewportMentionHighlight` hook already detects when messages enter the viewport. Just extend it to call a "mark as viewed" callback.

#### Technical Design

**Step 1: Extend useViewportMentionHighlight hook**

**File:** `src/hooks/business/messages/useViewportMentionHighlight.ts`

```typescript
export function useViewportMentionHighlight(
  messageId: string,
  isMentioned: boolean,
  isUnread: boolean,
  highlightMessage: (messageId: string, options?: { duration?: number }) => void,
  onMessageViewed?: (messageId: string) => void  // NEW: Optional callback
) {
  const elementRef = useRef<HTMLDivElement>(null);
  const hasTriggeredRef = useRef(false);
  const viewedTimerRef = useRef<NodeJS.Timeout | null>(null);  // NEW: Timer for "viewed"
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!isMentioned || !isUnread || hasTriggeredRef.current || !elementRef.current) {
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            // Existing: Trigger highlight immediately
            if (!hasTriggeredRef.current) {
              hasTriggeredRef.current = true;
              highlightMessage(messageId, { duration: 6000 });
            }

            // NEW: Start timer for "viewed" tracking
            if (onMessageViewed && !viewedTimerRef.current) {
              viewedTimerRef.current = setTimeout(() => {
                onMessageViewed(messageId);
              }, 1500);  // Mark as viewed after 1.5s of visibility
            }
          } else {
            // Message left viewport - clear "viewed" timer
            if (viewedTimerRef.current) {
              clearTimeout(viewedTimerRef.current);
              viewedTimerRef.current = null;
            }
          }
        });
      },
      {
        threshold: 0.5,
        rootMargin: '0px',
      }
    );

    observerRef.current.observe(elementRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (viewedTimerRef.current) {
        clearTimeout(viewedTimerRef.current);
      }
    };
  }, [messageId, isMentioned, isUnread, highlightMessage, onMessageViewed]);

  useEffect(() => {
    hasTriggeredRef.current = false;
  }, [messageId]);

  return elementRef;
}
```

**Step 2: Add batch tracking to Channel.tsx**

**File:** `src/components/space/Channel.tsx`

```typescript
// NEW: Track which messages have been viewed
const viewedMessagesRef = useRef<Set<string>>(new Set());
const viewedTimeoutRef = useRef<NodeJS.Timeout>();
const queryClient = useQueryClient();

// NEW: Callback when message is viewed
const handleMessageViewed = useCallback((messageId: string) => {
  viewedMessagesRef.current.add(messageId);

  // Debounce: save 2s after last message viewed
  if (viewedTimeoutRef.current) {
    clearTimeout(viewedTimeoutRef.current);
  }

  viewedTimeoutRef.current = setTimeout(async () => {
    const viewedIds = Array.from(viewedMessagesRef.current);
    viewedMessagesRef.current.clear();

    // Find latest timestamp of viewed messages
    const viewedMessages = messageList.filter(m => viewedIds.includes(m.messageId));
    if (viewedMessages.length === 0) return;

    const latestTimestamp = Math.max(...viewedMessages.map(m => m.createdDate || 0));

    await messageDB.saveReadTime({
      conversationId: `${spaceId}/${channelId}`,
      lastMessageTimestamp: latestTimestamp,
    });

    // Invalidate cache for real-time updates
    queryClient.invalidateQueries({
      queryKey: ['mention-counts', spaceId],
    });
  }, 2000);
}, [messageList, spaceId, channelId, messageDB, queryClient]);

// Save immediately on unmount
useEffect(() => {
  return () => {
    if (viewedTimeoutRef.current) {
      clearTimeout(viewedTimeoutRef.current);
    }
    if (viewedMessagesRef.current.size > 0) {
      const viewedIds = Array.from(viewedMessagesRef.current);
      const viewedMessages = messageList.filter(m => viewedIds.includes(m.messageId));
      if (viewedMessages.length > 0) {
        const latestTimestamp = Math.max(...viewedMessages.map(m => m.createdDate || 0));
        messageDB.saveReadTime({
          conversationId: `${spaceId}/${channelId}`,
          lastMessageTimestamp: latestTimestamp,
        });
      }
    }
  };
}, [messageList, spaceId, channelId, messageDB]);
```

**Step 3: Pass callback to MessageList and Message**

**File:** `src/components/message/MessageList.tsx`

```typescript
// Add prop
interface MessageListProps {
  // ... existing props
  onMessageViewed?: (messageId: string) => void;  // NEW
}

// Pass to Message components
<Message
  // ... existing props
  onMessageViewed={onMessageViewed}
/>
```

**File:** `src/components/message/Message.tsx`

```typescript
// Add prop
interface MessageProps {
  // ... existing props
  onMessageViewed?: (messageId: string) => void;  // NEW
}

// Use in hook
const mentionRef = useViewportMentionHighlight(
  message.messageId,
  isMentioned,
  isUnread,
  highlightMessage,
  onMessageViewed  // NEW: Pass callback
);
```

#### Implementation Steps

1. **Extend useViewportMentionHighlight hook** (1 hour)
   - Add `onMessageViewed` optional parameter
   - Add timer logic for 1.5s visibility threshold
   - Add cleanup for timer

2. **Add tracking to Channel.tsx** (1 hour)
   - Create `handleMessageViewed` callback
   - Batch viewed messages with debouncing
   - Add unmount save logic

3. **Update MessageList and Message** (30 min)
   - Add `onMessageViewed` prop to both
   - Pass callback through component tree

4. **Remove old blanket read tracking** (15 min)
   - Delete old useEffect (lines 423-463)
   - Keep only viewport-based tracking

5. **Testing** (1.5 hours)
   - Test with multiple mentions at different scroll positions
   - Test fast channel switching (unmount behavior)
   - Test with virtualized lists (500+ messages)

**Total Time:** 3 hours implementation + 1.5 hours testing

#### Benefits

✅ Messages only marked as read when actually viewed
✅ 1.5s threshold ensures user actually saw the message
✅ Batch updates maintain performance
✅ Works with virtualized lists
✅ Extends existing hook (no new abstractions)

#### Trade-offs

⚠️ Requires passing callback through component tree (3 components)
⚠️ Slightly more complex than blanket approach
⚠️ Messages may stay "unread" longer (by design - this is good!)

---

### Solution #3: Prevent Repeated Highlighting (Priority: Low)

**Estimated Effort:** 30 minutes (module-level Set)

#### Approach: Module-Level Set (Simplest Possible)

The re-highlight issue is caused by component-scoped `useRef` that resets on remount. Use a module-level Set instead—it persists across component lifecycles.

#### Technical Design

**File:** `src/hooks/business/messages/useViewportMentionHighlight.ts`

```typescript
// NEW: Module-level Set (outside component)
const highlightedMessagesInSession = new Set<string>();

// Optional: Clear old highlights periodically to prevent memory bloat
if (typeof window !== 'undefined') {
  setInterval(() => {
    if (highlightedMessagesInSession.size > 1000) {
      highlightedMessagesInSession.clear();
    }
  }, 3600000);  // Clear every 1 hour if >1000 messages
}

export function useViewportMentionHighlight(
  messageId: string,
  isMentioned: boolean,
  isUnread: boolean,
  highlightMessage: (messageId: string, options?: { duration?: number }) => void,
  onMessageViewed?: (messageId: string) => void
) {
  const elementRef = useRef<HTMLDivElement>(null);
  const viewedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Check module-level Set instead of useRef
    if (!isMentioned || !isUnread || highlightedMessagesInSession.has(messageId) || !elementRef.current) {
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            // Check Set again before highlighting
            if (!highlightedMessagesInSession.has(messageId)) {
              highlightedMessagesInSession.add(messageId);  // Mark as highlighted
              highlightMessage(messageId, { duration: 6000 });
            }

            // Viewed tracking logic...
            if (onMessageViewed && !viewedTimerRef.current) {
              viewedTimerRef.current = setTimeout(() => {
                onMessageViewed(messageId);
              }, 1500);
            }
          } else {
            // Clear viewed timer if message leaves viewport
            if (viewedTimerRef.current) {
              clearTimeout(viewedTimerRef.current);
              viewedTimerRef.current = null;
            }
          }
        });
      },
      { threshold: 0.5, rootMargin: '0px' }
    );

    observerRef.current.observe(elementRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (viewedTimerRef.current) {
        clearTimeout(viewedTimerRef.current);
      }
    };
  }, [messageId, isMentioned, isUnread, highlightMessage, onMessageViewed]);

  // REMOVE: This useEffect that was causing re-highlights
  // useEffect(() => {
  //   hasTriggeredRef.current = false;
  // }, [messageId]);

  return elementRef;
}
```

**That's it.** Replace `useRef` with module-level Set. Remove the problematic reset effect.

#### Implementation Steps

1. **Add module-level Set** (5 min)
   - Declare `highlightedMessagesInSession` at module level
   - Add optional memory cleanup interval

2. **Replace useRef checks with Set checks** (10 min)
   - Change `hasTriggeredRef.current` to `highlightedMessagesInSession.has(messageId)`
   - Change `hasTriggeredRef.current = true` to `highlightedMessagesInSession.add(messageId)`

3. **Remove problematic reset effect** (2 min)
   - Delete the `useEffect` that resets on messageId change

4. **Testing** (15 min)
   - Test scroll up/down → no re-highlight
   - Test channel switching → no re-highlight
   - Test virtualization → no re-highlight

**Total Time:** 15 min implementation + 15 min testing

#### Benefits

✅ Highlights only trigger once per session
✅ Survives component remounting (virtualization)
✅ Survives channel switching
✅ Zero new files, zero new abstractions
✅ Automatic memory management (cleanup interval)

#### Why This Works Better Than Context

| Aspect | Context Provider | Module-Level Set |
|--------|------------------|------------------|
| **Complexity** | 80+ lines | 5 lines |
| **New Files** | 1 new file | 0 new files |
| **Provider Setup** | Wrap component tree | None needed |
| **Performance** | Context re-renders | Zero re-renders |
| **Testing** | Must mock provider | Direct access |

**Module-level Set is the pragmatic choice.**

---

## Implementation Plan

### Incremental Rollout Strategy

Ship in 3 small PRs rather than 1 large PR. This allows:
- ✅ Faster code review
- ✅ Easier to test and debug
- ✅ Rollback individual fixes if needed
- ✅ Gather user feedback between phases

---

### Phase 1: Quick Win - Real-Time Updates (1-2 hours)

**Goal:** Fix the most noticeable UX issue with minimal code changes

**Tasks:**
1. Import `useQueryClient` in Channel.tsx
2. Add `queryClient.invalidateQueries()` after both read time saves
3. Test bubble updates happen within 1-2 seconds
4. Measure actual refetch time (verify <200ms)
5. Ship and monitor

**Validation Criteria:**
- ✅ Bubble counts decrease when viewing mentions
- ✅ Updates happen within 1-2 seconds (feels instant)
- ✅ No performance issues

**Ship PR #1** → Gather user feedback

---

### Phase 2: Polish - Prevent Re-Highlighting (30 min)

**Goal:** Easy fix while Phase 1 is being tested

**Tasks:**
1. Add module-level Set to useViewportMentionHighlight
2. Replace `useRef` checks with Set checks
3. Remove problematic reset effect
4. Test scroll-back behavior
5. Ship and monitor

**Validation Criteria:**
- ✅ Highlights only trigger once per session
- ✅ No re-highlighting when scrolling back
- ✅ No memory leaks

**Ship PR #2** → Gather user feedback

---

### Phase 3: Feature - Viewport-Based Tracking (3-4 hours)

**Goal:** More accurate read tracking (only implement if users confirm Phase 1/2 aren't enough)

**Tasks:**
1. Extend `useViewportMentionHighlight` with callback parameter
2. Add batch tracking to Channel.tsx
3. Pass callback through MessageList → Message
4. Remove old blanket read tracking
5. Test thoroughly (multiple mentions, virtualization, fast navigation)
6. Ship and monitor

**Validation Criteria:**
- ✅ Messages only marked as read when visible 1.5+ seconds
- ✅ Bubble counts reflect only truly unread mentions
- ✅ Works correctly with virtualized lists
- ✅ No performance degradation

**Ship PR #3** → Final polish complete

---

### Total Estimated Time

| Phase | Original Estimate | Pragmatic Estimate | Time Saved |
|-------|-------------------|-------------------|------------|
| Phase 1 | 4.5 hours | 1-2 hours | 2.5-3.5 hours |
| Phase 2 | 5 hours | 30 minutes | 4.5 hours |
| Phase 3 | 7 hours | 3-4 hours | 3-4 hours |
| **Total** | **16.5 hours** | **5-6.5 hours** | **10-11 hours (60-65% reduction)** |

---

## Technical Considerations

### Performance

**Concern:** Will viewport tracking impact performance?

**Analysis:**
- IntersectionObserver is browser-native (highly optimized)
- Only observes messages currently in DOM (20-50 due to virtualization)
- Each viewport check: <1ms per message
- Batch database writes every 2 seconds (not per message)
- Query invalidation: 50-100ms on IndexedDB

**Verdict:** Negligible performance impact (<50ms per scroll event)

### Cross-Platform Compatibility

**Web/Electron:** ✅ IntersectionObserver natively supported

**Mobile (React Native):** ⚠️ Requires different implementation
- IntersectionObserver not available
- Use `onLayout` and `onScroll` callbacks
- Or use `react-native-intersection-observer` polyfill

**Implementation Note:** Current solutions work for web/desktop. Mobile will require separate PR when React Native support is added.

### Edge Cases

#### Case 1: User Scrolls Very Fast
- **Behavior:** Messages not marked as read (didn't meet 1.5s threshold)
- **Expected:** ✅ Correct - user didn't actually view them

#### Case 2: User Leaves Channel Before Timer
- **Behavior:** Timer cleared on unmount, message not marked as read
- **Expected:** ✅ Correct - user didn't view long enough

#### Case 3: Message Partially Visible (40%)
- **Behavior:** Not marked as read (requires 50% threshold)
- **Expected:** ✅ Correct - wait until more visible

---

## Testing Strategy

### Unit Tests (Optional - Test After Implementation)

Focus on manual testing first. Add unit tests if time permits or bugs found.

### Manual Testing Checklist

#### Phase 1: Real-Time Updates
- [ ] Open channel with 3 mentions
- [ ] View all 3 mentions
- [ ] **Expected:** Bubble count decreases from "3" → "0" within 1-2 seconds
- [ ] Switch channels and back
- [ ] **Expected:** Bubble stays at "0" (doesn't reappear)

#### Phase 2: No Re-Highlighting
- [ ] Open channel with mention
- [ ] Scroll to mention (highlight appears)
- [ ] Scroll past mention
- [ ] Scroll back to mention
- [ ] **Expected:** No second highlight

#### Phase 3: Viewport Tracking
- [ ] Open channel with 5 mentions
- [ ] View only first mention (keep others off-screen)
- [ ] Wait 2 seconds
- [ ] Switch channels
- [ ] Return to original channel
- [ ] **Expected:** First mention not highlighted, remaining 4 still highlighted

---

## Future Enhancements

**Only implement if user feedback indicates these are needed:**

### 1. Optimistic UI Updates

**When:** If measurements show query refetch >200ms

**Implementation:**
```typescript
// Optimistically update cache before invalidation
queryClient.setQueryData(['mention-counts', spaceId, ...], (oldData) => {
  // Decrement count immediately
  return { ...oldData, [channelId]: Math.max(0, oldData[channelId] - 1) };
});

// Then invalidate for accurate refetch
queryClient.invalidateQueries(['mention-counts', spaceId]);
```

### 2. Configurable Sensitivity

**Feature:** User setting for viewport tracking sensitivity
- Immediate: Mark as read on viewport entry
- Normal (default): Mark as read after 1.5s
- Manual: Never auto-mark as read

### 3. Visual Read Indicators

**Feature:** Blue line on left edge of unread mentions (like Telegram)

### 4. "Jump to Next Unread Mention" Button

**Feature:** Keyboard shortcut to navigate between unread mentions

---

## Revision Notes

### Changes Made (2025-10-09)

This task was significantly simplified based on architecture review feedback:

#### Original Approach Issues:
- ❌ Created 2 new hooks (240 lines) for viewport tracking
- ❌ Proposed entire Context system (80+ lines) for highlight state
- ❌ Included complex optimistic updates without performance data
- ❌ Estimated 16.5 hours total implementation

#### Revised Pragmatic Approach:
- ✅ Extend existing hook (30 lines modified) for viewport tracking
- ✅ Use module-level Set (5 lines) for highlight state
- ✅ Start with simple query invalidation, optimize only if needed
- ✅ Estimated 5-6.5 hours total implementation

#### Priority Reordering:
- **Original:** Viewport tracking → Bubble updates → Re-highlighting
- **Revised:** Bubble updates → Viewport tracking → Re-highlighting
- **Rationale:** Bubble staleness affects 100% of users, 100% of the time

#### Philosophy Alignment:
- Original approach: "Industry best practices first"
- Revised approach: "Pragmatic solutions that work"
- Matches project's "don't over-engineer" principle

### Review Score

**Architecture Review:** B- (68.75%)
- Excellent research and problem identification (A+)
- Over-engineered solutions (C+)
- Revised to align with project philosophy

---

**Document Status:** ✅ Ready for Implementation (Revised)
**Total Estimated Time:** 5-6.5 hours (3 small PRs)
**Next Steps:** Start with Phase 1 (real-time updates), ship incrementally

---

*Last updated: 2025-10-09*
