# MessageDB.tsx Behavior Analysis

**File**: `src/components/context/MessageDB.tsx`
**Total Lines**: 5,781
**Last Updated**: 2025-09-27

## Overview

MessageDB.tsx is a massive React context provider that handles all messaging, encryption, space management, and synchronization functionality for the Quilibrium app. It contains 25+ distinct responsibilities that should be separated into focused services.

## Exported Interface (MessageDBContextValue)

### Core Data Management
- `messageDB: MessageDB` - Main database instance
- `keyset` - User and device encryption keysets
- `setKeyset` - Update encryption keysets
- `setSelfAddress` - Set current user address

### Message Operations
- `submitMessage()` - Submit message to conversation (P2P)
- `submitChannelMessage()` - Submit message to space channel
- `deleteConversation()` - Delete entire conversation

### Space Operations
- `createSpace()` - Create new space
- `updateSpace()` - Update space metadata
- `deleteSpace()` - Delete space entirely
- `createChannel()` - Create channel within space
- `ensureKeyForSpace()` - Ensure encryption key exists for space

### Invitation System
- `sendInviteToUser()` - Send invite to specific user
- `generateNewInviteLink()` - Generate shareable invite link
- `processInviteLink()` - Process/validate invite link
- `joinInviteLink()` - Join space via invite link

### User Management
- `kickUser()` - Remove user from space
- `updateUserProfile()` - Update user display name/avatar
- `sendVerifyKickedStatuses()` - Verify kicked user statuses

### Configuration Management
- `getConfig()` - Retrieve user configuration
- `saveConfig()` - Save user configuration

### Encryption Management
- `deleteEncryptionStates()` - Clean up encryption states

### Synchronization
- `requestSync()` - Trigger manual sync for space

## Internal Functions Analysis

### Message Processing Functions
1. `saveMessage()` (lines ~255-450)
   - Handles reactions, remove reactions, remove messages
   - Updates space member information
   - Manages message status and delivery
   - **Complexity**: Very High (200+ lines, multiple message types)

2. `addMessage()` (lines ~474-600)
   - Processes incoming messages for React Query cache
   - Handles reactions in cached data
   - Updates infinite query data structures
   - **Complexity**: High (125+ lines)

3. `handleNewMessage()` (lines ~600-1200)
   - **MASSIVE FUNCTION**: 600+ lines
   - Processes all incoming WebSocket messages
   - Handles encryption/decryption
   - Manages message routing and storage
   - Updates UI state via React Query
   - **Complexity**: Extremely High

### Space Management Functions
4. `createSpace()` (lines ~1200-1400)
   - Creates space registration
   - Sets up initial channels
   - Handles public/private space logic
   - **Complexity**: High (200+ lines)

5. `updateSpace()` (lines ~1400-1500)
   - Updates space metadata
   - Invalidates relevant queries
   - **Complexity**: Medium (100+ lines)

### Invitation Functions
6. `generateNewInviteLink()` (lines ~1500-1700)
   - Creates cryptographic invite tokens
   - Manages invite expiration
   - **Complexity**: High (200+ lines)

7. `processInviteLink()` (lines ~1700-1900)
   - Validates invite links
   - Decrypts invite data
   - **Complexity**: High (200+ lines)

8. `joinInviteLink()` (lines ~1900-2200)
   - Joins space via invite
   - Handles key exchange
   - Sets up space membership
   - **Complexity**: Very High (300+ lines)

### User Management Functions
9. `kickUser()` (lines ~2200-2400)
   - Removes user from space
   - Updates member lists
   - **Complexity**: Medium (200+ lines)

10. `updateUserProfile()` (lines ~2400-2600)
    - Updates user display info across all spaces
    - **Complexity**: Medium (200+ lines)

### Configuration Functions
11. `getConfig()` (lines ~2600-2800)
    - Retrieves encrypted user config
    - Handles config decryption
    - **Complexity**: Medium (200+ lines)

12. `saveConfig()` (lines ~2800-3000)
    - Encrypts and saves user config
    - **Complexity**: Medium (200+ lines)

### Synchronization Functions
13. `requestSync()` (lines ~3000-3400)
    - Handles space synchronization
    - Manages sync state and retries
    - **Complexity**: Very High (400+ lines)

14. `sendVerifyKickedStatuses()` (lines ~3400-3600)
    - Verifies kicked user statuses
    - **Complexity**: Medium (200+ lines)

### Encryption Functions
15. `deleteEncryptionStates()` (lines ~454-472)
    - Cleans up encryption states for conversation
    - **Complexity**: Low (18 lines)

16. `ensureKeyForSpace()` (lines ~3600-3800)
    - Ensures encryption key exists for space
    - **Complexity**: Medium (200+ lines)

## Major Issues Identified

### 1. Architectural Violations
- **Single Responsibility Violation**: One file handles 15+ distinct concerns
- **Tight Coupling**: Database, encryption, UI updates, and network operations mixed
- **Poor Separation**: No clear boundaries between different domains

