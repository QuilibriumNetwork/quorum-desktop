# Kick User System Documentation

## Overview

The Kick User system allows space administrators to remove users from spaces through a secure, cryptographically-verified process. The system has been refactored to use cross-platform primitives and extracted business logic for maintainability and mobile compatibility.

## Architecture

### Component Structure

```
KickUserModal (UI Component)
    ↓
useUserKicking (Business Logic Hook)
    ↓
SpaceService.kickUser (Core Implementation via MessageDB Context)
    ↓
IndexedDB + Server API
```

## Components

### KickUserModal (UI Component)

**Location**: `src/components/modals/KickUserModal.tsx`

**Purpose**: Cross-platform modal UI for kicking users with confirmation flow.

**Key Features**:

- ✅ **Cross-platform compatible** - Uses only primitives (Container, Text, FlexRow, Button, Modal)
- ✅ **Responsive design** - Text centers on mobile (<640px), left-aligned on desktop
- ✅ **Confirmation flow** - Requires two clicks to prevent accidental kicks
- ✅ **Loading states** - Shows disabled state during kick operation
- ✅ **Auto-reset** - Confirmation resets when modal closes

**Props**:

```tsx
interface KickUserModalProps {
  visible: boolean; // Modal visibility
  kickUserAddress?: string; // Address of user to kick
  onClose: () => void; // Close handler
}
```

**Primitives Used**:

- `Modal` - Base modal container
- `Container` - Layout containers with responsive props
- `Text` - Typography with variant styling
- `FlexRow` - Horizontal layout
- `Button` - Action button with danger styling

### useUserKicking (Business Logic Hook)

**Location**: `src/hooks/business/user/useUserKicking.ts`

**Purpose**: Encapsulates all kick user business logic, state management, and API interactions.

**State Management**:

```tsx
const [kicking, setKicking] = useState(false); // Loading state
const [confirmationStep, setConfirmationStep] = useState(0); // 0: initial, 1: confirm
const [confirmationTimeout, setConfirmationTimeout] =
  useState<NodeJS.Timeout | null>(null);
```

**Dependencies**:

- `useParams()` - Gets spaceId from URL
- `usePasskeysContext()` - Current user's passkey info
- `useRegistrationContext()` - User's keyset for cryptographic operations
- `useRegistration()` - User's registration data
- `useQueryClient()` - React Query cache management
- `useMessageDB()` - Provides access to specialized services (e.g., `SpaceService`) for database operations.

**Key Functions**:

#### `kickUserFromSpace(userAddress, onSuccess?)`

- Validates required parameters (spaceId, registration, userAddress)
- Sets loading state
- Calls `SpaceService.kickUser()` (accessed via `useMessageDB()`) with cryptographic parameters
- Invalidates React Query cache for space members
- Executes success callback (typically closes modal)
- Handles errors and cleanup

#### `handleKickClick(userAddress, onSuccess?)`

- Implements two-click confirmation flow
- First click: Sets confirmationStep to 1, starts 5-second timeout
- Second click: Clears timeout, executes kick operation
- Auto-resets confirmation after 5 seconds

#### `resetConfirmation()`

- Resets confirmation state to 0
- Clears any active timeout
- Called when modal closes

**Return Values**:

```tsx
{
  kicking: boolean;                    // Current loading state
  confirmationStep: number;            // Current confirmation step (0 or 1)
  handleKickClick: (userAddress, onSuccess?) => void;
  resetConfirmation: () => void;
}
```

## Core Kick User Logic Flow

### 1. User Interaction Flow

```
User clicks "Kick User" button
    ↓
Modal shows with user confirmation
    ↓
First click: "Kick!" → "Click again to confirm"
    ↓
5-second timeout starts (auto-resets)
    ↓
Second click: Execute kick operation
    ↓
Modal shows loading state (button disabled)
    ↓
Operation completes (~5 seconds)
    ↓
Modal closes, success message appears in chat
```

### 2. Technical Implementation Flow

```
handleKickClick(userAddress, onClose)
    ↓
kickUserFromSpace(userAddress, onClose)
    ↓
SpaceService.kickUser(spaceId, userAddress, userKeyset, deviceKeyset, registration) (via MessageDB Context)
    ↓
[Server Operations + Local Database Updates]
    ↓
queryClient.invalidateQueries(['SpaceMembers', spaceId])
    ↓
onClose() - Modal closes
```

### 3. `SpaceService.kickUser` Implementation

**Location**: `src/services/SpaceService.ts`

**Core Operations**: The `SpaceService.kickUser` method, exposed via the `MessageDB Context`, orchestrates the following operations:

#### Server-Side Operations:

1. **Key Generation**: Creates new cryptographic keys (config, space, owner)
2. **Space Registration**: Posts updated space data to server via `apiClient.postSpace()`
3. **Member Notification**: Sends encrypted rekey notifications to remaining members
4. **Kick Notification**: Sends kick notification to the kicked user
5. **Manifest Update**: Updates space manifest excluding kicked user

#### Local Database Operations:

1. **Kick Message**: Saves kick confirmation message to local chat history (via `MessageService`)
2. **Encryption State**: Updates encryption state excluding kicked user from peer mappings (via `EncryptionService`)
3. **Member Filtering**: Creates `filteredMembers` list for future encryption sessions

