# Mute DM Conversation

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent

**Status**: Pending
**Complexity**: Medium
**Created**: 2026-01-04
**Files**:
- `src/db/messages.ts:47-85` (UserConfig type)
- `src/hooks/business/dm/useDMFavorites.ts` (pattern reference)
- `src/hooks/business/dm/useDMMute.ts` (new file)
- `src/hooks/business/messages/useDirectMessageUnreadCount.ts:17-60`
- `src/components/direct/DirectMessageContactsList.tsx:36-261`
- `src/components/modals/ConversationSettingsModal.tsx:34-277`
- `src/services/MessageService.ts` (desktop notification filtering)
- `src/services/NotificationService.ts` (notification count)

## What & Why

Users currently cannot mute DM conversations they want to keep but don't want notifications from. This causes notification fatigue when users have active conversations with contacts they don't need immediate alerts for (e.g., low-priority contacts, group chat spillover, bot accounts). This feature adds per-user DM conversation muting with: (1) mute/unmute via context menu and settings modal, (2) suppress unread indicators for muted conversations, (3) suppress desktop notifications from muted conversations, and (4) filter to view muted conversations. The feature uses the existing `save-user-config` Action Queue pattern for offline support and persistence.

## Context

- **Existing pattern**: `useDMFavorites` hook is the **exact pattern to follow** - same data structure, same Action Queue integration, same optimistic UI pattern
- **Channel mute system**: Already implemented for spaces via `useChannelMute` hook - similar concept, different scope
- **User mute system**: Space-level user muting exists but is unrelated (client-enforced message hiding, not notification suppression)
- **Desktop notifications**: Currently only DM posts trigger notifications - muted conversations should be excluded
- **Filter system**: DM list already has filters (All, Favorites, DM Requests) - add "Muted" filter

## Prerequisites

- [ ] Review `src/hooks/business/dm/useDMFavorites.ts` for exact pattern to follow
- [ ] Review `src/hooks/business/channels/useChannelMute.ts` for reference
- [ ] Review `.agents/docs/features/unread-message-indicators.md` for unread system
- [ ] Review `.agents/docs/features/desktop-notifications.md` for notification filtering
- [ ] Branch created from `develop`

## Implementation

### Phase 1: Data Model (foundation)

- [ ] **Add mutedConversations to UserConfig type** (`src/db/messages.ts:84`)
  - Done when: `UserConfig` includes `mutedConversations?: string[]`
  - Add after `favoriteDMs` field with comment: `// Muted DM conversation IDs (no unread indicators or notifications)`
  - Structure: Simple array of conversationId strings (same as favoriteDMs)

### Phase 2: Hook Implementation (requires Phase 1)

- [ ] **Create useDMMute hook** (`src/hooks/business/dm/useDMMute.ts`)
  - Done when: Hook exports `isMuted`, `toggleMute`, `mutedSet`, `muted` array
  - **Copy `useDMFavorites.ts` exactly** and adapt:
    - Replace `favoriteDMs` → `mutedConversations`
    - Replace `favorites` → `muted`
    - Replace `isFavorite` → `isMuted`
    - Replace `addFavorite` → `muteConversation`
    - Replace `removeFavorite` → `unmuteConversation`
    - Replace `toggleFavorite` → `toggleMute`
  - Uses same Action Queue pattern with `save-user-config` action type
  - Uses same optimistic UI pattern with `queryClient.setQueryData`
  - Same dedup key pattern: `config:${userAddress}`
  - **Add cache invalidation** after optimistic update (critical for immediate UI feedback):
    ```typescript
    // After queryClient.setQueryData, invalidate unread count queries
    queryClient.invalidateQueries({
      queryKey: ['unread-counts', 'direct-messages', userAddress],
    });
    ```

- [ ] **Export hook from index** (`src/hooks/business/dm/index.ts`)
  - Done when: `export { useDMMute } from './useDMMute';`

