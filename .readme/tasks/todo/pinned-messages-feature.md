# Pinned Messages Feature - Implementation Plan

[← Back to INDEX](/../../INDEX.md)


## Overview

Implementation of a Discord-like pinned messages feature for Quorum spaces, initially restricted to space owners with future expansion to role-based permissions.

## Feature Requirements

### Core Functionality
1. **Pin/Unpin Messages**: Space owners can pin important messages in channels
2. **Pinned Messages Display**: Dedicated UI to view all pinned messages in a channel
3. **Pin Indicators**: Visual indicators on pinned messages in the message list
4. **Pin Limits**: Maximum of 50 pinned messages per channel (Discord standard)
5. **Pin Notifications**: System messages when messages are pinned/unpinned
6. **Cross-Platform Support**: Works on both web and mobile platforms

### Permission Model (Phase 1)
- Only space owners can pin/unpin messages
- All members can view pinned messages
- Future: Add 'message:pin' permission to role system

## Technical Architecture

### 1. Data Model Changes

#### Message Type Extension (`src/api/quorumApi.ts`)
```typescript
export type Message = {
  // ... existing fields
  isPinned?: boolean;
  pinnedAt?: number;  // timestamp
  pinnedBy?: string;  // user address
};
```

#### New Message Content Type
```typescript
export type PinMessage = {
  type: 'pin';
  senderId: string;
  targetMessageId: string;
  action: 'pin' | 'unpin';
};
```

### 2. Database Schema Updates

#### IndexedDB Updates (`src/db/messages.ts`)
- Add new index for pinned messages: `by_channel_pinned`
- Index structure: `[spaceId, channelId, isPinned, pinnedAt]`
- Enable efficient queries for pinned messages per channel

#### New Methods in MessageDB Class
```typescript
class MessageDB {
  // Get all pinned messages for a channel
  async getPinnedMessages(
    spaceId: string, 
    channelId: string
  ): Promise<Message[]>
  
  // Pin/unpin a message
  async updateMessagePinStatus(
    messageId: string,
    isPinned: boolean,
    pinnedBy?: string
  ): Promise<void>
  
  // Get pinned message count for a channel
  async getPinnedMessageCount(
    spaceId: string,
    channelId: string
  ): Promise<number>
}
```

### 3. API Layer

#### New API Endpoints (if backend support needed)
- `POST /spaces/{spaceId}/channels/{channelId}/pins/{messageId}` - Pin a message
- `DELETE /spaces/{spaceId}/channels/{channelId}/pins/{messageId}` - Unpin a message
- `GET /spaces/{spaceId}/channels/{channelId}/pins` - Get all pinned messages

### 4. Component Architecture

#### New Components

##### `PinnedMessagesPanel` (`src/components/message/PinnedMessagesPanel.tsx`)
- Modal/drawer to display all pinned messages
- List view with message preview
- Jump to message functionality
- Unpin action (for owners)
- Mobile-responsive design using primitives

##### `PinnedMessageIndicator` (`src/components/message/PinnedMessageIndicator.tsx`)
- Small icon/badge shown on pinned messages
- Tooltip showing who pinned and when
- Cross-platform compatible

#### Component Updates

##### `Message.tsx` Updates
- Add pin indicator to message header
- Add "Pin Message" to message actions menu (owners only)
- Show system message for pin/unpin events
- Handle pin state in message props

##### `MessageActions.tsx` Updates
- Add pin/unpin action
- Check space owner permission
- Show pin status in menu

##### `MessageList.tsx` Updates
- Add pinned messages header/button
- Handle pin event messages
- Update message rendering for pinned state

### 5. Hooks Architecture

#### New Hooks

##### `usePinnedMessages` (`src/hooks/business/messages/usePinnedMessages.ts`)
```typescript
export const usePinnedMessages = (spaceId: string, channelId: string) => {
  // Fetch pinned messages
  // Pin/unpin message mutations
  // Pin count query
  // Permission checks
  return {
    pinnedMessages,
    pinnedCount,
    canPinMessages,
    pinMessage,
    unpinMessage,
    isPinning,
    error
  };
};
```

##### `useMessagePinning` (`src/hooks/business/messages/useMessagePinning.ts`)
```typescript
export const useMessagePinning = (message: Message) => {
  // Handle pin/unpin logic for a specific message
  // Permission checks
  // Optimistic updates
  return {
    isPinned,
    canPin,
    togglePin,
    pinningState
  };
};
```

#### Hook Updates

##### `useSpacePermissions.ts` Updates
- Add `canPinMessages` permission check
- Initially only true for space owners
- Ready for future role-based permissions

### 6. UI/UX Design

