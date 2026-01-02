# Kick User System Documentation

## Overview

The Kick User system allows **space owners** to remove users from spaces through a secure, cryptographically-verified process. Only the space owner can kick users - this is enforced at the protocol level via ED448 signature verification. The system has been refactored to use cross-platform primitives and extracted business logic for maintainability and mobile compatibility.

## Architecture

### Component Structure

```
UserProfile.tsx (Kick button)
    ↓
ModalProvider (useModals().openKickUser)
    ↓
KickUserModal (UI Component with user info display)
    ↓
useUserKicking (Business Logic Hook)
    ↓
SpaceService.kickUser (Core Implementation via MessageDB Context)
    ↓
IndexedDB + Server API
```

### Modal State Flow

The kick modal uses the centralized modal state system in `useModalState.ts`:

```tsx
// State interface
interface KickUserTarget {
  address: string;
  displayName: string;
  userIcon?: string;
}

// Opening the modal
openKickUser(target: KickUserTarget) → dispatch({ type: 'OPEN_KICK_USER', target })

// Modal renders when state.kickUser.isOpen && state.kickUser.target
```

## Components

### KickUserModal (UI Component)

**Location**: `src/components/modals/KickUserModal.tsx`

**Purpose**: Cross-platform modal UI for kicking users with confirmation flow.

**Key Features**:

- ✅ **Cross-platform compatible** - Uses only primitives (Container, Text, FlexRow, Button, Modal, Spacer)
- ✅ **User identification** - Displays target user's avatar, name, and truncated address
- ✅ **Confirmation flow** - Requires two clicks to prevent accidental kicks
- ✅ **Loading states** - Shows disabled state and overlay during kick operation
- ✅ **Auto-reset** - Confirmation resets when modal closes
- ✅ **Cancel option** - Explicit cancel button alongside kick action

**Props**:

```tsx
interface KickUserModalProps {
  visible: boolean;      // Modal visibility
  onClose: () => void;   // Close handler
  userName: string;      // Display name of user to kick
  userIcon?: string;     // Avatar URL of user to kick
  userAddress: string;   // Address of user to kick
}
```

**Primitives Used**:

- `Modal` - Base modal container
- `Container` - Layout containers with responsive props
- `Text` - Typography with variant styling
- `FlexRow` - Horizontal layout
- `Spacer` - Vertical spacing between sections
- `Button` - Action buttons (Cancel and Kick)
- `UserAvatar` - User avatar display component

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
User clicks "Kick" button in UserProfile popup
    ↓
openKickUser({ address, displayName, userIcon }) called via ModalProvider
    ↓
Modal shows with:
  - User avatar, name, and truncated address
  - "This user will be removed from the Space" message
  - Cancel and Kick buttons
    ↓
First click on "Kick" → "Click again to confirm"
    ↓
5-second timeout starts (auto-resets)
    ↓
Second click: Execute kick operation
    ↓
Modal shows loading overlay ("Kicking...")
    ↓
Operation completes (~5 seconds)
    ↓
Modal closes, success message appears in chat
```

### 2. Technical Implementation Flow

```
UserProfile.tsx: openKickUser({ address, displayName, userIcon })
    ↓
ModalProvider dispatches OPEN_KICK_USER action with target
    ↓
KickUserModal receives props: userName, userIcon, userAddress
    ↓
User confirms → handleKickClick(userAddress)
    ↓
kickUserFromSpace(userAddress)
    ↓
SpaceService.kickUser(spaceId, userAddress, userKeyset, deviceKeyset, registration) (via MessageDB Context)
    ↓
[Server Operations + Local Database Updates]
    ↓
queryClient.invalidateQueries(['SpaceMembers', spaceId])
    ↓
Modal auto-closes on success
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
2. **Rekey Notifications**: Encrypted messages sent to remaining members using the **old config key** (so recipients can decrypt with their current key)
3. **Kick Notification**: Encrypted with the **old config key** so the kicked user can decrypt the kick message
4. **Access Revocation**: Kicked user excluded from future encryption sessions
5. **Signature Verification**: All operations cryptographically signed

#### Config Key Encryption Layer

As of Dec 2025, hub/sync envelopes include an optional **config key parameter** for additional encryption:

```typescript
await secureChannel.SealHubEnvelope(
  hubKey.address,
  { ... },
  // Config key for envelope encryption (X448)
  oldConfigKey ? {
    type: 'x448',
    public_key: [...hexToSpreadArray(oldConfigKey.publicKey)],
    private_key: [...hexToSpreadArray(oldConfigKey.privateKey)],
  } : undefined
);
```

**Important**: During kick operations, the **old** config key is used for sealing rekey/kick messages. This ensures:
- Remaining members can decrypt rekey notifications with their current key
- The kicked user can decrypt their kick notification before losing access

## Error Handling

### Validation Checks

