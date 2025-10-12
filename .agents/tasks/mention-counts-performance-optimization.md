# Mention Counts Performance Optimization

## Status
🔴 **Not Started** - Pending review and prioritization

## Problem Statement

The mention notification system scans **ALL messages in ALL channels across ALL spaces** to display mention bubbles on SpaceIcons in the navigation bar. This causes performance issues as users join more spaces and channels accumulate message history.

### Current Performance Issues

**Time Complexity**: O(S × C × M) where:
- S = number of spaces
- C = channels per space
- M = messages per channel (capped at 10k)

**Observed Performance**:
- 200-400ms for 20 channels
- 50-200ms for 1k+ messages per channel
- **Potential**: 1-2s delay for power users with 10+ spaces, 20+ channels each

**Root Causes**:
1. **Fetch-then-filter pattern** - Fetches ALL messages (up to 10k), filters in JavaScript
2. **No early-exit** - Continues counting beyond display threshold ("9+")
3. **No database-level filtering** - Can't query "messages mentioning user X after timestamp Y"
4. **Scans all channels simultaneously** - No lazy loading or progressive disclosure

**Key Files**:
- `src/hooks/business/mentions/useSpaceMentionCounts.ts:43-98` - Main scanning loop
- `src/hooks/business/mentions/useChannelMentionCounts.ts:31-113` - Channel-level scanning
- `src/components/navbar/NavMenu.tsx:42` - Entry point
- `src/utils/mentionUtils.ts:32-59` - Mention detection logic

---

## Optimization Roadmap

### Phase 1: Early-Exit Optimization (Quick Win)
**Priority**: 🔴 **HIGH** - Immediate value, low effort
**Estimated Impact**: 3-5x performance improvement
**Effort**: ~30 minutes (10 lines of code)

#### Context
SpaceIcon displays "9+" for counts > 9 (`SpaceIcon.tsx:67` uses `formatMentionCount(props.mentionCount, 9)`), but the system counts ALL mentions regardless.

#### Implementation

**File**: `src/hooks/business/mentions/useSpaceMentionCounts.ts`

```typescript
const DISPLAY_THRESHOLD = 10; // Stop counting after 10 mentions

// Process each space
for (const space of spaces) {
  let spaceTotal = 0;
  const channelIds = space.groups.flatMap((group) =>
    group.channels.map((channel) => channel.channelId)
  );

  // Process each channel with early exit
  for (const channelId of channelIds) {
    // Early exit: no need to count beyond display threshold
    if (spaceTotal >= DISPLAY_THRESHOLD) {
      break; // Stop scanning remaining channels
    }

    const conversationId = `${space.spaceId}/${channelId}`;
    const { conversation } = await messageDB.getConversation({
      conversationId,
    });

    const lastReadTimestamp = conversation?.lastReadTimestamp || 0;
    const { messages } = await messageDB.getMessages({
      spaceId: space.spaceId,
      channelId,
      limit: 10000,
    });

    // Count mentions with per-message early exit
    for (const message of messages) {
      if (message.createdDate <= lastReadTimestamp) continue;

      if (isMentioned(message, { userAddress })) {
        spaceTotal++;

        // Early exit if we've hit the display threshold
        if (spaceTotal >= DISPLAY_THRESHOLD) {
          break; // Stop scanning messages in this channel
        }
      }
    }
  }

  // Store count (will be ≤ DISPLAY_THRESHOLD)
  if (spaceTotal > 0) {
    spaceCounts[space.spaceId] = spaceTotal;
  }
}
```

#### Performance Gains

**Best Case** (mentions in first channel): 10x faster
**Average Case** (mentions spread across channels): 3-5x faster
**Worst Case** (no mentions): No regression

**Example**:
- Space with 100 unread mentions across 10 channels
- **Current**: Scans all 10 channels completely
- **Optimized**: Stops after finding 10 mentions (potentially only 1-2 channels scanned)

#### Trade-offs

✅ **Pros**:
- Significant performance improvement for active spaces
- No visual impact (UI still shows "9+" correctly)
- Simple implementation
- Backwards compatible

⚠️ **Cons**:
- Loses exact count beyond 10 (acceptable - users only see "9+" anyway)
- Still scans up to 10 channels (not a complete solution for 100+ channels)

---

### Phase 2: Database-Level Filtering (Long-Term Solution)
**Priority**: 🟡 **MEDIUM** - Requires database schema changes
**Estimated Impact**: 10-50x performance improvement
**Effort**: 2-4 hours (DB indexing + query refactoring)

#### Current Problem

