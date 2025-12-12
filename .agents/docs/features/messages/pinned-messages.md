# Pinned Messages Feature

## Overview

The pinned messages feature allows authorized users to pin important messages within Space channels, making them easily accessible through a dedicated panel. Pin/unpin actions are broadcast to all space members with full defense-in-depth validation, ensuring pins synchronize across all devices while maintaining security.

**Key Features:**
- ✅ Cross-client synchronization via encrypted broadcast
- ✅ Role-based permissions with `message:pin` permission
- ✅ Defense-in-depth validation (UI → Sending → Receiving)
- ✅ Space Channels only (DMs not supported)
- ✅ Pin limit enforcement (50 max per channel)

## User Experience

- **Role-based permissions**: Users with `message:pin` permission or read-only channel managers can pin/unpin messages
- **Space Channels only**: Pin feature available in Space Channels, not in DMs
- **Pin from message actions**: Hover over any message to reveal pin/unpin button (thumbtack icon)
- **Visual indicators**: Pinned messages show a thumbtack icon next to the sender name
- **Pinned messages panel**: Access all pinned messages via thumbtack button in channel header
- **Quick navigation**: Jump directly to pinned messages in the conversation
- **Confirmation feedback**: Shows "Pinned!" and "Unpinned!" tooltips after actions
- **Real-time sync**: Pin/unpin actions broadcast to all space members and sync across devices

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
- `PinMessage` type used for cross-client synchronization:
  ```typescript
  type PinMessage = {
    senderId: string;
    type: 'pin';
    targetMessageId: string;
    action: 'pin' | 'unpin';
  };
  ```

### Message Broadcasting

**File: `src/services/MessageService.ts`**

Pin/unpin actions are broadcast to all space members using the same pattern as reactions, deletions, and edits:

**Sending (`submitChannelMessage` - lines 3100-3232):**
- Validates user permissions before broadcast
- Generates message ID using SHA-256(nonce + 'pin' + senderId + canonicalize(pinMessage))
- Creates Message envelope with PinMessage content
- Signs if non-repudiable space
- Encrypts with Triple Ratchet
- Sends via `sendHubMessage()`
- Calls `saveMessage()` and `addMessage()` for local updates

**Receiving (`saveMessage` - lines 448-523):**
- Validates target message exists
- Rejects DMs (pins are Space-only)
- Validates permissions:
  - Read-only channels: Only managers via `managerRoleIds`
  - Regular channels: Explicit `message:pin` role permission (NO isSpaceOwner bypass)
- Pin limit validation (50 max)
- Updates target message with `isPinned`, `pinnedAt`, `pinnedBy` fields
- Persists to IndexedDB

**Receiving (`addMessage` - lines 882-978):**
- Same permission validation as saveMessage (defense-in-depth)
- Pin limit validation
- Updates React Query cache
- Invalidates `pinnedMessages` and `pinnedMessageCount` query caches

**Canonicalization (`src/utils/canonicalize.ts` - lines 104-110):**
```typescript
if (pendingMessage.type === 'pin') {
  return (
    pendingMessage.type +
    pendingMessage.targetMessageId +
    pendingMessage.action  // Ensures unique IDs for pin vs unpin
  );
}
```

### Business Logic

**File: `src/hooks/business/messages/usePinnedMessages.ts`**

Main hook managing all pinned message functionality:

**Key features:**

- React Query integration with network broadcast
- Permission checking (role-based with `message:pin` permission)
- Pin limit enforcement (50 messages maximum, configurable via `PINNED_MESSAGES_CONFIG.MAX_PINS`)
- Network broadcast via `submitChannelMessage()` instead of local-only updates
- Automatic query invalidation for real-time updates
- Comprehensive error handling with try-catch blocks and validation
- Error state exposure via `pinError` and `unpinError` properties

**Pin/Unpin Implementation (lines 71-160):**
- Replaced local `updateMessagePinStatus()` with `submitChannelMessage()` broadcast
- Creates `PinMessage` object with `action: 'pin'` or `action: 'unpin'`
- Broadcasts to all space members via encrypted message
- Receiving clients independently validate and apply changes

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

**File: `src/components/ui/DropdownPanel.tsx`**
**File: `src/components/ui/DropdownPanel.scss`**

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

