# User Status Feature Implementation Plan

**Created**: 2025-01-20  
**Updated**: 2025-08-10  
**Status**: Planning  
**Priority**: High → Medium (Simplified to Phase 1)

## Feature Summary

Implement a user online/offline status system with two phases:

**Phase 1 (Immediate)**: Simple online/offline status indicator for current user based on WebSocket connection state.

**Phase 2 (Long-term)**: Full presence system showing all users' online/offline status + optional custom status messages.

## Current State Analysis

Based on investigation of the existing codebase:

### **Existing Infrastructure**:

- **WebSocket connection state** tracked in WebSocketProvider (`connected: boolean`)
- **UserOnlineStateIndicator component** exists but shows "undefined" for message users
- **User objects from messages** lack `state`/`status` properties (from `mapSenderToUser`)
- **CSS styling** only exists for online state (green dot), missing offline (red dot)

### **Key Limitations Discovered**:

- **No presence system** - clients only know their own connection state
- **Other users' status unknown** - no mechanism to track other users' online/offline state
- **User object structure mismatch** - message users vs. profile users have different data structure
- **Missing server infrastructure** for presence tracking and broadcasting

## Implementation Approach

### **Phase 1: Self-Status Only (Immediate - 4-5 hours)**

**Goal**: Show current user's own online/offline status based on WebSocket connection state.

**Strategy**:

- Leverage existing WebSocket connection tracking (`WebSocketProvider.connected`)
- Update UserOnlineStateIndicator to detect current user vs. other users
- Show green/red dot for current user's connection state
- No status shown for other users (or neutral indicator)

**Benefits**:

- Immediate value for connection troubleshooting
- Simple implementation using existing infrastructure
- No server changes required
- Real-time updates on connection state changes

### **Phase 2: Full Presence System (Long-term - Future)**

**Goal**: Show all users' online/offline status + optional custom status messages.

**Requirements**:

- **Server-side presence tracking** - track user connections/disconnections
- **Presence broadcast system** - notify space members when users go online/offline
- **Message protocol extension** - add presence-related message types
- **Database schema updates** - store user presence state and custom status
- **Heartbeat mechanism** - detect inactive/away users

**Benefits**:

- Full visibility into all users' online status
- Enhanced collaboration awareness
- Custom status messages for rich presence information

## Phase 1 Implementation Details

### **Architecture Design**

**Connection Status Hook** (`src/hooks/business/user/useUserConnectionStatus.ts`):

```typescript
export const useUserConnectionStatus = () => {
  const { connected } = useWebSocket(); // From WebSocketProvider
  const { currentPasskeyInfo } = usePasskeysContext();

  return {
    isCurrentUserOnline: connected,
    getCurrentUserStatus: () => (connected ? 'online' : 'offline'),
  };
};
```

**UserOnlineStateIndicator Updates**:

- Detect if displayed user is current user (compare addresses)
- Use connection state for current user, existing logic for others
- Add CSS styling for offline state (red dot)

**Data Flow**:

1. WebSocketProvider tracks connection state
2. useUserConnectionStatus hook exposes connection status
3. UserOnlineStateIndicator uses hook for current user detection
4. Real-time updates when connection state changes

### **Files to Modify (Phase 1)**:

- `src/hooks/business/user/useUserConnectionStatus.ts` (new)
- `src/components/user/UserOnlineStateIndicator.tsx`
- `src/components/user/UserOnlineStateIndicator.scss`
- `src/components/message/MessageList.tsx` (add user address)
- `src/components/direct/DirectMessage.tsx` (add user address)

## Phase 2 Long-term Architecture

### **Server-Side Presence System Requirements**

**New Message Types**:

```typescript
// User comes online
type PresenceOnlineMessage = {
  type: 'presence_online';
  userId: string;
  timestamp: number;
  customStatus?: string;
};

// User goes offline
type PresenceOfflineMessage = {
  type: 'presence_offline';
  userId: string;
  timestamp: number;
  lastSeen: number;
};

// User updates custom status
type PresenceStatusMessage = {
  type: 'presence_status';
  userId: string;
  status: string;
  timestamp: number;
};
```

**Server Infrastructure Needs**:

- **Connection tracking**: Map user sessions to spaces
- **Presence broadcasting**: Send presence updates to space members
- **Heartbeat system**: Detect inactive users (5min timeout)
- **Grace period handling**: Brief disconnections don't trigger offline
- **Multi-device support**: User online if any device connected

**Database Schema Extensions**:

```typescript
// Add to space_members store
type SpaceMemberWithPresence = {
  spaceId: string;
  user_address: string;
  // ... existing fields
  lastSeen: number;
  isOnline: boolean;
  customStatus?: string;
  presenceUpdated: number;
};
```

**Client-Side Architecture**:

- **Presence message handlers** in WebSocketProvider
- **Presence cache** in IndexedDB for offline access
- **Real-time UI updates** via React Query invalidation
- **Optimistic updates** for current user status changes

### **Phase 2 Implementation Challenges**

**Technical Complexity**:

- Server infrastructure changes required
- Message protocol extensions
- Multi-device presence reconciliation
- Network partition handling

**Privacy Considerations**:

- Users may not want presence tracking
- Granular privacy controls needed
- Status history retention policies

**Performance Impact**:

- Presence messages increase network traffic
- Database storage requirements
- Real-time update overhead

**User Experience**:

- Presence reliability expectations
- Custom status input/validation
- Mobile vs desktop presence differences

## Potential Edge Cases and Concerns

### Security & Privacy

- **Status content validation**: Prevent XSS, inappropriate content
- **Character encoding**: Handle Unicode, emojis, special characters
- **Privacy considerations**: Status visible to all space members

