---
type: bug
title: Config Save Missing React Query Cache Update Causes Stale allowSync
status: done
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: 2026-01-09T00:00:00.000Z
---

# Config Save Missing React Query Cache Update Causes Stale allowSync

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent

## Symptoms

When a user disables sync (`allowSync: false`) in UserSettingsModal and then immediately performs a folder operation (or other config-dependent operation), the console still shows:

```
[ConfigService] Posting settings to server... {address: '...', timestamp: ...}
```

This occurs even though sync was just disabled. The user's `allowSync: false` preference is not being respected by subsequent operations.

**Affected operations** (operations using `useConfig` hook + `save-user-config` action):

| Operation | File | Impact |
|-----------|------|--------|
| Folder create/edit | `src/hooks/business/folders/useFolderManagement.ts` | Overwrites allowSync |
| Folder delete | `src/hooks/business/folders/useDeleteFolder.ts` | Overwrites allowSync |
| Folder drag & drop | `src/hooks/business/folders/useFolderDragAndDrop.ts` | Overwrites allowSync |
| Space reordering | `src/hooks/business/spaces/useSpaceDragAndDrop.ts` | Overwrites allowSync |

**NOT affected** (use direct IndexedDB access, not React Query cache):
- `src/hooks/business/bookmarks/useBookmarks.ts` - calls `messageDB.getUserConfig()` directly
- `src/hooks/business/mentions/useMentionNotificationSettings.ts` - calls `messageDB.getUserConfig()` directly

## Root Cause

**Missing React Query cache update in `ConfigService.saveConfig()`**

When `saveConfig()` saves the config to IndexedDB, it does NOT update the React Query cache. Compare:

### `getConfig()` - CORRECT (lines 349-353)
```typescript
await this.messageDB.saveUserConfig({
  ...config,
  timestamp: savedConfig.timestamp,
});
// ...
await this.queryClient.setQueryData(
  buildConfigKey({ userAddress: config.address! }),
  () => config
);
```

### `saveConfig()` - MISSING CACHE UPDATE (lines 494-496)
```typescript
console.log('[ConfigService] Saving config to local DB...');
await this.messageDB.saveUserConfig(config);
console.log('[ConfigService] Config saved to local DB');
// ❌ NO queryClient.setQueryData() call!
```

**The flow that causes the bug:**

1. User disables sync → `allowSync: false` in newConfig
2. `useUserSettings` enqueues `save-user-config` with `{ config: newConfig }`
3. `useUserSettings` does NOT update React Query cache (also missing optimistic update)
4. Action queue processes → `saveConfig()` saves to IndexedDB with `allowSync: false`
5. `saveConfig()` does NOT update React Query cache
6. User does folder operation → `useConfig()` reads from React Query cache
7. Cache still has `allowSync: true` (stale!)
8. Folder operation creates newConfig spreading from stale cache → `allowSync: true`
9. Folder operation queues save → posts to server despite user wanting sync disabled

## Historical Context

**This bug existed in the `develop` branch**, but was latent:

### In `develop` branch (stable first iteration):
- `saveConfig` was called **directly** (synchronously), not via action queue
- Located in `MessageDB.tsx` (lines 5220-5221):
  ```typescript
  await messageDB.saveUserConfig(config);
  // ❌ NO cache update here either
  ```
- Fewer operations modified config (no folders)
- Operations were synchronous → less chance of race conditions

### In current branch:
- Action queue introduced → **async** saves
- Folder operations added → **more** operations reading config
- Multiple rapid operations → **higher chance** to hit stale cache
- The latent bug became a **visible, reproducible issue**

**Evidence from develop:**
- `getConfig()` in develop DID update the cache (lines 5126-5132)
- `saveConfig()` in develop did NOT update the cache (lines 5220-5221)
- Same asymmetry as current branch

## Solution

Add React Query cache update to `saveConfig()` after saving to IndexedDB:

**File**: `src/services/ConfigService.ts`

**Location**: After line 495 (`await this.messageDB.saveUserConfig(config);`)

**Change**:
```typescript
console.log('[ConfigService] Saving config to local DB...');
await this.messageDB.saveUserConfig(config);
console.log('[ConfigService] Config saved to local DB');

// Update React Query cache to prevent stale reads
this.queryClient.setQueryData(
  buildConfigKey({ userAddress: config.address! }),
  config
);
```

### Secondary fix (optional - NOT implemented)

> **Decision**: Not implemented. The primary fix is sufficient since `saveConfig()` now updates the cache immediately after saving. The action queue processes fast enough that users won't hit the race condition. Adding optimistic updates in multiple places increases maintenance burden without meaningful UX improvement.

Add optimistic cache update in `useUserSettings.ts` for immediate UI consistency:

**File**: `src/hooks/business/user/useUserSettings.ts`

**Location**: After creating `newConfig` (line 152), before enqueueing

**Change**:
```typescript
const newConfig = {
  ...existingConfig.current!,
  allowSync,
  nonRepudiable: nonRepudiable,
  name: displayName,
  profile_image: profileImageUrl,
};

// Optimistic cache update (matches folder operations pattern)
queryClient.setQueryData(
  buildConfigKey({ userAddress: currentPasskeyInfo.address }),
  newConfig
);

await actionQueueService.enqueue(
  'save-user-config',
  { config: newConfig },
  `config:${currentPasskeyInfo.address}`
);
```

## Verification

### Test Case 1: Disable sync then folder operation
1. Open UserSettingsModal
2. Toggle sync OFF (ensure it was ON before)
3. Save settings
4. Immediately create/edit a folder
5. **Expected**: Console should NOT show "Posting settings to server"
6. **Current (bug)**: Console shows "Posting settings to server"

### Test Case 2: Verify allowSync persists
1. Disable sync in UserSettingsModal
2. Perform multiple folder operations
3. Refresh the page
4. Open UserSettingsModal
5. **Expected**: Sync toggle should still be OFF
6. **Current (bug)**: Sync toggle may be ON (overwritten by folder operations)

### Test Case 3: Other config values
1. Change any config value in UserSettingsModal
2. Immediately do folder operation
3. Verify config value persists after refresh

## Prevention

1. **Pattern enforcement**: Any method that saves to IndexedDB should also update React Query cache
2. **Code review checklist**: Check for cache/DB synchronization in config-related changes
3. **Consider abstraction**: Create a unified `persistConfig()` method that handles both DB and cache

## Impact Assessment

- **Severity**: Medium-High
- **User Impact**: User privacy preference (sync disabled) can be silently overwritten
- **Data Impact**: Config posted to server when user explicitly disabled sync
- **Scope**: All config-modifying operations, not just folders

## Related Files

- `src/services/ConfigService.ts:494-496` - Missing cache update
- `src/hooks/business/user/useUserSettings.ts:146-157` - Missing optimistic update
- `src/hooks/queries/config/useConfig.ts` - React Query hook reading stale cache
- `src/hooks/queries/config/buildConfigFetcher.ts` - Fetcher reading from IndexedDB

## Related Documentation

- `.agents/docs/features/action-queue.md` - Action queue system
- `.agents/reports/action-queue/008-endpoint-dependencies.md` - Endpoint mapping

---


_Bug existed in: develop branch (latent), cross-platform_action-queue branch (visible)_