#### **Important**:

The `kickUser` function does **NOT** remove the kicked user from the local IndexedDB space members table directly. The user remains visible in the UI until server synchronization updates the local database.

## Data Flow and Caching

### 1. Space Members Data Flow

```
IndexedDB (via SpaceService.getSpaceMembers)
    ↓
useSpaceMembers React Query Hook
    ↓
Channel.tsx (activeMembers, members, noRoleMembers)
    ↓
Right Sidebar Content (setRightSidebarContent)
```

### 2. Cache Invalidation Strategy

After kick operation completes:

```tsx
// Invalidate space members cache
await queryClient.invalidateQueries({
  queryKey: ['SpaceMembers', spaceId],
});
```

**Result**:

- ✅ React Query refetches data from IndexedDB
- ⚠️ **Kicked user still visible** because IndexedDB still contains their record
- ✅ User eventually disappears when server sync updates local database

### 3. Why Users Remain Visible

**By Design**: The kicked user remains in the local UI until server synchronization removes them from IndexedDB. This ensures UI consistency with actual server state and prevents optimistic updates that might not match reality.

**Timeline**:

1. **Immediate**: Kick operation completes, success message shows
2. **Cache refresh**: React Query refetches same data from IndexedDB
3. **Eventually**: Server sync removes user from local database
4. **Final**: User disappears from sidebar on next data refresh

## Security and Cryptography

### Required Parameters for Kick Operation

```tsx
SpaceService.kickUser(
  spaceId: string,                           // Target space ID
  userAddress: string,                       // User to kick
  userKeyset: secureChannel.UserKeyset,     // Admin's user keyset
  deviceKeyset: secureChannel.DeviceKeyset, // Admin's device keyset
  registration: secureChannel.UserRegistration // Admin's registration
)
```

### Cryptographic Operations

1. **Key Rotation**: New encryption keys generated excluding kicked user
2. **Rekey Notifications**: Encrypted messages sent to remaining members
3. **Access Revocation**: Kicked user excluded from future encryption sessions
4. **Signature Verification**: All operations cryptographically signed

## Error Handling

### Validation Checks

- ✅ spaceId must be present (from URL params)
- ✅ userAddress must be provided
- ✅ registration data must be loaded
- ✅ User must have admin privileges (implicit in registration check)

### Error States

- **Network failures**: Displayed in console, operation retried
- **Cryptographic errors**: Operation fails, error logged
- **Permission errors**: Operation rejected by server
- **Invalid parameters**: Early return, no operation attempted

### UI Error Handling

- **Loading state**: Button disabled during operation
- **Error recovery**: User can retry operation
- **Graceful degradation**: Modal can be closed even if operation fails

## Performance Considerations

### UI Responsiveness

- **5-second operation**: Kick operation typically takes ~5 seconds
- **Non-blocking**: UI remains responsive (loading state shown)
- **Background operation**: Cryptographic work happens in background thread

### Cache Management

- **Selective invalidation**: Only space members cache invalidated
- **Efficient queries**: React Query manages background refetching
- **Minimal re-renders**: Only affected components re-render

### Memory Management

- **Timeout cleanup**: Confirmation timeouts properly cleared
- **Effect cleanup**: useEffect cleanup prevents memory leaks
- **Cache cleanup**: Old query data garbage collected

## Testing Considerations

### Test Scenarios

1. **Happy path**: Normal kick operation with confirmation
2. **Timeout test**: Confirmation resets after 5 seconds
3. **Modal close**: Confirmation resets when modal closes
4. **Network error**: Handles kick operation failures
5. **Invalid user**: Handles missing userAddress
6. **Permission error**: Handles insufficient privileges

### Mock Requirements

- Mock `useMessageDB()` to provide a mocked `SpaceService` for kick operations
- Mock `useQueryClient()` for cache invalidation
- Mock `useParams()` for spaceId
- Mock authentication contexts for user data

## Integration Points

### Dependencies

- **Authentication**: Requires valid passkey and registration
- **Routing**: Needs spaceId from URL parameters
- **Database**: Integrates with `SpaceService` (via `MessageDB Context`) for operations
- **Caching**: Uses React Query for data management
- **UI**: Uses primitive components for cross-platform compatibility

### External Systems

- **Server API**: Posts space updates and notifications
- **WebSocket**: Receives real-time updates and sync messages
- **IndexedDB**: Stores local space member data
- **Cryptography**: Secure channel operations for encryption

## Future Improvements

### Potential Enhancements

1. **Optimistic UI**: Immediately hide kicked user with rollback on failure
2. **Progress indication**: Show detailed progress during 5-second operation
3. **Batch operations**: Allow kicking multiple users simultaneously
4. **Audit logging**: Track kick operations for space administration
5. **Permission levels**: Different kick permissions for different admin roles

### Mobile Considerations

- ✅ **Touch-friendly**: Button sizes appropriate for mobile
- ✅ **Responsive text**: Centers on mobile, left-aligned on desktop
- ✅ **Cross-platform**: Uses primitives compatible with React Native
- ✅ **Accessibility**: Proper ARIA labels and keyboard navigation

---

**Last Updated**: 2025-01-30  
**Status**: Production Ready  
**Cross-Platform**: ✅ Web + Mobile Compatible