#### Visual Design
- **Pin Icon**: Use our Icon prinmitive (map new PIN icon if it's not there)
- **Pinned Header**: Pin icon at top of Space opening the list of pinned posts (each post in the list has a small "jump" link in the top right that redirects to the actual post in the space, with a yellow flashing effect, using the same effect we currently use to jump to messages when the URL contains a message ID or to jump to search result)
- **Pin Animation**: Subtle animation when pinning/unpinning

#### User Flows

##### Pinning a Message
1. User hovers over message → shows action menu
2. Clicks "Pin Message" option
3. Message gets pinned indicator
4. System message appears: "User pinned a message"

##### Viewing Pinned Messages
1. Click pinned messages icon in channel header
2. Opens panel/modal with all pinned messages
3. Click  "jump" link in the top right of each message to jump to it in chat (yellow flashing effect on target message, using the same effect we currently use to jump to messages when the URL contains a message ID or to jump to search result)
4. Option to unpin (if owner)

#### Mobile Considerations (mobiel version of Pinned messages not implemented at this time)
- Long-press to show pin option
- Swipe actions for quick pin/unpin
- Bottom sheet for pinned messages list
- Responsive layout using primitives

### 7. State Management

#### Local State
- Pinned messages cache in MessageDB
- Optimistic updates for pin/unpin actions
- Real-time sync with other clients

#### Sync Strategy
- Pin events broadcast to all connected clients
- Conflict resolution: last-write-wins
- Offline support with queue for pin actions

### 8. Permission Integration

#### Phase 1 (Current)
```typescript
const canPinMessages = isSpaceOwner;
```

#### Phase 2 (Future)
```typescript
const canPinMessages = hasPermission(
  userAddress,
  spaceId,
  'message:pin',
  roles
) || isSpaceOwner;
```

### 9. Implementation Phases

#### Phase 1: Core Functionality (Week 1)
- [ ] Update Message type and database schema
- [ ] Implement MessageDB pinned message methods
- [ ] Create usePinnedMessages hook
- [ ] Add pin/unpin to MessageActions
- [ ] Add pin indicator to Message component

#### Phase 2: UI Components (Week 1-2)
- [ ] Create PinnedMessagesPanel component
- [ ] Create PinnedMessageIndicator component
- [ ] Add pinned messages button to channel header
- [ ] Implement mobile-specific UI adaptations
- [ ] Add system messages for pin events

#### Phase 3: Integration & Polish (Week 2)
- [ ] Connect to real-time updates
- [ ] Add optimistic updates
- [ ] Implement pin limit (50 messages)
- [ ] Add animations and transitions
- [ ] Comprehensive testing

#### Phase 4: Future Enhancements
- [ ] Role-based permissions ('message:pin')
- [ ] Pin message search/filter
- [ ] Pin message categories/tags
- [ ] Bulk pin operations
- [ ] Pin message notifications

### 10. Testing Strategy

#### Unit Tests
- MessageDB pin methods
- usePinnedMessages hook logic
- Permission checks
- Pin limit enforcement

#### Integration Tests
- Pin/unpin flow
- Real-time sync
- Offline/online transitions
- Cross-platform compatibility

#### E2E Tests
- Complete pin workflow
- Permission restrictions
- Mobile interactions
- Performance with many pins

### 11. Performance Considerations

- **Indexing**: Proper database indexes for pinned message queries
- **Caching**: Cache pinned messages in memory
- **Lazy Loading**: Load pinned messages on demand
- **Pagination**: Paginate if >20 pinned messages
- **Optimistic UI**: Immediate visual feedback

### 12. Accessibility

- **Screen Readers**: Proper ARIA labels for pin indicators
- **Keyboard Navigation**: Shortcuts for pin/unpin
- **Focus Management**: Proper focus handling in panels
- **Announcements**: Screen reader announcements for pin events

### 13. Internationalization

New translation keys needed:
- `message.pin` - "Pin Message"
- `message.unpin` - "Unpin Message"
- `message.pinned` - "Pinned"
- `message.pinnedBy` - "Pinned by {name}"
- `message.viewPinned` - "View Pinned Messages"
- `message.noPinned` - "No pinned messages"
- `message.pinLimit` - "Pin limit reached (50)"
- `message.pinSuccess` - "Message pinned"
- `message.unpinSuccess` - "Message unpinned"

### 14. Migration Strategy

- No migration needed for existing messages (isPinned defaults to false)
- Feature flag for gradual rollout
- Backwards compatibility maintained

### 15. Security Considerations

- Validate pin permissions server-side
- Rate limiting for pin/unpin actions
- Audit logging for pin events
- Prevent pin spam/abuse

### 16. Dependencies

No new external dependencies required. Uses existing:
- React Query for data fetching
- IndexedDB for storage
- Existing UI primitives
- Existing permission system

### 17. Success Metrics

- Pin feature usage rate
- Average pins per channel
- User engagement with pinned messages
- Performance metrics (load time)
- Error rates

### 18. Documentation Needs

- User guide for pinning messages
- Admin guide for pin permissions
- Developer docs for pin API
- Mobile-specific instructions

---

## Implementation Priority

1. **Critical Path** (Must Have)
   - Basic pin/unpin functionality
   - Pin indicator on messages
   - View pinned messages panel
   - Owner-only permissions

2. **Important** (Should Have)
   - System messages for pin events
   - Mobile optimizations
   - Pin limit enforcement
   - Real-time sync

3. **Nice to Have** (Could Have)
   - Animations
   - Advanced search/filter
   - Bulk operations
   - Role-based permissions

## Next Steps

1. Review and approve this plan
2. Create feature branch `feature/pinned-messages`
3. Start with Phase 1 implementation
4. Regular testing and code reviews
5. Deploy behind feature flag

---

*Document created: 2025-09-07*
*Author: Claude*
*Status: Planning*

[← Back to INDEX](/../../INDEX.md)