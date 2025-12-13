# Config Sync Space Loss Race Condition

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

- User has spaces A, B, C on Device A with sync enabled
- User imports profile on Device B
- Only spaces A and B appear on Device B (space C missing)
- After some time, space C also disappears from Device A's nav menu
- Reported on one profile so far - may affect more users

## Root Cause

The `saveConfig()` function in `ConfigService.ts` **overwrites the entire remote config** based on local state, filtering out any spaces that lack complete encryption data locally. This creates a destructive race condition during cross-device sync.

### The Filtering Logic (ConfigService.ts:391-432)

```typescript
// Line 391: Get spaces from LOCAL DB only
const spaces = await this.messageDB.getSpaces();

// Lines 408-410: Filter out spaces without encryption state
config.spaceKeys = allSpaceKeys.filter(sk => sk.encryptionState !== undefined);

// Lines 414-415: Remove spaces from spaceIds if not in spaceKeys
const validSpaceIds = new Set(config.spaceKeys.map(sk => sk.spaceId));
config.spaceIds = config.spaceIds.filter(id => validSpaceIds.has(id));

// Lines 416-427: Remove spaces from nav items too
if (config.items) {
  config.items = config.items.filter(item => {
    if (item.type === 'space') {
      return validSpaceIds.has(item.id);  // ← SPACE PERMANENTLY REMOVED
    } else {
      item.spaceIds = item.spaceIds.filter(id => validSpaceIds.has(id));
      return item.spaceIds.length > 0;
    }
  });
}
```

### Race Condition Sequence

1. **Device A**: Has spaces A, B, C → saves config with all three
2. **Device B**: Imports profile, `getConfig()` runs
   - Space sync loop (lines 136-293) processes A, B, C
   - Space C fails mid-sync (network error, manifest unavailable, hub registration fails)
   - Device B has spaces A, B locally; C partially synced or missing
3. **Device B**: Any action triggers `saveConfig()`:
   - Reads local DB → only finds A, B with valid encryption states
   - Filters out C (missing or incomplete encryption state)
   - Uploads config with `{spaceIds: [A, B]}` → **C is gone from remote**
4. **Device A**: Calls `getConfig()` later
   - Remote config (newer timestamp) only has A, B
   - Local config updated to match → **C disappears from nav menu**

### Why Space Sync Can Fail Silently

In `getConfig()` lines 136-293, the space import has multiple failure points wrapped in try-catch:

```typescript
for (const space of config.spaceKeys ?? []) {
  const existingSpace = await this.messageDB.getSpace(space.spaceId);
  if (!existingSpace) {
    try {
      // Lines 140-143: Key validation (can fail)
      // Lines 156-165: Manifest fetch (can fail - logged as warning)
      // Lines 206-210: Save encryption state
      // Lines 212-256: Hub registration (can fail)
      // Lines 265-275: Save inbox key
    } catch (e) {
      console.error(t`Could not add Space`, e);  // Silent continue!
    }
  }
}
```

If any step fails, the space is **not fully initialized** but the loop continues. The space may exist in memory (in `config.spaceIds`) but not have a valid `encryptionState` in the database.

## Affected Code

| File | Lines | Issue |
|------|-------|-------|
| [ConfigService.ts](src/services/ConfigService.ts#L391-L432) | 391-432 | `saveConfig()` filters spaces without encryption state |
| [ConfigService.ts](src/services/ConfigService.ts#L136-L293) | 136-293 | `getConfig()` space sync can fail silently mid-loop |

### Triggers for `saveConfig()` (all can cause loss)

- `useUserSettings.ts:146` - User saves profile/settings
- `useSpaceDragAndDrop.ts:62` - Dragging spaces in nav
- `useFolderManagement.ts:141` - Creating/managing folders
- `useFolderDragAndDrop.ts:588` - Dragging folders
- `useDeleteFolder.ts:61` - Deleting folders
- `SpaceService.ts:449,467` - Creating spaces
- `SpaceService.ts:649` - Deleting spaces
- `InvitationService.ts:818` - Joining spaces via invite
- `EncryptionService.ts:237` - Fixing encryption states
- `MessageService.ts:2554` - Handling kick messages

## Solution

**Not yet implemented.** Requires architectural decision on approach:

### Option A: Merge Instead of Replace (Recommended)
Before `saveConfig()` overwrites remote, merge local and remote space lists:
1. Fetch current remote config
2. Merge `spaceKeys`: local takes precedence for conflicts, but preserve remote-only spaces
3. Only remove a space if explicitly deleted (add `deletedSpaceIds` tombstone array like bookmarks have)

### Option B: Delay saveConfig Until Sync Complete
Add a sync state flag to prevent `saveConfig()` during active space sync:
1. Set `isSyncingSpaces = true` at start of `getConfig()` space loop
2. Block `saveConfig()` while flag is set (queue the save)
3. Only allow save after all spaces have valid encryption states

### Option C: Mark Incomplete Spaces
Track spaces that failed to sync and exclude them from filtering:
1. Add `pendingSyncSpaces: string[]` to local state
2. When space sync fails, add to pending list
3. In `saveConfig()`, preserve `pendingSyncSpaces` in remote config
4. Retry sync for pending spaces periodically

## Prevention

Once fixed, prevent regression with:

1. **Integration test**: Simulate partial space sync failure, verify spaces preserved
2. **Sync state tracking**: Add UI indicator when spaces are syncing
3. **Conflict detection**: Warn user if remote config has spaces not present locally
4. **Audit logging**: Log space list changes during config sync for debugging

## Comparison with Bookmark Sync

Bookmarks already handle this correctly with tombstone tracking:

```typescript
// ConfigService.ts - Bookmark merge preserves deletions
config.deletedBookmarkIds?: string[];  // Tombstone tracking

private mergeBookmarks(local, remote, deletedIds) {
  // Uses additive merge with explicit deletion tracking
}
```

Spaces need similar treatment but currently lack any merge or tombstone logic.

## Impact

- **Severity**: High - causes permanent data loss (spaces removed from nav)
- **Affected users**: Anyone with `allowSync: true` using multiple devices
- **Recovery**: Space data may still exist in local IndexedDB but orphaned from nav
- **Detection**: Silent - no error message shown to user

## Related Documentation

- [config-sync-system.md](.agents/docs/architecture/config-sync-system.md) - Config sync architecture
- [user-config-sync.md](.agents/docs/features/user-config-sync.md) - Profile sync feature (different issue)

---

_Created: 2025-12-13_
_Status: Unconfirmed (reported on single profile, needs reproduction)_
