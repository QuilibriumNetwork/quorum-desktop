# Pinned Messages Feature

## Overview

The pinned messages feature allows space owners to pin important messages within channels, making them easily accessible through a dedicated panel. This Discord-like functionality helps prioritize key information and announcements within conversations.

## User Experience

- **Space owners only**: Only users with space owner permissions can pin/unpin messages
- **Pin from message actions**: Hover over any message to reveal pin/unpin button (thumbtack icon)
- **Visual indicators**: Pinned messages show a thumbtack icon next to the sender name
- **Pinned messages panel**: Access all pinned messages via thumbtack button in channel header
- **Quick navigation**: Jump directly to pinned messages in the conversation
- **Confirmation feedback**: Shows "Pinned!" and "Unpinned!" tooltips after actions

## Architecture

### Database Layer

**File: `src/db/messages.ts`**

- Database schema version bumped from 2 to 3
- Added `by_channel_pinned` index (created but not actively used due to IndexedDB limitations)
- Three new methods:
  - `getPinnedMessages()`: Retrieves all pinned messages for a channel (uses `by_conversation_time` index with filtering)
  - `updateMessagePinStatus()`: Updates pin status with metadata
  - `getPinnedMessageCount()`: Returns count of pinned messages (uses `by_conversation_time` index with filtering)

**Message fields added:**

- `isPinned?: boolean` - Whether message is pinned
- `pinnedAt?: number` - Timestamp when message was pinned
- `pinnedBy?: string` - Address of user who pinned the message

**Implementation Note:** While a dedicated `by_channel_pinned` index was created, the implementation uses the existing `by_conversation_time` index and filters results in memory. This approach was chosen for reliability as IndexedDB has limitations with boolean values in compound index keys.

### API Types

**File: `src/api/quorumApi.ts`**

- Extended `Message` type with pin-related fields
- Added `PinMessage` type for future system message implementation:
  ```typescript
  type PinMessage = {
    senderId: string;
    type: 'pin';
    targetMessageId: string;
    action: 'pin' | 'unpin';
  };
  ```

### Business Logic

**File: `src/hooks/business/messages/usePinnedMessages.ts`**

Main hook managing all pinned message functionality:

**Key features:**

- React Query integration with optimistic updates
- Permission checking (space owner validation)
- Pin limit enforcement (50 messages maximum, configurable via `PINNED_MESSAGES_CONFIG.MAX_PINS`)
- Automatic query invalidation for real-time updates
- Comprehensive error handling with try-catch blocks and validation
- Error state exposure via `pinError` and `unpinError` properties

**Exported functions:**

- `pinnedMessages`: Array of pinned messages (sorted by creation date, newest first)
- `pinnedCount`: Count of pinned messages
- `canPinMessages`: Boolean indicating user permissions
- `pinMessage(messageId)`: Pin a message
- `unpinMessage(messageId)`: Unpin a message
- `togglePin(message)`: Smart toggle based on current state

**Query invalidation strategy:**

```typescript
// Critical: Uses correct case-sensitive query keys
queryClient.invalidateQueries({
  queryKey: ['pinnedMessages', spaceId, channelId],
});
queryClient.invalidateQueries({
  queryKey: ['pinnedMessageCount', spaceId, channelId],
});
queryClient.invalidateQueries({ queryKey: ['Messages', spaceId, channelId] }); // Capital 'M'
```

### UI Components

#### Message Integration

**File: `src/components/message/Message.tsx`**

- Integrates `usePinnedMessages` hook
- Displays thumbtack icon next to sender name for pinned messages
- Passes pin functionality to MessageActions component

**File: `src/components/message/MessageActions.tsx`**

- Adds pin/unpin button to message hover actions
- Shows confirmation tooltips ("Pinned!" / "Unpinned!")
- Icon changes based on pin state: `thumbtack` → `thumbtack-slash`
- Color changes: muted → accent blue when pinned
- Confirmation duration configurable via `MESSAGE_ACTIONS_CONFIG.PIN_CONFIRMATION_DURATION` (2000ms)

#### Channel Header

**File: `src/components/space/Channel.tsx`**

- Thumbtack button in header shows pin count badge
- Opens PinnedMessagesPanel when clicked
- Button color changes based on pin count (accent when > 0)

#### Pinned Messages Panel

**File: `src/components/message/PinnedMessagesPanel.tsx`**
**File: `src/components/message/PinnedMessagesPanel.scss`**

Full-featured panel displaying all pinned messages:

**Features:**

- Message preview with sender name and original post date
- Jump-to-message functionality with smooth scrolling and highlight effect
- Unpin functionality (only visible to space owners)
- Empty states for loading and no pinned messages
- Uses reusable DropdownPanel component
- Text preview truncation at 800 characters (configurable via `PINNED_PANEL_CONFIG.TEXT_PREVIEW_LENGTH`)
- Mobile tooltip auto-hide after 3000ms (configurable via `PINNED_PANEL_CONFIG.TOOLTIP_DURATION_MOBILE`)

