# Unify Unread Message Indicators: Channels & DMs

**Created**: 2025-01-13
**Status**: Planning
**Priority**: High
**Complexity**: Medium
**Estimated Time**: 4-6 hours

## Problem Statement

The unread message indicator feature is implemented inconsistently between Channels (new implementation) and Direct Messages (old implementation), leading to:

1. **Different data models**: Channels use database cursor iteration, DMs use simple timestamp comparison
2. **Different visual styling**: Inconsistent dot sizing, positioning, and CSS approach
3. **Incomplete DM implementation**: Missing read-time tracking and cache invalidation
4. **Over-engineered channel logic**: Complex periodic tracking when simpler approach exists
5. **Code duplication**: Unread logic exists in multiple places with different patterns

## Analysis Conclusion

After deep analysis, the **OLD DM data model is superior** but incomplete:

### DM Approach (Better Core Model)
- ✅ Uses `conversation.timestamp` (auto-updates on every message save)
- ✅ Simple comparison: `(lastReadTimestamp ?? 0) < timestamp`
- ✅ Instant updates (no polling delays)
- ✅ Minimal database overhead
- ❌ Missing read-time tracking in DirectMessage.tsx
- ❌ Missing cache invalidation on new messages

### Channel Approach (Over-engineered)
- ❌ Uses `hasUnreadMessages()` database method with cursor iteration
- ❌ Periodic polling (2-second intervals)
- ❌ Complex ref tracking and mutation hooks
- ❌ Performance overhead for boolean check
- ✅ Proper read-time tracking with `useUpdateReadTime`
- ✅ Comprehensive cache invalidation

## Recommended Unified Approach

**Use the DM data model for EVERYTHING** and add the missing pieces from channels:

```typescript
// Universal unread check (works for channels AND DMs):
const isUnread = (conversation.lastReadTimestamp ?? 0) < conversation.timestamp

// Where:
// - conversation.timestamp = auto-updated on message save (free!)
// - conversation.lastReadTimestamp = tracked via useUpdateReadTime hook
```

This eliminates the need for `hasUnreadMessages()` database method entirely.

---

## Implementation Plan

### Phase 1: Add Missing DM Infrastructure (2 hours)

#### 1.1. Add Read-Time Tracking to DirectMessage.tsx

**File**: `src/components/direct/DirectMessage.tsx`

```typescript
// Add import
import { useUpdateReadTime } from '../../hooks';

// Add hook (same pattern as Channel.tsx)
const { mutate: updateReadTime } = useUpdateReadTime({
  spaceId: address!,
  channelId: address!
});

// Add refs for tracking (same as Channel.tsx:689-691)
const latestTimestampRef = useRef<number>(0);
const lastSavedTimestampRef = useRef<number>(0);

// Add periodic save effect (same as Channel.tsx:706-720)
useEffect(() => {
  const intervalId = setInterval(() => {
    if (
      latestTimestampRef.current > 0 &&
      latestTimestampRef.current > lastSavedTimestampRef.current
    ) {
      updateReadTime(latestTimestampRef.current);
      lastSavedTimestampRef.current = latestTimestampRef.current;
    }
  }, 2000);

  return () => clearInterval(intervalId);
}, [updateReadTime]);

// Add unmount save effect (same as Channel.tsx:723-731)
useEffect(() => {
  return () => {
    if (latestTimestampRef.current > lastSavedTimestampRef.current) {
      updateReadTime(latestTimestampRef.current);
    }
  };
}, [updateReadTime]);
```

**Pass refs to MessageList** for timestamp tracking (same as Channel.tsx passes to MessageList).

#### 1.2. Add DM Cache Invalidation to MessageService

**File**: `src/services/MessageService.ts`

**Location**: Around line 867-872 (where channel cache invalidation happens)

```typescript
// When DM messages arrive, add:
if (conversationId.includes('/') && !message.spaceId.startsWith('0x')) {
  // This is a DM conversation
  await queryClient.invalidateQueries({
    queryKey: ['unread-counts', 'direct-messages'],
  });
}
```

---

### Phase 2: Simplify Channel Implementation (1.5 hours)

#### 2.1. Remove `hasUnreadMessages()` Database Method

**File**: `src/db/messages.ts`

**Action**: Delete entire `hasUnreadMessages()` method (lines ~1050-1110)