```typescript
// ❌ CURRENT: Fetch all messages, then filter in JavaScript
const { messages } = await messageDB.getMessages({
  spaceId,
  channelId,
  limit: 10000, // Fetches up to 10k messages
});

const unreadMentions = messages.filter((message: Message) => {
  if (message.createdDate <= lastReadTimestamp) return false;
  return isMentioned(message, { userAddress });
});
```

#### Proposed Solution

```typescript
// ✅ OPTIMIZED: Query only unread mentions directly
const unreadMentions = await messageDB.getUnreadMentions({
  spaceId,
  channelId,
  mentionedUser: userAddress,
  afterTimestamp: lastReadTimestamp,
  limit: 10 // Early-exit built into query
});
```

#### Implementation Steps

1. **Add Composite Index to IndexedDB**
   - Index: `[spaceId + channelId + mentionedUserId + createdDate]`
   - File: `src/db/messages.ts` (where indexes are defined)

2. **Create New Query Method**
   ```typescript
   // src/db/messages.ts
   async getUnreadMentions({
     spaceId,
     channelId,
     mentionedUser,
     afterTimestamp,
     limit = 10
   }: {
     spaceId: string;
     channelId: string;
     mentionedUser: string;
     afterTimestamp: number;
     limit?: number;
   }): Promise<Message[]> {
     // Use compound index to efficiently find:
     // 1. Messages in this channel
     // 2. That mention this user
     // 3. Created after timestamp
     // 4. Limit to N results (early-exit built-in)
   }
   ```

3. **Update Hook to Use New Query**
   - File: `src/hooks/business/mentions/useSpaceMentionCounts.ts`
   - Replace `getMessages()` + filter with `getUnreadMentions()`

#### Performance Analysis

**Current**:
- Fetch 10,000 messages (even if only 5 are unread mentions)
- Filter in JavaScript (linear scan through all messages)
- No early-exit

**Optimized**:
- IndexedDB uses compound index to jump directly to relevant messages
- Returns only unread mentions (typically 1-50 messages)
- Early-exit built into query limit

**Expected Improvement**: 10-50x faster for channels with >1000 messages

---

### Phase 3: Increase Stale Time (Configuration Tuning)
**Priority**: 🟢 **LOW** - Easy win, minimal impact
**Estimated Impact**: Reduces query frequency by 2-4x
**Effort**: 5 minutes (change 1 constant)

#### Current Configuration

```typescript
// src/hooks/business/mentions/useSpaceMentionCounts.ts:101
staleTime: 30000, // 30 seconds
```

#### Proposed Change

```typescript
staleTime: 90000, // 90 seconds (1.5 minutes)
```

#### Rationale

- Users rarely need **real-time** mention counts in the navbar
- Most messaging apps update notification badges every 1-2 minutes
- React Query still refetches on window focus (immediate updates when user returns)
- Reduces background query load by 3x

#### Trade-offs

✅ **Pros**: Less CPU usage, fewer database queries
⚠️ **Cons**: Up to 90s delay before new mentions appear (acceptable for navbar badges)

---

### Phase 4: Lazy Space Scanning (UX Optimization)
IMPORTANT: DO NOT IMPLEMENT THIS

**Priority**: 🟢 **LOW** - Requires UX changes, complex to implement
**Estimated Impact**: 5-10x faster initial load
**Effort**: 4-8 hours (state management + prefetching logic)

#### Current Behavior

```typescript
// NavMenu.tsx:42 - Scans ALL spaces on mount
const spaceMentionCounts = useSpaceMentionCounts({ spaces: mappedSpaces });
```

**Problem**: User with 20 spaces triggers 20 space scans simultaneously, even though only 1 space is visible.

#### Proposed Solution

**Progressive Disclosure**:
1. **On mount**: Only scan current/visible space
2. **On hover**: Prefetch mention count for hovered SpaceIcon
3. **On idle**: Background scan remaining spaces (low priority)

```typescript
// Pseudocode
const visibleSpaceIds = [currentSpaceId]; // Only current space
const hoveredSpaceIds = useHoverPrefetch(); // Prefetch on hover
const allSpaceIds = spaces.map(s => s.spaceId);

// Priority 1: Visible space (immediate)
const { data: visibleCounts } = useSpaceMentionCounts({
  spaces: spaces.filter(s => visibleSpaceIds.includes(s.spaceId)),
  enabled: true,
});

// Priority 2: Hovered spaces (prefetch)
const { data: hoveredCounts } = useSpaceMentionCounts({
  spaces: spaces.filter(s => hoveredSpaceIds.includes(s.spaceId)),
  enabled: hoveredSpaceIds.length > 0,
});

// Priority 3: Remaining spaces (background, low priority)
const { data: backgroundCounts } = useSpaceMentionCounts({
  spaces: spaces.filter(s =>
    !visibleSpaceIds.includes(s.spaceId) &&
    !hoveredSpaceIds.includes(s.spaceId)
  ),
  enabled: visibleCounts !== undefined, // Only after visible space loads
});

// Merge counts
const allCounts = { ...backgroundCounts, ...hoveredCounts, ...visibleCounts };
```