**Layout:**

- Header: Count of pinned messages with close button
- List: Individual message items with actions
- Actions: Jump (arrow-right) and Unpin (times icon) buttons
- Styling: Consistent with search results appearance

### Reusable Components

#### DropdownPanel Component

**File: `src/components/DropdownPanel.tsx`**
**File: `src/components/DropdownPanel.scss`**

Shared component used by both SearchResults and PinnedMessagesPanel:

**Props:**

- `isOpen`: Controls visibility
- `position`: 'absolute' or 'fixed'
- `positionStyle`: 'search-results', 'right-aligned', or 'centered'
- `maxWidth/maxHeight`: Size constraints
- `title/resultsCount`: Header content
- `showCloseButton`: Optional close button

**Benefits:**

- Consistent positioning and animation across dropdowns
- Unified keyboard (Escape) and outside-click handling
- Standardized styling and responsive behavior

#### Updated SearchResults

**File: `src/components/search/SearchResults.tsx`**
**File: `src/components/search/SearchResults.scss`**

Refactored to use DropdownPanel for consistency:

- Removed duplicate positioning and styling code
- Uses `right-aligned` positioning to prevent off-screen issues
- Maintains all existing search functionality

### Icon System

**Files: `src/components/primitives/Icon/iconMapping.ts` & `types.ts`**

Added thumbtack-related icons:

- `thumbtack`: Main pin icon (FontAwesome `faThumbtack`)
- `thumbtack-slash`: Unpin icon (reuses same icon with different styling)
- `pin`: Alias for thumbtack

## Logic Flow

### Pinning a Message

1. User hovers over message → MessageActions appear
2. User clicks thumbtack icon → `handlePinClick()` triggered
3. `handlePinClick()` calls `togglePin(message)`
4. `togglePin()` determines action based on `message.isPinned`
5. Calls `pinMessage(messageId)` → triggers pin mutation
6. Mutation updates database via `updateMessagePinStatus()`
7. On success, invalidates relevant React Query caches
8. UI updates automatically with new pin state
9. Shows "Pinned!" confirmation tooltip for 2 seconds

### Viewing Pinned Messages

1. User clicks thumbtack button in channel header
2. Opens PinnedMessagesPanel with `isOpen={true}`
3. Panel fetches data via `usePinnedMessages` hook
4. Hook queries `getPinnedMessages()` from database
5. Messages sorted by creation date (newest first)
6. Panel renders list with jump and unpin actions

### Jump to Message

1. User clicks jump button (arrow-right) in panel
2. `handleJumpToMessage(messageId)` triggered
3. Panel closes and navigates to `#msg-${messageId}`
4. Message scrolls into view with highlight animation
5. Yellow highlight effect applied for 2 seconds

## Key Technical Details

### Configuration Constants

All magic numbers have been extracted into configuration objects:

- `PINNED_MESSAGES_CONFIG.MAX_PINS`: 50 (maximum pinned messages per channel)
- `PINNED_PANEL_CONFIG.TEXT_PREVIEW_LENGTH`: 800 (characters shown in preview)
- `PINNED_PANEL_CONFIG.TOOLTIP_DURATION_MOBILE`: 3000ms (mobile tooltip auto-hide)
- `MESSAGE_ACTIONS_CONFIG.PIN_CONFIRMATION_DURATION`: 2000ms (confirmation tooltip duration)

### Query Key Management

- **Critical bug fix**: Messages query uses capital 'M' (`['Messages', ...]`)
- Pin mutations must invalidate with correct case-sensitive key
- Ensures real-time UI updates after pin operations

### Permission System

- Only space owners can pin/unpin messages
- Permission checked in hook: `canPinMessages: Boolean(isSpaceOwner)`
- UI elements conditionally rendered based on permissions

### Error Handling

- Comprehensive try-catch blocks in mutation functions
- Validation of messageId, spaceId, and channelId parameters
- Error logging for debugging and monitoring
- Error states exposed via `pinError` and `unpinError` properties

### Performance Optimization

- React Query caching prevents unnecessary database calls
- Optimistic updates provide immediate UI feedback
- Query invalidation strategy updates only relevant caches
- Database queries use existing `by_conversation_time` index with in-memory filtering for reliability

### Mobile Compatibility

- Uses primitive components for cross-platform support
- Responsive design with mobile-first approach
- Touch-friendly tooltips with auto-hide timers

## Future Enhancements

1. **System Messages**: Implement PinMessage type for pin/unpin notifications
2. **Role-based Permissions**: Extend beyond space owners to specific roles
3. **Pin Categories**: Allow organizing pins by topic or importance
4. **Pin History**: Track pin/unpin activity for moderation
5. **Bulk Operations**: Pin/unpin multiple messages at once

---

_Last updated: January 2025 - Added configuration constants, improved error handling, and database query optimization notes_
