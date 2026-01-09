---
type: bug
title: Space Owner Delete Permissions Bug
status: archived
created: 2025-09-11T00:00:00.000Z
updated: '2026-01-09'
related_issues:
  - '#68'
---

# Space Owner Delete Permissions Bug

https://github.com/QuilibriumNetwork/quorum-desktop/issues/68

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

## Proposed Solution: Add `ownerAddress` to Space Type

### Solution Overview

Add an `ownerAddress` field to the Space type, following the same trust model as roles. This aligns with how Discord/Telegram handle ownership - as metadata that all clients can see and trust.

### Implementation Details

1. **Modify Space Type** (`src/api/quorumApi.ts`):
```typescript
export type Space = {
  spaceId: string;
  spaceName: string;
  ownerAddress?: string;  // Optional for backwards compatibility
  // ... existing fields
}
```

2. **Set During Space Creation** (`src/components/context/MessageDB.tsx`):
```typescript
// Derive owner address from public key
const ownerSh = await sha256.digest(Buffer.from(ownerPair.public_key));
const ownerAddress = base58btc.baseEncode(ownerSh.bytes);

const space = {
  spaceId: spaceAddress,
  spaceName: spaceName,
  ownerAddress: ownerAddress,  // Add this
  // ... rest of fields
}
```

3. **Check in Deletion Logic**:
```typescript
// In both saveMessage and addMessage functions
if (decryptedContent.content.senderId === space.ownerAddress) {
  // Honor delete from space owner
  shouldHonorDelete = true;
}
```

### Why This Solution Works

1. **Consistent Security Model**: Uses same trust model as roles - space data is signed on creation/update
2. **No Additional Verification Needed**: Like roles, once the space data is verified and stored, it's trusted
3. **Simple Implementation**: Follows existing patterns in the codebase
4. **Aligns with Industry Standards**: Discord and Telegram use similar approaches

### Migration for Existing Spaces - FEASIBLE

✅ **UPDATE**: After further analysis, migration IS feasible using existing infrastructure!

#### How Migration Would Work

The system already has secure space update verification:

1. **Space updates are signed** with the owner's private key
2. **Server has registered owner public keys** (`owner_public_keys` array)
3. **Other clients verify signatures** before accepting updates (lines 1308-1368 in MessageDB.tsx)

This means we can safely add `ownerAddress` to existing spaces:

```typescript
// In updateSpace function
if (!space.ownerAddress && owner_key) {
  const sh = await sha256.digest(Buffer.from(owner_key.publicKey, 'hex'));
  space.ownerAddress = base58btc.baseEncode(sh.bytes);
}
```

#### Migration Strategies

1. **Automatic Migration** (Recommended):
   - When space owner makes ANY update (name, roles, channels, etc.)
   - System automatically adds `ownerAddress` if missing
   - Transparent to users, gradual rollout

2. **Semi-Automatic Migration**:
   - Prompt appears when owner opens SpaceEditor
   - "Update space for enhanced permissions" message
   - One-click update

3. **Manual Migration**:
   - Add "Enable Owner Permissions" button in settings
   - Only shows for spaces without `ownerAddress`
   - Explicit user action required

#### Implementation Complexity: LOW-MEDIUM

**Simple because:**
- Existing verification infrastructure handles security
- No new cryptographic operations needed
- Other clients automatically accept valid updates
- Can be done incrementally (non-breaking)

**Considerations:**
- Need backwards compatibility during transition
- Some spaces may remain unmigrated if owners don't update
- Testing across different client versions

### Security Considerations

- The `ownerAddress` is derived from the owner's public key at space creation
- Space manifests are cryptographically signed, preventing tampering
- Delete messages are already signed, allowing verification of sender identity
- Trust model matches existing role system (trust the Space object after initial verification)

---

## Implementation Path

### Phase 1: Core Implementation
1. Add `ownerAddress?: string` to Space type (optional field)
2. Set `ownerAddress` during new space creation
3. Update deletion permission checks to honor `ownerAddress`

### Phase 2: Migration Support
1. Modify `updateSpace` to auto-add `ownerAddress` when missing
2. Test signature verification across clients
3. Deploy with backwards compatibility

### Phase 3: User Experience
1. Consider adding migration prompt or make it fully automatic
2. Document for users with admin role workaround for unmigrated spaces
3. Monitor migration adoption rate

---


**Priority**: High - Space owners cannot perform expected administrative actions
**Migration Impact**: MEDIUM - Existing spaces CAN be migrated using existing secure update mechanism
**Implementation Difficulty**: LOW-MEDIUM - Uses existing infrastructure

**Last Updated**: 2025-09-13
