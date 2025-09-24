# Edit Message Feature

**Created**: 2025-01-24
**Status**: Pending
**Priority**: Medium

> **Note**: This analysis was conducted via Claude Code and may lack accuracy in some areas. Implementation details should be validated against the actual codebase and requirements.

## Overview

Implement the ability for users to edit their sent messages in both Direct Messages and Space/Channel conversations.

## Technical Analysis

### Current Architecture Assessment

The codebase already has infrastructure that supports message modifications:
- Messages have `modifiedDate` and `lastModifiedHash` fields
- Established patterns exist for message mutations (delete, reactions, pins)
- Real-time update pipeline via WebSocket
- Query invalidation and optimistic updates already implemented

### Encryption Considerations

#### Direct Messages (DMs)
- Uses DoubleRatchet encryption with per-device sessions
- Each device maintains separate encryption states
- Messages encrypted individually for each recipient device

#### Space/Channel Messages
- Uses TripleRatchet encryption for group communication
- Single encryption state shared across space members
- Messages encrypted once for entire group

### Implementation Approach

#### 1. Add New Message Type

```typescript
export type EditMessage = {
  senderId: string;
  type: 'edit-message';
  originalMessageId: string;
  editedText: string | string[];
  editedAt: number;
  editNonce: string;
  editSignature?: string;
}
```

#### 2. Database Strategy - "Last-Edit-Wins"

- Keep original message unchanged (audit trail)
- Store one edit record per message (latest version)
- Optional edit history array for tracking changes
- Update existing edit record on subsequent edits

#### 3. Processing Flow

1. User initiates edit action
2. Create EditMessage with reference to original
3. Encrypt using current encryption state
4. Store/update edit record in IndexedDB
5. Broadcast via WebSocket
6. Update UI to show latest content

## Required Components

### Backend Integration
- [ ] Add `EditMessage` to content union type in `quorumApi.ts`
- [ ] Handle edit permissions (only original sender)
- [ ] Implement edit time window restrictions

### Message Processing
- [ ] Add edit handler in `MessageDB.tsx` similar to remove-message
- [ ] Update encryption flow for edited messages
- [ ] Handle signature generation for edits

### UI Components
- [ ] Add "Edit" button to `MessageActions.tsx`
- [ ] Create inline edit interface
- [ ] Show "edited" indicator with timestamp
- [ ] Optional: Edit history viewer

### Data Management
- [ ] Update message queries to fetch edits
- [ ] Modify search indexing for edited content
- [ ] Handle edit record cleanup/compression

### Mobile Compatibility
- [ ] Ensure edit UI works on mobile
- [ ] Touch-friendly edit interactions
- [ ] Responsive edit interface

## Security Requirements

- Only original sender can edit their messages
- Enforce edit time window (e.g., 15 minutes)
- Maintain all signatures for audit trail
- Preserve non-repudiation properties
- Validate edit permissions on receive

## Edge Cases to Handle

- Editing while offline
- Concurrent edits from multiple devices
- Editing deleted messages
- Editing messages with reactions
- Editing replied-to messages
- Edit conflicts resolution
- Maximum edit count limits

## Testing Considerations

- Unit tests for edit message processing
- Integration tests for encryption flow
- UI tests for edit interface
- Cross-device edit synchronization
- Performance with many edits
- Search functionality with edited content

## Open Questions

1. Should edit history be permanently stored or compressed after N edits?
2. What should the edit time window be?
3. Should edited messages trigger notifications?
4. How to handle edits to messages with attachments/embeds?
5. Should space owners/admins be able to edit others' messages?

## Dependencies

- Existing message infrastructure
- Encryption state management
- WebSocket provider
- IndexedDB message storage
- React Query cache management

## Success Criteria

- Users can edit their own messages within time window
- Edits are properly encrypted and synchronized
- Edit history is trackable
- No degradation in message loading performance
- Works seamlessly on desktop and mobile
- Maintains security and audit requirements

---

**Updated**: 2025-01-24