- ✅ spaceId must be present (from URL params)
- ✅ userAddress must be provided
- ✅ registration data must be loaded
- ✅ User must be space owner (protocol enforces via ED448 key - only owner possesses the key to sign kick messages)

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
- **Background operation**: Cryptographic work happens in background thread (via `enqueueOutbound`)

### Performance Analysis (2025-12-17)

**Test Configuration**: 3 total members, 1 member to notify

#### Timing Breakdown

| Operation | Time (ms) | % of Total |
|-----------|-----------|------------|
| **EstablishTripleRatchetSessionForSpace** | **5,086** | **~75%** |
| postSpaceManifest API | 431 | ~6% |
| postSpace API | 377 | ~6% |
| Peer ID mapping loop (getUser API calls) | 372 | ~5% |
| Rekey envelope loop | 114 | ~2% |
| Create signatures (space + owner) | 67 | ~1% |
| Create manifest + signature | 55 | <1% |
| Kick envelope creation | 51 | <1% |
| Get keys (space, owner, hub) | 5 | <1% |
| Generate config keypair | 10 | <1% |
| Generate ephemeral key + getSpace | 7 | <1% |
| Get and filter members | 1 | <1% |
| Get encryption states | 0 | <1% |
| Save config key | 2 | <1% |
| getSpace (initial) | 15 | <1% |

#### Console Output

```
[KICK TIMING] Starting kick operation for user: QmNTPKPGXqwjFUjfCMMrTXXtxzwqCDVtN3oTGSFEuSXX2U
[KICK SERVICE] Starting kickUser for: QmNTPKPGXqwjFUjfCMMrTXXtxzwqCDVtN3oTGSFEuSXX2U
[KICK SERVICE] getSpace completed in 15ms
[KICK SERVICE] Starting enqueued outbound operation
[KICK TIMING] kickUser() completed in 16ms
[KICK TIMING] Kick operation completed for user: QmNTPKPGXqwjFUjfCMMrTXXtxzwqCDVtN3oTGSFEuSXX2U
[KICK TIMING] Cache invalidation completed in 3ms
[KICK TIMING] Total kick operation took 20ms
[KICK SERVICE] Get keys (space, owner, hub) completed in 5ms
[KICK SERVICE] Generate config keypair completed in 10ms
[KICK SERVICE] Save config key completed in 2ms
[KICK SERVICE] Create signatures (space + owner) completed in 67ms
[KICK SERVICE] postSpace API call completed in 377ms
[KICK SERVICE] Generate ephemeral key + getSpace completed in 7ms
[KICK SERVICE] Create manifest + signature completed in 55ms
[KICK SERVICE] postSpaceManifest API call completed in 431ms
[KICK SERVICE] Get and filter members (3 total, 1 to notify) completed in 1ms
[KICK SERVICE] Get encryption states completed in 0ms
[KICK SERVICE] EstablishTripleRatchetSessionForSpace completed in 5086ms
[KICK SERVICE] Starting peer ID mapping loop for 1 members
[KICK SERVICE] Peer ID mapping loop (getUser API calls) completed in 372ms
[KICK SERVICE] Starting rekey envelope loop for 1 members
[KICK SERVICE] Rekey envelope loop completed in 114ms
[KICK SERVICE] Kick envelope creation completed in 51ms
```

#### Key Finding

**`EstablishTripleRatchetSessionForSpace` is the primary bottleneck**, consuming ~75% of the total operation time at 5,086ms. This is a cryptographic operation from `@quilibrium/quilibrium-js-sdk-channels` that establishes a new triple ratchet session with capacity for `filteredMembers.length + 200` members. The expensive part is the DKG (Distributed Key Generation) setup.

#### Important Note on Async Behavior

The `kickUser()` call in the hook returns after only ~16-20ms because `enqueueOutbound()` is fire-and-forget - it queues the work but doesn't wait for completion. The actual cryptographic work continues in the background, which is why the UI shows "Total kick operation took 20ms" while the service continues logging for several more seconds.

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

> **Note**: Role-based kick delegation (different kick permissions for different admin roles) is not feasible at the protocol level - kick requires the space owner's ED448 private key to sign the message, which cannot be delegated.

### Mobile Considerations

- ✅ **Touch-friendly**: Button sizes appropriate for mobile
- ✅ **Responsive text**: Centers on mobile, left-aligned on desktop
- ✅ **Cross-platform**: Uses primitives compatible with React Native
- ✅ **Accessibility**: Proper ARIA labels and keyboard navigation

---

**Last Updated**: 2026-01-02
**Verified**: 2025-12-15 - Updated modal props and flow (user info display via ModalProvider)
**Performance Tested**: 2025-12-17 - Added detailed timing analysis
**Status**: Production Ready
**Cross-Platform**: ✅ Web + Mobile Compatible

*2026-01-02: Added config key encryption layer documentation (from qm delta commit)*