#### Performance Gains

**Before**: Scan 20 spaces × 10 channels = 200 channel queries on mount
**After**: Scan 1 space × 10 channels = 10 channel queries on mount
**Speedup**: 20x faster initial load

#### Trade-offs

✅ **Pros**: Dramatically faster app launch
⚠️ **Cons**:
- Mention bubbles appear gradually (not all at once)
- More complex state management
- Requires careful UX design to avoid "jumping" UI

---

### Phase 5: Web Worker for Scanning (Advanced)
IMPORTANT: DO NOT IMPLEMENT THIS

**Priority**: 🔵 **VERY LOW** - High complexity, moderate impact
**Estimated Impact**: 2-3x improvement (prevents UI thread blocking)
**Effort**: 8-16 hours (threading + message passing)

#### Problem
Heavy filtering blocks UI thread → app feels sluggish during scans

#### Solution
Move mention counting to Web Worker

#### Trade-offs
- ✅ **Pros**: Non-blocking UI
- ⚠️ **Cons**: High complexity, IndexedDB access from worker requires SharedArrayBuffer or message passing

**Recommendation**: Only implement if Phases 1-4 insufficient

---

## Recommended Implementation Order

### Immediate (This Sprint)
1. ✅ **Phase 1: Early-Exit** - 30 minutes, 3-5x improvement
2. ✅ **Phase 3: Increase Stale Time** - 5 minutes, reduces query frequency

**Combined Impact**: 3-5x faster, with 3x fewer queries

### Next Sprint
3. ✅ **Phase 2: Database Filtering** - 2-4 hours, 10-50x improvement

**Combined Impact with Phase 1**: 30-250x improvement for large channels

### Future (If Needed)
4. ⚠️ **Phase 4: Lazy Scanning** - Only if user base grows to 50+ spaces per user
5. ⚠️ **Phase 5: Web Worker** - Only if UI blocking still occurs after Phase 1-3

---

## Success Metrics

### Before Optimization
- Time to calculate mention counts for 10 spaces: **800ms**
- Messages scanned per query: **50,000** (5 spaces × 10 channels × 1k messages)
- Query frequency: Every **30 seconds**

### After Phase 1 + 3
- Time to calculate mention counts: **200ms** (4x faster)
- Messages scanned: **5,000** (10x fewer - early exit at 10 mentions per space)
- Query frequency: Every **90 seconds** (3x less frequent)

### After Phase 2
- Time to calculate mention counts: **50ms** (16x faster than Phase 1)
- Messages scanned: **50** (1000x fewer - database returns only relevant messages)
- Query frequency: Every **90 seconds**

---

## Testing Plan

### Phase 1 Testing
1. **Unit Tests**: Verify early-exit stops at 10 mentions
2. **Integration Tests**: Confirm UI displays "9+" correctly
3. **Performance Tests**: Measure time for spaces with 10, 50, 100+ mentions

### Phase 2 Testing
1. **Database Tests**: Verify compound index query performance
2. **Migration Tests**: Ensure existing data works with new index
3. **Benchmark Tests**: Compare query times before/after

### Phase 3 Testing
1. **UX Tests**: Verify 90s stale time acceptable for users
2. **Focus Tests**: Confirm refetch on window focus works

---

## Open Questions

1. **Early-Exit Threshold**: Should it be 10 (matches "9+") or higher (e.g., 15 for buffer)?
2. **Database Schema**: Does IndexedDB support compound indexes efficiently? Need to test.
3. **Channel Ordering**: Should we scan channels in any particular order (e.g., most active first)?
4. **Stale Time**: Is 90s too aggressive? Should we A/B test 60s vs 90s vs 120s?
5. **Lazy Loading**: Do we need visual feedback while mention counts load progressively?

---

## Related Documentation

- **[Mention Notification System](../docs/features/mention-notification-system.md)** - Architecture overview
- **[Data Management Architecture](../docs/data-management-architecture-guide.md)** - IndexedDB patterns
- **Performance Concerns**: Lines 252-254 of mention-notification-system.md

---

_Created: 2025-10-12_
_Last Updated: 2025-10-12_
