---
type: task
title: Fix SpaceIcon Notification Bubble Cache Invalidation
status: done
complexity: low
ai_generated: true
created: 2026-01-06T00:00:00.000Z
updated: '2026-01-09'
---

# Fix SpaceIcon Notification Bubble Cache Invalidation

> **⚠️ AI-Generated**: May contain errors. Verify before use.


**Files**:
- `src/hooks/business/conversations/useUpdateReadTime.ts:38-80`
- `src/services/MessageService.ts:1356-1399`

## What & Why

The SpaceIcon notification bubble in NavMenu doesn't update immediately when users read channels or receive new replies. Currently, mention counts update correctly, but reply counts remain stale for up to 90 seconds (React Query cache stale time) because the `reply-counts` query keys are not being invalidated.

**Current behavior:**
- User reads a channel with reply notifications → mention count decreases immediately, reply count stays stale
- New reply to user's message arrives → reply count doesn't increase until cache expires or page refresh

**Desired behavior:**
- All notification counts (mentions + replies) update immediately after the 2-second reading threshold

## Context
- **Existing pattern**: `useUpdateReadTime` already invalidates `mention-counts` and `unread-counts` properly
- **Root cause**: Missing `reply-counts` invalidations in two locations
- **Related**: Similar to DM notification system but uses standard React Query (not `useSuspenseInfiniteQuery`)

## Implementation

### 1. Add reply-counts invalidation to useUpdateReadTime (`src/hooks/business/conversations/useUpdateReadTime.ts`)

Add after line 55 (after `['mention-counts', 'space']` invalidation):
```typescript
// Invalidate space-level reply counts (updates space icon reply bubbles)
queryClient.invalidateQueries({
  queryKey: ['reply-counts', 'space'],
});
```

Add after line 60 (after `['unread-counts', 'channel', spaceId]` invalidation):
```typescript
// Invalidate channel-level reply counts (updates channel sidebar)
queryClient.invalidateQueries({
  queryKey: ['reply-counts', 'channel', spaceId],
});
```

### 2. Add reply-counts invalidation for new messages (`src/services/MessageService.ts`)

Add after line ~1377 (after the mention invalidation block):
```typescript
// Invalidate reply counts when a reply to any user's message arrives
// This ensures the notification bubble updates when someone replies to your message
if (decryptedContent.replyMetadata?.parentAuthor) {
  await queryClient.invalidateQueries({
    queryKey: ['reply-counts', spaceId],
  });
  await queryClient.invalidateQueries({
    queryKey: ['reply-notifications', spaceId],
  });
}
```

## Verification

✅ **Reply count decreases immediately when reading channel**
   - Test: Have unread replies in a space → Enter channel with replies → Stay 2+ seconds → SpaceIcon bubble count should decrease

✅ **Reply count increases immediately when new reply arrives**
   - Test: Post a message → Have another user reply → SpaceIcon bubble should show increased count without refresh

✅ **Mention counts still work correctly**
   - Test: Verify existing mention notification behavior is unchanged

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit`

## Definition of Done
- [ ] `useUpdateReadTime.ts` invalidates `['reply-counts', 'space']` and `['reply-counts', 'channel', spaceId]`
- [ ] `MessageService.ts` invalidates reply counts when new reply messages arrive
- [ ] TypeScript passes
- [ ] Manual testing confirms immediate UI updates for both increase and decrease scenarios
- [ ] No console errors

## Related Documentation
- [DM Mark All Read Bug (solved)](.agents/bugs/.solved/dm-mark-all-read-no-immediate-ui-update.md) - Similar issue with different root cause
- [useSpaceReplyCounts](src/hooks/business/replies/useSpaceReplyCounts.ts) - Query key: `['reply-counts', 'space', userAddress, ...spaceIds]`
- [useReplyNotificationCounts](src/hooks/business/replies/useReplyNotificationCounts.ts) - Query key: `['reply-counts', 'channel', spaceId, ...]`

---
