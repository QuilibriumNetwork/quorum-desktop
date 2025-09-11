# Space Owner Delete Permissions Bug

## Issue Description

**Space owners cannot delete other users' messages** despite having the correct UI permissions. Delete buttons appear for space owners but clicking them does nothing - messages are not deleted locally or on other clients.

## Current Behavior vs Expected Behavior

### Current State
- ✅ **Users with delete role permissions**: Can delete ANY message in regular channels 
- ❌ **Space owners**: See delete buttons but cannot delete other users' messages
- ✅ **Read-only channel managers**: Can delete ANY message in read-only channels
- ✅ **Self-delete**: All users can delete their own messages

### Expected Behavior
- Space owners should be able to delete any message in any channel within their space

## Technical Analysis

### Symptoms
1. **UI Level**: Space owners correctly see delete buttons on other users' messages (permission checking works)
2. **Processing Level**: Clicking delete does nothing - no local deletion, no network synchronization
3. **User Experience**: Buttons appear but are non-functional, creating confusion

### Root Cause
The issue is in the message processing architecture within `src/components/context/MessageDB.tsx`. The delete message processing logic has validation for:

1. ✅ **Self-delete**: Users can delete their own messages
2. ✅ **Role-based permissions**: Users with `message:delete` role permission
3. ✅ **Read-only managers**: Channel-specific manager permissions  
4. ❌ **Space owners**: No validation logic for space ownership

### Architecture Challenge

**Key Technical Problem**: Space ownership is determined by cryptographic key possession (`messageDB.getSpaceKey(spaceId, 'owner')`), but this validation only works in the owner's local context. 

The system has dual processing paths:
- **`saveMessage`**: Validates incoming messages (has access to sender's local keys)
- **`addMessage`**: Applies messages to UI cache (cannot access sender's keys for validation)

Current working permissions (roles, self-delete, read-only managers) use different validation patterns that don't require cross-client key verification.

### Security Requirements

Any solution must ensure:
1. **Authentication**: Only actual space owners can delete messages (no privilege escalation)
2. **Message Integrity**: Proper cryptographic validation of delete requests
3. **Network Synchronization**: Delete messages must propagate correctly to all clients
4. **Validation Consistency**: Both local processing and remote message acceptance must work

## Files Involved

- **Primary**: `src/components/context/MessageDB.tsx` - Message processing and validation logic
- **Secondary**: `src/hooks/business/channels/useChannelMessages.ts` - UI permission checking
- **Related**: `src/utils/permissions.ts` - Permission utility functions

## Implementation Notes for Developers

1. **Space Owner Detection**: Uses `messageDB.getSpaceKey(spaceId, 'owner')` pattern
2. **Processing Architecture**: Dual-path validation system requires secure owner verification in both contexts
3. **Working Patterns**: Reference read-only manager and traditional role implementations for architectural guidance
4. **Security First**: Previous implementation attempts were reverted due to security vulnerabilities

---

**Status**: ❌ **OPEN** - Core space management functionality missing  
**Priority**: High - Space owners cannot perform expected administrative actions  
**Created**: 2025-09-11  
**Last Updated**: 2025-09-11