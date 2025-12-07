# FolderEditorModal Race Condition on Auto-Open After Folder Creation

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

When automatically opening the FolderEditorModal immediately after creating a folder via drag-and-drop:

1. Modal initially finds the folder correctly (`found: true, items: Array(11)`)
2. Config gets overwritten from another source (`found: false, items: Array(12)`) - items count increases but folder ID disappears
3. Modal's `saveChanges` runs with `isEditMode: false`
4. A NEW empty folder is created instead of editing the existing one
5. The original folder with spaces becomes invisible/orphaned

**Console log pattern observed:**
```
[FolderManagement] Looking for folder {folderId: 'd7fad7af-...', found: true, itemCount: 11, ...}
[FolderManagement] Looking for folder {folderId: 'd7fad7af-...', found: false, itemCount: 12, ...}
[FolderManagement] Creating new folder in modal - this is unexpected
```

## Root Cause

Race condition between multiple config update sources:

1. **Drag handler** (`useFolderDragAndDrop.ts`) creates folder and does optimistic React Query cache update
2. **Modal opens** after 100ms timeout via `onFolderCreated` callback
3. **Config sync** (likely from websocket or server response) overwrites the cache with stale/different data
4. **Modal's `useFolderManagement` hook** re-renders with the new config that doesn't contain the folder ID
5. **Save operation** runs with `isEditMode: false`, creating a duplicate empty folder

The items array growing (11 → 12 → 13) suggests configs are being merged or accumulated rather than replaced cleanly.

## Affected Files

- `src/hooks/business/folders/useFolderDragAndDrop.ts:576-582` - `onFolderCreated` callback with setTimeout
- `src/hooks/business/folders/useFolderManagement.ts` - Hook that depends on config having the folder
- `src/components/navbar/NavMenu.tsx:104-108` - Where callback is wired up (currently disabled)
- `src/services/ConfigService.ts` - Config sync logic that may be overwriting cache

## Current Workaround

The `onFolderCreated` callback is disabled in `NavMenu.tsx`:
```typescript
const folderDrag = useFolderDragAndDrop({
  config,
  // TODO: Auto-open modal on folder creation causes issues - disabled for now
  // onFolderCreated: openFolderEditor,
});
```

Users can right-click the folder and select "Edit" from the context menu to customize it after creation.

## Potential Solutions

### Option 1: Ensure Config Persistence Before Opening Modal
Wait for `saveConfig` to complete and config to be persisted/synced before opening modal:
```typescript
await saveConfig({ config: newConfig, keyset });
// Wait for React Query to settle
await queryClient.invalidateQueries({ queryKey: buildConfigKey(...) });
// Then open modal
onFolderCreated?.(folderId);
```

### Option 2: Pass Folder Data Directly to Modal
Instead of having modal look up folder by ID, pass the folder object directly:
```typescript
onFolderCreated?.({ id: folder.id, name: folder.name, spaceIds: folder.spaceIds, ... });
```

### Option 3: Use Optimistic UI with Rollback
Track pending folder creation state and prevent config overwrites until creation is confirmed.

### Option 4: Debounce/Lock Config Updates
Implement a lock mechanism during folder creation flow to prevent concurrent config updates from interfering.

## Investigation Needed

1. Identify exactly what triggers the config update that overwrites the optimistic cache update
2. Check if `ConfigService.getConfig` is being called and overwriting with stale server data
3. Verify if websocket messages trigger config refetches
4. Determine if the issue is in React Query cache management or the sync logic

## Prevention

- Consider implementing a config version/timestamp check to prevent stale overwrites
- Add integration tests for folder creation + immediate edit flow
- Document the config update flow and potential race conditions

---

_Created: 2025-12-07_
