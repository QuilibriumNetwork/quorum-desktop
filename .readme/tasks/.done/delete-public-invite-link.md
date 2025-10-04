# Task: Implement Delete Public Invite Link Feature

> **⚠️ AI-Generated**: May contain errors. Verify before use.

Enable space owners to delete public invite links, removing server-side invite evals and returning to private-only mode.

## Prerequisites

**Backend API required**: `DELETE /invite/evals` endpoint that:
- Accepts `config_public_key`, `space_address`, `owner_public_key`, `owner_signature`
- Verifies cryptographic signature for authorization
- Deletes all invite evals for the config key
- Supports atomic operations with manifest updates

**Current limitation**: "Generate New Link" orphans old server data but can't truly delete it.

## Implementation Steps

### 1. Backend API Endpoint
Create `DELETE /invite/evals` with signature verification and atomic delete operations.

### 2. Frontend Implementation

#### API Client (`src/api/baseTypes.ts`)
```typescript
deleteSpaceInviteEvals(
  spaceInviteEvalsDelete: {
    config_public_key: string;
    space_address: string;
    owner_public_key: string;
    owner_signature: string;
  }
) {
  return this.post<{ status: string }>(getSpaceInviteEvalsDeleteUrl(), {
    body: spaceInviteEvalsDelete,
  });
}
```

Add URL helper to `src/api/quorumApi.ts`:
```typescript
export const getSpaceInviteEvalsDeleteUrl = () => `/invite/evals/delete`;
```

#### Service Method (`src/services/InvitationService.ts`)
```typescript
async deleteInviteLink(
  spaceId: string,
  queryClient: QueryClient
) {
  const space = await this.messageDB.getSpace(spaceId);
  const ownerKey = await this.messageDB.getSpaceKey(spaceId, 'owner');
  const configKey = await this.messageDB.getSpaceKey(spaceId, 'config');

  // Create signature proof
  const signature = Buffer.from(
    JSON.parse(
      ch.js_sign_ed448(
        Buffer.from(ownerKey.privateKey, 'hex').toString('base64'),
        Buffer.from(
          'delete' + configKey.publicKey + spaceId,
          'utf-8'
        ).toString('base64')
      )
    ),
    'base64'
  ).toString('hex');

  // Delete from server
  await this.apiClient.deleteSpaceInviteEvals({
    config_public_key: configKey.publicKey,
    space_address: spaceId,
    owner_public_key: ownerKey.publicKey,
    owner_signature: signature,
  });

  // Update local state
  space.inviteUrl = '';
  space.isPublic = false;
  await this.messageDB.saveSpace(space);

  // Update manifest
  const manifest = await this.createSpaceManifest(space);
  await this.apiClient.postSpaceManifest(spaceId, manifest);

  // Invalidate cache
  queryClient.invalidateQueries({
    queryKey: buildSpaceKey({ spaceId }),
  });
}
```

#### Hook & UI Components
- Add `deleteInviteLink()` method to `useInviteManagement.ts`
- Add delete button back to `Invites.tsx`
- Add delete confirmation modal to `SpaceSettingsModal.tsx`
- Add state management (`deleting`, `deletionSuccess`, `errorMessage`)

### 3. Testing

- Delete link removes server evals and updates UI
- Concurrent joins handled properly
- Multi-device sync works
- Network failures rollback gracefully
- Invalid signatures rejected
- Can generate private invites after deletion

## Files to Modify

- `src/api/baseTypes.ts` - Add `deleteSpaceInviteEvals()` method
- `src/api/quorumApi.ts` - Add URL helper `getSpaceInviteEvalsDeleteUrl()`
- `src/services/InvitationService.ts` - Add `deleteInviteLink()` method
- `src/hooks/business/spaces/useInviteManagement.ts` - Add delete state/methods
- `src/components/modals/SpaceSettingsModal/Invites.tsx` - Add delete button
- `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx` - Add delete modal


---

_Created: 2025-10-04 by Claude Code_
_Updated: 2025-10-04 - Delete button removed from UI, task documentation created_