### Performance & Scaling

- **Message frequency**: Avoid spam from frequent status updates
- **Database growth**: Status updates create new messages in all spaces
- **Search indexing**: Status updates may affect search performance

### User Experience

- **Status persistence**: Handle app restarts, network disconnections
- **Conflict resolution**: Multiple device status updates
- **Legacy client compatibility**: Graceful degradation for older versions

### Technical Risks

- **Database schema changes**: Ensure participant data structure supports status
- **Message processing**: UpdateProfileMessage changes affect all clients
- **Backward compatibility**: Older clients must not break with new status field

## Implementation Checklists

### Phase 1: Self-Status Implementation ✅ **Ready to Implement**

**Core Implementation** (~2-3 hours):

- [ ] Create `src/hooks/business/user/useUserConnectionStatus.ts` hook
- [ ] Update `UserOnlineStateIndicator.tsx` with current user detection logic
- [ ] Add offline state CSS (red dot) to `UserOnlineStateIndicator.scss`

**Data Integration** (~1-2 hours):

- [ ] Update `mapSenderToUser` in `MessageList.tsx` to include user address
- [ ] Update `mapSenderToUser` in `DirectMessage.tsx` to include user address

**Testing & Polish** (~1 hour):

- [ ] Test online/offline status shows correctly for current user
- [ ] Test real-time updates when connection state changes
- [ ] Verify no status shows for other users (or neutral indicator)
- [ ] Test in both UserStatus.tsx and UserProfile.tsx contexts

### Phase 2: Full Presence System 🚧 **Future - Major Project**

**Server Infrastructure** (~Several weeks):

- [ ] Design presence tracking architecture
- [ ] Implement connection/disconnection tracking
- [ ] Add presence message types to protocol
- [ ] Build heartbeat system for inactive user detection
- [ ] Create presence broadcasting to space members
- [ ] Handle multi-device presence reconciliation

**Client Infrastructure** (~1-2 weeks):

- [ ] Add presence message handlers to WebSocketProvider
- [ ] Extend IndexedDB schema for presence data
- [ ] Build presence cache and query system
- [ ] Implement real-time presence UI updates

**Feature Implementation** (~1 week):

- [ ] Add custom status input in user settings
- [ ] Build comprehensive presence display system
- [ ] Add privacy controls for presence visibility
- [ ] Implement status history and persistence

**Advanced Features** (~1-2 weeks):

- [ ] Away/idle detection based on user activity
- [ ] Status message formatting and emoji support
- [ ] Presence analytics and insights
- [ ] Mobile-specific presence handling

## Files to Modify

### Core API & Types

- `src/api/quorumApi.ts` - Add status to UpdateProfileMessage type
- `src/components/context/MessageDB.tsx` - Update profile functions to handle status

### Database & Data Flow

- `src/components/message/MessageList.tsx` - Include status in mapSenderToUser
- `src/components/direct/DirectMessage.tsx` - Include status in mapSenderToUser

### UI Components

- `src/components/modals/UserSettingsModal.tsx` - Add status input field
- `src/components/user/UserProfile.tsx` - Fix existing status functionality
- `src/components/user/UserOnlineStateIndicator.tsx` - Update status display logic

### Internationalization

- Language files in `src/i18n/` - Add status-related translation strings

## Testing Strategy

### Unit Testing

- UpdateProfileMessage serialization/deserialization with status field
- Database operations with status data
- Status validation and sanitization functions

### Integration Testing

- Profile update flow end-to-end with status
- Status synchronization across multiple spaces
- Status display in various UI components

### User Testing

- Status input UX in UserSettingsModal
- Status visibility in UserProfile modal and message lists
- Mobile responsiveness and touch interactions

## Success Criteria

### **Phase 1 Success Criteria**:

- [ ] Current user sees accurate online/offline status based on WebSocket connection
- [ ] Green dot shows when user is connected, red dot when disconnected
- [ ] Status updates in real-time when connection state changes
- [ ] Status appears in both UserStatus.tsx (own banner) and UserProfile.tsx (when viewing own profile)
- [ ] Other users show no status indicator or neutral state (no confusion)
- [ ] No breaking changes to existing functionality
- [ ] Mobile and web platforms work consistently

### **Phase 2 Success Criteria** (Future):

- [ ] Users can see other users' online/offline status in real-time
- [ ] Custom status messages up to 100 characters
- [ ] Status messages visible to other users in same spaces
- [ ] Presence persists across app restarts and device changes
- [ ] Multi-device presence handling (online if any device connected)
- [ ] Privacy controls for presence visibility
- [ ] Away/idle detection based on user activity

## Decision Rationale

### **Why Phase 1 First?**

- **Immediate value**: Current user connection troubleshooting
- **Low complexity**: Uses existing WebSocket infrastructure
- **No server changes**: Can implement today with current architecture
- **Foundation building**: Creates the UI/UX patterns for future presence system

### **Why Phase 2 is Separate?**

- **Major infrastructure**: Requires server-side presence tracking
- **Protocol changes**: New message types and handling
- **Complexity**: Multi-device, heartbeat, privacy considerations
- **Resource investment**: Weeks of development vs. hours for Phase 1

## Technical Notes

- **Phase 1** leverages the existing WebSocketProvider connection state tracking
- **User detection** based on comparing PasskeyInfo address with user.address
- **Real-time updates** automatic via React's reactive system
- **CSS updates** needed for red offline dot styling
- **Cross-platform** compatibility maintained with existing architecture patterns

---

_Plan created: 2025-01-20_  
_Last updated: 2025-08-10_