### Phase 3: Context Menu Integration (requires Phase 2)

- [ ] **Add mute option to DM context menu** (`src/components/direct/DirectMessageContactsList.tsx:211-248`)
  - Done when: Context menu shows "Mute Conversation" / "Unmute Conversation" option
  - Import `useDMMute` hook alongside `useDMFavorites` (line 23)
  - Add to `getContextMenuItems` function after favorites option:
    ```typescript
    {
      id: 'mute',
      icon: muted ? 'bell' : 'bell-off',
      label: muted ? t`Unmute Conversation` : t`Mute Conversation`,
      onClick: () => toggleMute(conversationId),
    },
    ```
  - Icon logic: `bell-off` when unmuted (to mute), `bell` when muted (to unmute)

### Phase 4: Settings Modal Integration (requires Phase 2)

- [ ] **Add mute toggle to ConversationSettingsModal** (`src/components/modals/ConversationSettingsModal.tsx`)
  - Done when: Switch toggle controls mute status in modal
  - Import `useDMMute` hook
  - Add hook and check mute status:
    ```typescript
    const { isMuted, toggleMute } = useDMMute();
    const muted = isMuted(conversationId);
    ```
  - Add Switch component after "Always sign messages" toggle (after line 208):
    ```tsx
    <FlexRow gap="sm" align="center" className="mb-3">
      <Switch
        value={muted}
        onChange={() => toggleMute(conversationId)}
      />
      <FlexRow gap="sm" align="center">
        <div className="text-label-strong">
          {t`Mute conversation`}
        </div>
        <Tooltip
          id="conv-mute-tooltip"
          content={t`When muted, new messages won't show unread indicators or desktop notifications.`}
          maxWidth={260}
          className="!text-left !max-w-[260px]"
          place="top"
        >
          <Icon name="info-circle" size="sm" />
        </Tooltip>
      </FlexRow>
    </FlexRow>
    ```

### Phase 5: Unread Count Suppression (requires Phase 2)

- [ ] **Filter muted conversations from unread count** (`src/hooks/business/messages/useDirectMessageUnreadCount.ts`)
  - Done when: Muted conversations don't contribute to NavMenu DM badge count
  - Import `useConfig` and `buildConfigKey` from queries
  - Get user config for muted list
  - Add filter in queryFn (after line 36):
    ```typescript
    const mutedSet = new Set(config?.mutedConversations || []);

    for (const conversation of conversationsList) {
      // Skip muted conversations
      if (mutedSet.has(conversation.conversationId)) continue;

      const isUnread = (conversation.lastReadTimestamp ?? 0) < conversation.timestamp;
      if (isUnread) {
        unreadCount++;
      }
    }
    ```
  - Add `config` to query dependencies

- [ ] **Filter muted from visual unread dot** (`src/components/direct/DirectMessageContactsList.tsx:351`)
  - Done when: Muted conversations don't show unread dot even with new messages
  - Update `unread` prop calculation:
    ```typescript
    unread={(c.lastReadTimestamp ?? 0) < c.timestamp && !mutedSet.has(c.conversationId)}
    ```
  - Create `mutedSet` from `useDMMute` hook at component level

### Phase 6: Desktop Notification Suppression (requires Phase 2)

- [ ] **Filter muted conversations from desktop notifications** (`src/services/MessageService.ts`)
  - Done when: DM posts from muted conversations don't trigger desktop notifications
  - **Implementation approach**: Pass `mutedConversations` to MessageService via dependencies
  - In `MessageServiceDependencies` interface, add optional `mutedConversations?: Set<string>`
  - In `addMessage` method where `incrementPendingNotificationCount()` is called (lines ~2102, ~3545):
    - Before calling increment, check: `if (!this.deps.mutedConversations?.has(conversationId))`
    - Only increment notification count for non-muted conversations
  - **Alternative approach** (if dependency injection is complex):
    - Add `setMutedConversations(Set<string>)` method to `NotificationService`
    - Call it from React layer when muted conversations change
    - Check in `incrementPendingNotificationCount()` before incrementing

- [ ] **Wire muted conversations to MessageService** (`src/components/context/MessageDB.tsx` or `WebsocketProvider.tsx`)
  - Done when: MessageService receives updated muted conversations list
  - Use React Query subscription or effect to update MessageService when config changes
  - Example:
    ```typescript
    // In component with access to config
    const { data: config } = useConfig({ userAddress });
    useEffect(() => {
      if (config?.mutedConversations) {
        messageService.setMutedConversations(new Set(config.mutedConversations));
      }
    }, [config?.mutedConversations]);
    ```

### Phase 7: Filter System Enhancement (requires Phase 2)

- [ ] **Add "Muted" filter option** (`src/components/direct/DirectMessageContactsList.tsx:36-37,257-261`)
  - Done when: Filter dropdown includes "Muted" option
  - Update `FilterType`: `type FilterType = 'all' | 'favorites' | 'unknown' | 'muted';`
  - Add to `filterOptions` (line 257-261):
    ```typescript
    { value: 'muted', label: t`Muted` },
    ```
  - Add filter logic in `filteredConversations` memo (after line 103):
    ```typescript
    } else if (filter === 'muted') {
      result = result.filter((c) => mutedSet.has(c.conversationId));
    }
    ```

- [ ] **Conditionally show filters based on data** (`src/components/direct/DirectMessageContactsList.tsx:257-261`)
  - Done when: Filters only appear if they have matching conversations
  - Calculate filter availability:
    ```typescript
    const hasFavorites = enhancedConversations.some((c) => favoritesSet.has(c.conversationId));
    const hasRequests = enhancedConversations.some((c) => isUnknownUser(c.displayName));
    const hasMuted = enhancedConversations.some((c) => mutedSet.has(c.conversationId));
    const hasAnyFilter = hasFavorites || hasRequests || hasMuted;
    ```
  - Build `filterOptions` dynamically:
    ```typescript
    const filterOptions = React.useMemo(() => {
      const options = [{ value: 'all', label: t`All` }];
      if (hasFavorites) options.push({ value: 'favorites', label: t`Favorites` });
      if (hasRequests) options.push({ value: 'unknown', label: t`Unknown` });
      if (hasMuted) options.push({ value: 'muted', label: t`Muted` });
      return options;
    }, [hasFavorites, hasRequests, hasMuted]);
    ```
  - Hide filter dropdown entirely if no filters available (only "All"):
    - Conditionally render `Select` component only when `hasAnyFilter`

- [ ] **Auto-reset filter when active option disappears** (`src/components/direct/DirectMessageContactsList.tsx`)
  - Done when: Filter resets to "All" if current filter has no matching conversations
  - Add effect after `filteredConversations` memo:
    ```typescript
    // Reset filter if active option becomes unavailable
    React.useEffect(() => {
      if (filter === 'muted' && !hasMuted) {
        setFilter('all');
      } else if (filter === 'favorites' && !hasFavorites) {
        setFilter('all');
      } else if (filter === 'unknown' && !hasRequests) {
        setFilter('all');
      }
    }, [filter, hasMuted, hasFavorites, hasRequests]);
    ```

## Verification

✅ **Context menu mute works**
  - Test: Right-click DM contact → shows "Mute Conversation"
  - Test: Click "Mute Conversation" → option changes to "Unmute Conversation"
  - Test: Long-press on touch → same behavior

✅ **Settings modal mute works**
  - Test: Open conversation settings → mute toggle visible
  - Test: Toggle mute → state persists after closing/reopening modal

✅ **Unread suppression works**
  - Test: Mute conversation with unread messages → unread dot disappears
  - Test: Receive new message in muted conversation → no unread dot appears
  - Test: NavMenu DM badge count excludes muted conversations

✅ **Desktop notification suppression works**
  - Test: Mute conversation → receive DM → no desktop notification
  - Test: Unmute conversation → receive DM → desktop notification appears

✅ **Filter system works**
  - Test: Mute a conversation → "Muted" filter appears in dropdown
  - Test: Select "Muted" filter → only muted conversations shown
  - Test: Unmute all → "Muted" filter disappears from dropdown
  - Test: Unmute all while "Muted" filter active → filter auto-resets to "All"
  - Test: No favorites → "Favorites" filter not shown
  - Test: No requests → "Unknown" filter not shown

✅ **Cache invalidation works**
  - Test: Mute conversation → NavMenu DM badge updates immediately (no 90s delay)
  - Test: Unmute conversation → badge updates immediately

✅ **Persistence works**
  - Test: Mute conversation → reload app → conversation still muted
  - Test: (If sync enabled) Mute on Device A → check Device B → muted there too

✅ **TypeScript compiles**
  - Run: `npx tsc --noEmit --jsx react-jsx --skipLibCheck`

✅ **No console errors**

## Edge Cases

| Scenario | Expected Behavior | Priority |
|----------|-------------------|----------|
| Mute conversation currently viewing | Conversation remains viewable, unread dot hidden | P1 |
| Delete muted conversation | Mute entry cleaned up (or orphan is harmless) | P2 |
| Mute then receive multiple messages | No unread indicators, no notifications | P1 |
| Filter to "Muted" with no muted convos | Filter option not shown | P1 |
| All filters empty except "All" | Hide filter dropdown entirely | P2 |
| Mute conversation offline | Action queued, applies when online | P1 |
| Rapid mute/unmute toggles | Dedup key collapses to final state | P1 |

## Definition of Done

- [ ] `useDMMute` hook implemented following `useDMFavorites` pattern exactly
- [ ] Hook includes cache invalidation for unread counts
- [ ] Context menu shows mute/unmute option
- [ ] ConversationSettingsModal has mute toggle
- [ ] Muted conversations don't show unread indicators
- [ ] Muted conversations don't count in NavMenu DM badge
- [ ] Muted conversations don't trigger desktop notifications
- [ ] "Muted" filter available when muted conversations exist
- [ ] All filters conditionally shown based on data availability
- [ ] Filter auto-resets when active option becomes unavailable
- [ ] Mute state persists across sessions (Action Queue)
- [ ] TypeScript compiles without errors
- [ ] No console errors

---

## Implementation Notes

_To be updated during implementation_

---

## Updates

**2026-01-04 - Claude**: Initial task creation based on deep dive exploration. Key decisions:
- Follow `useDMFavorites` pattern exactly for hook implementation
- Use `save-user-config` Action Queue action (already supports offline)
- Store as `mutedConversations?: string[]` in UserConfig (parallel to `favoriteDMs`)
- Desktop notification suppression requires WebSocketProvider coordination
- Filter visibility enhancement applies to all filters (favorites, requests, muted)

**2026-01-04 - Claude**: Feature-analyzer review incorporated. Changes made:
- **Added cache invalidation**: Hook must invalidate `['unread-counts', 'direct-messages']` query after mute/unmute for immediate UI feedback
- **Clarified desktop notification filtering**: Specified concrete implementation approach (pass `mutedConversations` to MessageService or add `setMutedConversations` to NotificationService)
- **Removed Phase 8 (visual indicator)**: Per user request, no opacity styling for muted conversations in this version
- **Added filter auto-reset logic**: Effect to reset filter to "All" when active filter option becomes unavailable
- **Fixed Settings Modal code**: Removed unused `address` variable extraction
- **Security verified**: `conversationId` format is `address/address` (public wallet address only, same as `favoriteDMs`) - no sensitive data exposure

---

_Created: 2026-01-04_
_Updated: 2026-01-04_