#### 2.2. Simplify `useChannelUnreadCounts` Hook

**File**: `src/hooks/business/messages/useChannelUnreadCounts.ts`

**Replace database call**:

```typescript
// OLD (complex cursor iteration):
const hasUnread = await messageDB.hasUnreadMessages({
  conversationId,
  lastReadTimestamp,
});

// NEW (simple timestamp comparison):
const conversation = await messageDB.getConversation({ conversationId });
const hasUnread = conversation.conversation
  ? (conversation.conversation.lastReadTimestamp ?? 0) < conversation.conversation.timestamp
  : false;
```

This changes from O(n) cursor iteration to O(1) single record lookup.

#### 2.3. Simplify `useSpaceUnreadCounts` Hook

**File**: `src/hooks/business/messages/useSpaceUnreadCounts.ts`

**Apply same simplification**:
- Remove cursor iteration loops
- Use direct conversation timestamp comparison
- Early-exit optimization still works (stop at first unread)

---

### Phase 3: Unify Visual Styling (1.5 hours)

#### 3.1. Create Shared SCSS for Unread Dots

**File**: `src/styles/_unread-indicators.scss` (NEW)

```scss
@use './variables' as *;

// Shared unread dot styling for channels and DMs
.unread-dot {
  position: absolute;
  width: $s-1-5;  // 6px
  height: $s-1-5;
  border-radius: $rounded-full;
  background: var(--accent);
  z-index: 10;
  transition: all $duration-100 linear;
}

// Channel-specific positioning
.channel-unread-dot {
  @extend .unread-dot;
  left: -$s-3-5;
  top: 50%;
  transform: translateY(-50%);
}

// DM contact-specific positioning
.dm-unread-dot {
  @extend .unread-dot;
  left: -$s-1-5;
  top: 50%;
  transform: translateY(-50%);
  margin-top: $s-1;
}
```

#### 3.2. Update DirectMessageContact Component

**File**: `src/components/direct/DirectMessageContact.tsx`

**Replace inline Tailwind dots** (line 31-33):

```tsx
// OLD:
{props.unread && address !== props.address && (
  <div className="w-1 h-1 mt-4 absolute ml-[-6pt] bg-accent rounded-full"></div>
)}

// NEW:
{props.unread && address !== props.address && (
  <div className="dm-unread-dot" title="Unread messages" />
)}
```

**Remove bold text styling** (line 45-47) or apply consistently to channels too.

#### 3.3. Update ChannelItem to Use Shared Styles

**File**: `src/components/space/ChannelGroup.scss`

**Replace `.channel-unread-dot` definition** with:

```scss
@use '../../styles/unread-indicators' as *;
// .channel-unread-dot is now imported from shared styles
```

---

### Phase 4: Consolidate Unread Logic (1 hour)

#### 4.1. Create Unified Hook (Optional but Recommended)

**File**: `src/hooks/business/messages/useUnreadStatus.ts` (NEW)

```typescript
import { useQuery } from '@tanstack/react-query';
import { useMessageDB } from '../../../components/context/useMessageDB';

/**
 * Unified hook to check unread status for any conversation (channel or DM)
 * Uses simple timestamp comparison for optimal performance
 */
export function useUnreadStatus({
  conversationId,
  userAddress,
}: {
  conversationId: string;
  userAddress: string;
}): boolean {
  const { messageDB } = useMessageDB();

  const { data } = useQuery({
    queryKey: ['unread-status', conversationId, userAddress],
    queryFn: async () => {
      const conversation = await messageDB.getConversation({ conversationId });

      if (!conversation.conversation) return false;

      const lastRead = conversation.conversation.lastReadTimestamp ?? 0;
      const lastMessage = conversation.conversation.timestamp;

      return lastRead < lastMessage;
    },
    enabled: !!conversationId && !!userAddress,
    staleTime: 90000,
    refetchOnWindowFocus: true,
  });

  return data ?? false;
}
```

**This single hook** can replace both `useChannelUnreadCounts` and `useDirectMessageUnreadCount` over time.

---

### Phase 5: Update Documentation (30 minutes)

#### 5.1. Update Feature Documentation

**File**: `.agents/docs/features/unread-message-indicators.md`