- `thumbtack`: Main pin icon (`IconPin`)
- `thumbtack-slash`: Unpin icon (`IconPinOff`)
- `pin`: Alias for thumbtack

## Logic Flow

### Pinning a Message

1. User hovers over message → MessageActions appear
2. User clicks thumbtack icon → `handlePinClick()` triggered
3. `handlePinClick()` calls `togglePin(message)`
4. `togglePin()` determines action based on `message.isPinned`
5. Calls `pinMessage(messageId)` → triggers pin mutation
6. Mutation creates `PinMessage` object and calls `submitChannelMessage()`
7. **Sending client:**
   - Validates permissions (UI layer)
   - Validates permissions again (sending layer)
   - Encrypts and broadcasts to all space members
   - Calls `saveMessage()` and `addMessage()` for local updates
8. **All receiving clients (including sender):**
   - Decrypt incoming message
   - Validate permissions independently (receiving layer)
   - Validate pin limit (50 max)
   - Update local database and React Query cache
   - Invalidate `pinnedMessages` and `pinnedMessageCount` queries
9. UI updates automatically with new pin state across all devices
10. Shows "Pinned!" confirmation tooltip for 2 seconds

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
4. MessageList detects hash and scrolls to message
5. Message component detects hash match and applies `.message-highlighted` class
6. Yellow highlight effect (8 second CSS animation)
7. Hash is cleaned up after 8 seconds

See `.agents/docs/features/messages/message-highlight-system.md` for the full highlighting architecture.

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

**Defense-in-Depth (3 Layers):**

1. **UI Layer**: Permission checked in hook via `canUserPin()`
   - Read-only channels: Check `managerRoleIds` first
   - Regular channels: Check `message:pin` role permission via `hasPermission()` (includes isSpaceOwner bypass for UI only)
   - UI elements conditionally rendered based on permissions

2. **Sending Layer** (`MessageService.ts:3100-3232`):
   - Same permission logic before broadcast
   - Prevents unauthorized messages from being sent

3. **Receiving Layer** (`MessageService.ts:448-523, 882-978`):
   - **Independent validation** by each receiving client
   - Read-only channels: Only managers via `managerRoleIds`
   - Regular channels: **Explicit `message:pin` role permission only** (NO isSpaceOwner bypass)
   - Space owners must assign themselves a role with `message:pin` permission
   - Protects against malicious/modified clients

**Security Guarantees:**
- ✅ Unauthorized pins never displayed to honest users
- ✅ Silent rejection (attacker only sees their own pin)
- ✅ Pin limit enforced on both sending and receiving sides
- ✅ DMs explicitly rejected (pins are Space-only)
- ✅ Rate limiting via existing message throttle (10 msgs/10 sec)

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

## Completed Enhancements

- ✅ **Cross-Client Sync** (2025-12-12): Pin/unpin actions now broadcast to all space members
- ✅ **Role-based Permissions** (2025-12-12): Extended to use `message:pin` permission, not just space owners
- ✅ **Defense-in-Depth Security** (2025-12-12): 3-layer validation (UI → Sending → Receiving)
- ✅ **DM Protection** (2025-12-12): Pins explicitly rejected in DMs (Space-only feature)

## Future Enhancements

1. **System Messages**: Show pin/unpin notifications in conversation feed
2. **Pin Categories**: Allow organizing pins by topic or importance
3. **Pin History**: Track pin/unpin activity for moderation
4. **Bulk Operations**: Pin/unpin multiple messages at once

## Related Documentation

- [Message Preview Rendering](message-preview-rendering.md) - Overview of preview rendering systems (MessagePreview used here)
- [Bookmarks](bookmarks.md) - Similar panel pattern with hybrid rendering
- [Markdown Stripping](markdown-stripping.md) - Text processing used by MessagePreview
- [Security Architecture](../security.md) - Defense-in-depth validation pattern used for pins
- [Data Management Architecture](../../data-management-architecture-guide.md) - Message sync patterns

## Implementation Tasks

- [Pinned Messages Feature Plan](.agents/tasks/.done/pinned-messages-feature.md) - Original feature implementation
- [Pinned Messages Sync Task](.agents/tasks/pinned-messages-sync.md) - Cross-client synchronization (✅ COMPLETED 2025-12-12)

---

_Created: 2025-12-02_
_Last updated: 2025-12-12_
_Major Update: Added cross-client synchronization with full defense-in-depth validation_
