# User Status Feature Implementation Plan

**Created**: 2025-01-20  
**Status**: Planning  
**Priority**: High

## Feature Summary

Implement a comprehensive user status system that allows users to set custom status messages that are visible to other users across all spaces. The status will be integrated into the existing profile update system and synchronized through the established message infrastructure.

## Current State Analysis

Based on investigation of the existing codebase:

- **Status field exists** in user object structure but is always set to empty string
- **UserProfile component** has status input UI but saves status as empty string (broken implementation)
- **UserOnlineStateIndicator** has logic to display custom status but receives empty data
- **UpdateProfileMessage** type only includes `displayName` and `userIcon` - missing `status` field
- **No persistence mechanism** for status data across users
- **No backend integration** for status synchronization

## Key Design Decisions

### 1. Integration Strategy

- **Extend existing UpdateProfileMessage system** rather than creating new message type
- **Leverage existing profile update infrastructure** for reliability and consistency
- **Maintain backward compatibility** with older clients

### 2. Data Flow Architecture

- **Source of Truth**: Database (IndexedDB) + Server synchronization
- **Persistence**: Through existing profile update message system
- **Fallback**: localStorage for user's own status persistence across sessions
- **Distribution**: Real-time through WebSocket + UpdateProfileMessage

### 3. User Experience Design

- **Status Input**: Available in UserSettingsModal after account address field
- **Status Display**: Shown in UserProfile modal and other user displays
- **Visual Pattern**: Colored online/offline dot + status text (or "Online/Offline" if no status)
- **Character Limit**: 100 characters with live counter

### 4. Technical Implementation

- **Type Safety**: Add optional `status?: string` to UpdateProfileMessage
- **Database**: Extend participant storage to include status field
- **UI Components**: Modify existing components rather than creating new ones
- **Validation**: Client-side character limits and sanitization

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

## Implementation Checklist

### Phase 1: Backend Infrastructure

- [ ] Add `status?: string` field to UpdateProfileMessage type in `src/api/quorumApi.ts`
- [ ] Update updateUserProfile function in MessageDB.tsx to include status parameter
- [ ] Modify profile message creation to include status field
- [ ] Update profile message processing to save status to participant data
- [ ] Test UpdateProfileMessage changes don't break existing functionality

### Phase 2: Database Integration

- [ ] Verify participant/member data structure supports additional fields
- [ ] Update saveSpaceMember to persist status field
- [ ] Update getSpaceMember to return status field
- [ ] Test database operations with status field
- [ ] Ensure proper indexing for member queries

### Phase 3: Data Synchronization

- [ ] Update mapSenderToUser in MessageList.tsx to include status from database
- [ ] Update mapSenderToUser in DirectMessage.tsx to include status from database
- [ ] Remove temporary localStorage-only status implementation
- [ ] Test user data flow includes status across all components
- [ ] Verify status updates propagate to all space members

### Phase 4: UI Implementation - UserSettingsModal

- [ ] Add status input field to UserSettingsModal after account address section
- [ ] Implement character limit (100 chars) with live counter
- [ ] Add proper styling to match existing form fields
- [ ] Add internationalization strings for status-related text
- [ ] Update saveChanges function to include status in profile updates
- [ ] Test status input and saving functionality

### Phase 5: UI Implementation - Status Display

- [ ] Update UserOnlineStateIndicator to show colored dot + status text
- [ ] Implement fallback to "Online/Offline" when no custom status
- [ ] Ensure status displays correctly in UserProfile modal
- [ ] Test status display in message avatars and user lists
- [ ] Verify responsive design on mobile devices

### Phase 6: UserProfile Component Fixes

- [ ] Fix existing broken status saving in UserProfile edit mode
- [ ] Ensure UserProfile status input works with new backend system
- [ ] Add localStorage persistence for user's own status as backup
- [ ] Test UserProfile status editing and synchronization
- [ ] Remove duplicate status management code

### Phase 7: Validation & Security

- [ ] Add client-side validation for status content
- [ ] Implement character limit enforcement
- [ ] Add basic content sanitization (prevent XSS)
- [ ] Test with various Unicode characters and emojis
- [ ] Add proper error handling for status update failures

### Phase 8: Testing & Polish

- [ ] Test status updates across multiple spaces
- [ ] Test status persistence across app restarts
- [ ] Test with multiple devices/sessions for same user
- [ ] Verify backward compatibility with older message types
- [ ] Test network disconnection and reconnection scenarios
- [ ] Performance testing with frequent status updates

### Phase 9: Documentation & Cleanup

- [ ] Update data-management-architecture.md with status system details
- [ ] Add code comments for status-related functionality
- [ ] Remove any temporary/debug code
- [ ] Update component documentation if needed
- [ ] Run final lint and type checks

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

- [ ] Users can set custom status messages up to 100 characters
- [ ] Status messages are visible to other users in the same spaces
- [ ] Status persists across app restarts and device changes
- [ ] Status updates propagate in real-time to other users
- [ ] UI is responsive and works well on mobile devices
- [ ] No breaking changes to existing functionality
- [ ] Backward compatibility maintained with older clients

## Notes

- This implementation leverages the existing robust profile update system rather than creating new infrastructure
- The design maintains consistency with existing Quorum patterns and conventions
- Status is treated as part of user profile data, ensuring proper encryption and synchronization
- Implementation follows the mobile-first approach established in the codebase

---

_Plan created: 2025-01-20_  
_Last updated: 2025-01-20_