**Changes**:
- Document the unified data model
- Remove references to `hasUnreadMessages()` method
- Add DM read-time tracking details
- Update performance characteristics
- Document shared styling approach

**Add section**:
```markdown
## Unified Data Model

Both channels and DMs use the same elegant approach:

- `conversation.timestamp` - Auto-updated on every message save
- `conversation.lastReadTimestamp` - Updated via `useUpdateReadTime` hook
- Unread check: `(lastReadTimestamp ?? 0) < timestamp`

This eliminates the need for database cursor iteration and provides instant,
accurate unread status with minimal overhead.
```

#### 5.2. Create Migration Notes

**File**: `.agents/docs/migrations/unread-indicator-unification.md` (NEW)

Document:
- What changed and why
- Performance improvements
- Breaking changes (none expected)
- Database query optimization details

---

## Expected Benefits

### Performance Improvements
- **90% reduction** in unread check complexity (O(n) → O(1))
- **Instant updates** instead of 2-second polling delays
- **50% less code** (~150 lines removed, ~50 lines added)
- **Lower memory usage** (no cursor iteration state)

### Code Quality Improvements
- **Single source of truth** for unread logic
- **Consistent behavior** between channels and DMs
- **Shared styling** via SCSS modules
- **Better maintainability** with unified approach

### User Experience Improvements
- **Consistent visual design** across all conversations
- **More responsive** unread indicators (instant vs delayed)
- **Reliable tracking** for DMs (currently broken)

---

## Testing Checklist

### Functionality Tests
- [ ] Channel unread dots appear when new messages arrive
- [ ] Channel dots disappear when reading channel
- [ ] DM unread dots appear when new DM messages arrive
- [ ] DM dots disappear when reading DM conversation
- [ ] Space icons show dot when any channel has unreads
- [ ] NavMenu DM icon shows dot when any DM has unreads
- [ ] Dots hide when conversation is currently active
- [ ] Unread status persists across app restarts

### Performance Tests
- [ ] No performance degradation with 100+ channels
- [ ] No excessive database queries (check console)
- [ ] Cache invalidation triggers correctly
- [ ] No memory leaks from intervals/refs

### Visual Tests
- [ ] Dots are same size (6px) for channels and DMs
- [ ] Dots are positioned consistently
- [ ] Dots use correct color (`--accent`)
- [ ] Responsive positioning works on mobile/tablet/desktop
- [ ] Animations are smooth

### Edge Cases
- [ ] Works with conversations that have no messages
- [ ] Works with newly created channels/DMs
- [ ] Handles rapid message arrival correctly
- [ ] Survives WebSocket disconnects/reconnects

---

## Files Modified Summary

### New Files (3)
- `src/styles/_unread-indicators.scss` - Shared styling
- `src/hooks/business/messages/useUnreadStatus.ts` - Unified hook (optional)
- `.agents/docs/migrations/unread-indicator-unification.md` - Migration docs

### Modified Files (8)
- `src/components/direct/DirectMessage.tsx` - Add read-time tracking
- `src/components/direct/DirectMessageContact.tsx` - Use shared styles
- `src/services/MessageService.ts` - Add DM cache invalidation
- `src/hooks/business/messages/useChannelUnreadCounts.ts` - Simplify logic
- `src/hooks/business/messages/useSpaceUnreadCounts.ts` - Simplify logic
- `src/components/space/ChannelGroup.scss` - Import shared styles
- `.agents/docs/features/unread-message-indicators.md` - Update docs
- `src/hooks/business/messages/index.ts` - Export unified hook

### Deleted Code (1)
- `src/db/messages.ts` - Remove `hasUnreadMessages()` method (~60 lines)

---

## Rollback Plan

If issues arise:

1. **Keep old channel implementation** in parallel during testing
2. **Feature flag** to toggle between old/new approach
3. **Database method** can be restored from git history
4. **No database schema changes** required (safe rollback)

---

## Future Enhancements

After unification, these become easier:

1. **Unread counts** (not just boolean) for power users
2. **Smart notifications** based on unread thresholds
3. **Batch read marking** (mark all as read)
4. **Unread message filtering** (show only unread conversations)
5. **Cross-device sync** for read status

---

**Notes**:
- All changes are backward compatible
- No database migrations required
- Existing read timestamps are preserved
- Can be implemented incrementally (phase by phase)

---

_Last updated: 2025-01-13_
