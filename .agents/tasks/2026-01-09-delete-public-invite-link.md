---
type: task
title: 'Task: Implement Delete Public Invite Link Feature'
status: open
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: '2026-01-09'
related_issues:
  - '#101'
---

# Task: Implement Delete Public Invite Link Feature

> **⚠️ AI-Generated**: May contain errors. Verify before use.

https://github.com/QuilibriumNetwork/quorum-desktop/issues/101

Enable space owners to delete public invite links, removing server-side invite evals and returning to private-only mode.

## Prerequisites

**⚠️ BLOCKER: Backend API required first**

Must implement `DELETE /invite/evals` endpoint that:
- **Accepts**: `config_public_key`, `space_address`, `owner_public_key`, `owner_signature`
- **Verifies**: Ed448 cryptographic signature for authorization
- **Deletes**: All invite evals associated with the config key
- **Returns**:
  - `200 OK` with `{ status: "deleted", count: N }` on success
  - `404 Not Found` if config key has no evals
  - `401 Unauthorized` if signature verification fails
  - `403 Forbidden` if requester is not space owner
- **Note**: This is a **hard blocker** - frontend implementation depends on this endpoint

**Current limitation**: "Generate New Link" orphans old server data but can't truly delete it.

**Why this matters**:
- Users cannot return space to "private-only" mode without generating replacement link
- Orphaned evals accumulate in backend storage
- No audit trail for link revocation
- Privacy concern: old cryptographic material remains indefinitely

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
  try {
    await this.apiClient.deleteSpaceInviteEvals({
      config_public_key: configKey.publicKey,
      space_address: spaceId,
      owner_public_key: ownerKey.publicKey,
      owner_signature: signature,
    });
  } catch (error) {
    // If deletion fails, don't update local state
    console.error('Failed to delete invite evals from server:', error);
    throw new Error(t`Failed to delete invite link. Please try again.`);
  }

  // Update local state (only after successful server deletion)
  const oldInviteUrl = space.inviteUrl;
  const oldIsPublic = space.isPublic;

  space.inviteUrl = '';
  space.isPublic = false;

  try {
    await this.messageDB.saveSpace(space);

    // Update manifest
    const manifest = await this.createSpaceManifest(space);
    await this.apiClient.postSpaceManifest(spaceId, manifest);

    // Invalidate cache
    queryClient.invalidateQueries({
      queryKey: buildSpaceKey({ spaceId }),
    });
  } catch (error) {
    // Rollback local state if manifest update fails
    space.inviteUrl = oldInviteUrl;
    space.isPublic = oldIsPublic;
    await this.messageDB.saveSpace(space);

    console.error('Failed to update space state after deletion:', error);
    throw new Error(t`Invite link deleted from server but local state update failed. Please refresh.`);
  }
}
```

#### Hook Implementation (`src/hooks/business/spaces/useInviteManagement.ts`)

Add to interface:
```typescript
export interface UseInviteManagementReturn {
  // ... existing fields

  // Delete invite link
  deleting: boolean;
  deleteInviteLink: () => Promise<void>;
}
```

Add state and method:
```typescript
const [deleting, setDeleting] = useState<boolean>(false);

const deleteInviteLink = useCallback(async () => {
  if (!space) return;

  setDeleting(true);
  try {
    await invitationService.deleteInviteLink(space.spaceId, queryClient);
  } catch (error) {
    console.error('Delete invite link error:', error);
    throw error; // Re-throw for UI error handling
  } finally {
    setDeleting(false);
  }
}, [space, invitationService, queryClient]);
```

#### UI Components
- **`Invites.tsx`**: Add "Delete Link" button next to "Generate New Link"
- **`SpaceSettingsModal.tsx`**: Add delete confirmation modal with text:
  - Title: "Delete Public Invite Link?"
  - Body: "This will permanently delete the public invite link. Anyone with the current link will no longer be able to join. You can generate a new link later if needed."
  - Actions: "Cancel" and "Delete Link" (destructive style)
- Add state management: `showDeleteModal`, `deleting`, `deletionSuccess`, `deletionError`

### 3. Testing

**Functional Tests:**
- Delete link removes server evals and updates UI to show "Generate Public Invite Link" button
- Space state updated: `inviteUrl = ''` and `isPublic = false`
- Old link returns 404 when accessed
- Can generate new public invite after deletion
- Can send private invites after deletion

**Edge Cases:**
- **Concurrent joins**: User tries to join with link during deletion
  - Expected: Join fails with 404 or succeeds before deletion completes
- **Multi-device sync**: User deletes link on Device A, checks on Device B
  - Expected: Device B shows deletion after next sync/refresh
- **Network failures**: Server deletion succeeds but manifest update fails
  - Expected: Rollback mechanism restores local state with error message
- **Invalid signatures**: Malicious deletion request with wrong signature
  - Expected: Backend rejects with 401/403 error
- **Permission check**: Non-owner tries to delete link
  - Expected: Backend verifies owner signature and rejects

**Error Handling:**
- Server error during deletion: Show error, keep link active
- Partial failure: Server succeeds, local update fails: Show guidance to refresh
- Network timeout: Show retry option

## Files to Modify

- `src/api/baseTypes.ts` - Add `deleteSpaceInviteEvals()` method
- `src/api/quorumApi.ts` - Add URL helper `getSpaceInviteEvalsDeleteUrl()`
- `src/services/InvitationService.ts` - Add `deleteInviteLink()` method
- `src/hooks/business/spaces/useInviteManagement.ts` - Add delete state/methods
- `src/components/modals/SpaceSettingsModal/Invites.tsx` - Add delete button
- `src/components/modals/SpaceSettingsModal/SpaceSettingsModal.tsx` - Add delete modal


## Implementation Sequence

1. ✅ **Backend API** (FIRST - hard blocker)
2. ⏸️ **Frontend API Client** (after backend ready)
3. ⏸️ **Service Layer** (after API client)
4. ⏸️ **Hook Layer** (after service)
5. ⏸️ **UI Layer** (after hook)
6. ⏸️ **Testing** (final step)

---