### 2. Function Complexity Issues
- `handleNewMessage()`: 600+ lines - needs to be broken into 10+ focused functions
- `requestSync()`: 400+ lines - complex sync logic with retry mechanisms
- `joinInviteLink()`: 300+ lines - multiple error paths and state updates

### 3. Testing Challenges
- Massive functions make unit testing extremely difficult
- Heavy dependency on external services (WebSocket, API, IndexedDB)
- Complex state mutations across multiple React Query caches

### 4. Maintainability Problems
- Cognitive load too high for any developer to understand fully
- Changes to one feature risk breaking seemingly unrelated features
- Code duplication across similar functions (message processing, space operations)

## Proposed Service Boundaries

### MessageService
**Responsibilities**: Message CRUD, reactions, message submission
**Functions**: `submitMessage`, `submitChannelMessage`, `saveMessage`, `addMessage`, message processing parts of `handleNewMessage`

### SpaceService
**Responsibilities**: Space management, channels, membership
**Functions**: `createSpace`, `updateSpace`, `deleteSpace`, `createChannel`, space-related parts of `handleNewMessage`

### EncryptionService
**Responsibilities**: Key management, encryption/decryption, encryption states
**Functions**: `deleteEncryptionStates`, `ensureKeyForSpace`, encryption parts of all functions

### InvitationService
**Responsibilities**: Invite generation, processing, joining
**Functions**: `sendInviteToUser`, `generateNewInviteLink`, `processInviteLink`, `joinInviteLink`

### UserService
**Responsibilities**: User profiles, user management
**Functions**: `kickUser`, `updateUserProfile`, `sendVerifyKickedStatuses`

### ConfigService
**Responsibilities**: User configuration management
**Functions**: `getConfig`, `saveConfig`

### SyncService
**Responsibilities**: Synchronization, data consistency
**Functions**: `requestSync`, sync-related parts of `handleNewMessage`

### WebSocketService (maybe)
**Responsibilities**: WebSocket message handling and routing
**Functions**: Parts of `handleNewMessage` related to message routing

## Critical Dependencies

### External Dependencies
- `MessageDB` class from `../../db/messages`
- `@tanstack/react-query` for caching and state management
- `@quilibrium/quilibrium-js-sdk-channels` for encryption
- `QuorumApiClient` for API communication
- `useWebSocket` for real-time communication

### Internal Dependencies
- Multiple query key builders (`buildSpaceKey`, `buildMessagesKey`, etc.)
- Crypto utilities (`sha256`, `base58btc`)
- Utility functions (`getInviteUrlBase`, `parseInviteParams`)
- Permission utilities (`canKickUser`)

## Testing Strategy Requirements

### High-Priority Test Areas
1. **Message Processing**: All message types (text, reaction, remove, etc.)
2. **Encryption/Decryption**: Critical security functionality
3. **Space Operations**: Create, update, delete, join workflows
4. **Invitation System**: Generate, process, join invitation flows
5. **Synchronization**: Sync logic and conflict resolution
6. **Error Handling**: Network failures, encryption errors, invalid data

### Mock Requirements
- **IndexedDB**: All database operations
- **WebSocket**: Real-time message handling
- **Crypto APIs**: Encryption/decryption operations
- **API Client**: External API calls
- **React Query**: Cache invalidation and updates

### Test Data Needs
- Mock messages (text, encrypted, with reactions, with attachments)
- Mock spaces (public, private, with different member roles)
- Mock users with different permission levels
- Mock encryption keys and states
- Mock configuration data

## Performance Considerations

### Current Performance Issues
- Large function sizes likely impact JavaScript parsing/compilation
- Complex state updates may cause unnecessary re-renders
- Lack of memoization in complex operations

### Monitoring Points
- Bundle size impact (5,781 lines in one file)
- Memory usage from large context provider
- Re-render frequency due to large context surface area
- Function execution time for complex operations

## Risk Assessment

### High-Risk Areas
- **Encryption Logic**: Security-critical, complex key management
- **Message Processing**: Core functionality, handles all message types
- **Synchronization**: Data consistency, conflict resolution
- **Space Management**: Complex membership and permission logic

### Medium-Risk Areas
- **Invitation System**: Complex crypto operations, multiple failure modes
- **User Management**: Profile updates across multiple spaces
- **Configuration**: Encrypted config storage and retrieval

### Low-Risk Areas
- **Utility Functions**: Simple helper functions
- **State Management**: React state setters and getters

## Migration Strategy Notes

1. **Start with Tests**: Comprehensive test coverage before any refactoring
2. **Extract Smallest Services First**: Begin with low-complexity, isolated functions
3. **Maintain API Compatibility**: Keep exact same context interface during migration
4. **Test After Each Extraction**: Full test suite must pass after each service extraction
5. **Preserve All Behavior**: Zero functional changes during extraction phase
6. **Optimize Only After**: Performance and code improvements only after successful extraction