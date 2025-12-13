# Space Recovery Tool in UserSettingsModal

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> **Reviewed by**: feature-analyzer agent, security-analyst agent

**Status**: Pending
**Complexity**: Medium
**Created**: 2025-12-13
**Files**:
- `src/components/modals/UserSettingsModal/Privacy.tsx`
- `src/hooks/business/user/useSpaceRecovery.ts` (new)
- `src/db/messages.ts:903-912` (getSpaces)
- `src/services/ConfigService.ts:391-450` (saveConfig filtering)

## What & Why

Users may lose spaces from their navigation menu due to sync issues (see [config-sync-space-loss-race-condition.md](../bugs/config-sync-space-loss-race-condition.md)). Spaces can become "orphaned" - present in IndexedDB but missing from the nav menu's `spaceIds`/`items` arrays.

Currently, users have no way to recover these spaces without technical intervention. A recovery tool in UserSettingsModal would allow users to:
1. Scan their local database for orphaned spaces
2. See which spaces are missing from navigation
3. Restore selected spaces to their nav menu

This provides user self-service recovery while the underlying sync bug is being addressed.

## Context

- **Related bug**: [config-sync-space-loss-race-condition.md](../bugs/config-sync-space-loss-race-condition.md)
- **Existing pattern**: Privacy tab in UserSettingsModal already handles security/sync settings
- **Data access**: `messageDB.getSpaces()` returns all spaces in IndexedDB
- **Nav data**: `config.spaceIds` and `config.items` define what appears in nav
- **Constraint**: Spaces need valid encryption state to function; recovery should verify this

## Prerequisites

- [x] Review related bug documentation
- [x] Understand space filtering logic in ConfigService.ts
- [x] Feature analyzed by feature-analyzer agent ✓
- [x] Security analysis by security-analyst agent ✓

## Implementation

### Phase 1: Recovery Hook (`useSpaceRecovery.ts`)

- [ ] **Create hook file** (`src/hooks/business/user/useSpaceRecovery.ts`)
  - Done when: Hook exports `useSpaceRecovery` function
  - Pattern: Follow `useUserSettings.ts` structure

- [ ] **Implement single restore function** (scan + restore combined)
  ```typescript
  const [isRestoring, setIsRestoring] = useState(false);

  const restoreMissingSpaces = async () => {
    setIsRestoring(true);
    try {
      // 1. Get all spaces from IndexedDB
      const dbSpaces = await messageDB.getSpaces();

      // 2. Get current nav space IDs from config
      const config = await messageDB.getUserConfig({ address: userAddress });
      const navSpaceIds = new Set(config.spaceIds);

      // 3. Find orphaned spaces (in DB but not in nav)
      const orphaned = dbSpaces.filter(space => !navSpaceIds.has(space.spaceId));

      // 4. Filter to only spaces with valid encryption state
      const recoverable: string[] = [];
      for (const space of orphaned.slice(0, 50)) { // Limit 50
        const encStates = await messageDB.getEncryptionStates({
          conversationId: space.spaceId + '/' + space.spaceId
        });
        const encState = encStates[0];

        if (encState) {
          const stateSize = JSON.stringify(encState).length;
          if (stateSize <= 100_000) { // 100KB limit
            try {
              if (encState.state) JSON.parse(encState.state);
              recoverable.push(space.spaceId);
            } catch { /* skip invalid */ }
          }
        }
      }

      console.log(`[SpaceRecovery] Found ${orphaned.length} orphaned, ${recoverable.length} recoverable`);

      if (recoverable.length === 0) {
        showInfo(t`No missing spaces found`);
        return;
      }

      // 5. Add spaces back to config
      const updatedConfig = {
        ...config,
        spaceIds: [...new Set([...config.spaceIds, ...recoverable])],
        items: [
          ...(config.items || []),
          ...recoverable
            .filter(id => !config.spaceIds.includes(id))
            .map(id => ({ type: 'space' as const, id }))
        ]
      };

      // 6. Save config
      await saveConfig({ config: updatedConfig, keyset });

      // 7. Invalidate React Query cache (nav menu updates automatically)
      await queryClient.invalidateQueries({
        queryKey: buildConfigKey({ userAddress })
      });

      showSuccess(t`Restored ${recoverable.length} space(s)`);
    } catch (error) {
      console.error('[SpaceRecovery] Error:', error);
      showError(t`Failed to restore spaces`);
    } finally {
      setIsRestoring(false);
    }
  };

  return { restoreMissingSpaces, isRestoring };
  ```
  - Done when: Single function handles scan + restore
  - Verify: Restored spaces appear in nav menu immediately (no refresh needed)

### Phase 2: UI Component

- [ ] **Add recovery section to Privacy.tsx**
  - Location: After "Key Export" section
  - Done when: "Data Recovery" section visible in Privacy tab

- [ ] **Create simple one-button UI**
  ```tsx
  <div className="modal-content-info">
    <Spacer size="md" direction="vertical" borderTop={true} />
    <div className="text-subtitle-2">{t`Data Recovery`}</div>
    <div className="pt-2 text-label-strong">
      {t`If some of your Spaces are missing from the navigation menu, click below to restore them.`}
    </div>
    <div className="pt-4 pb-8 max-w-[200px]">
      <Button
        type="secondary"
        onClick={onRestoreMissingSpaces}
        disabled={isRestoring}
      >
        {isRestoring ? t`Restoring...` : t`Restore Missing Spaces`}
      </Button>
    </div>
  </div>
  ```
  - Done when: Button triggers restore with loading state

- [ ] **Feedback via toasts** (handled in hook)
  - Success: "Restored X space(s)" → spaces appear in nav immediately
  - No spaces found: "No missing spaces found"
  - Error: "Failed to restore spaces"
  - Done when: User gets clear feedback

### Phase 3: Integration

- [ ] **Call hook in UserSettingsModal** (not Privacy component)
  ```typescript
  // In UserSettingsModal.tsx
  const { restoreMissingSpaces, isRestoring } = useSpaceRecovery();
  ```
  - Pattern: Same as `useUserSettings()` - call in modal, pass values to child

- [ ] **Pass to Privacy component**
  ```typescript
  <Privacy
    // ... existing props
    isRestoring={isRestoring}
    onRestoreMissingSpaces={restoreMissingSpaces}
  />
  ```
  - Done when: Full flow works end-to-end

## Verification

✅ **Restore finds and adds orphaned spaces**
   - Test: Create space, manually remove from config.spaceIds, click "Restore Missing Spaces"
   - Expected: Space appears in nav menu immediately (no refresh needed)

✅ **Restored space is functional**
   - Test: Click restored space, verify messages load
   - Expected: Can read/send messages normally

✅ **No missing spaces shows info toast**
   - Test: Click restore when all spaces are in nav
   - Expected: "No missing spaces found" toast

✅ **Spaces without encryption silently skipped**
   - Test: Space with missing/invalid encryptionState
   - Expected: Not restored, no error (just skipped)

✅ **Loading state during restore**
   - Test: Click button, observe UI
   - Expected: Button shows "Restoring..." and is disabled

✅ **TypeScript compiles**
   - Run: `npx tsc --noEmit`

✅ **No console errors during operation**

## Definition of Done

- [ ] Hook implemented with single restore function
- [ ] UI added to Privacy tab (one button)
- [ ] User clicks button → spaces restored → appear in nav immediately
- [ ] Toast feedback (success/info/error)
- [ ] Data validation (encryption state size limits)
- [ ] TypeScript passes
- [ ] Manual testing successful

## Security Considerations

- Recovery only affects local data and user's own config
- No new network endpoints or API calls (uses existing saveConfig)
- Encryption state verification prevents restoring broken spaces
- Encryption state size limited to 100KB (matches ConfigService filter)
- Recoverable spaces limited to 50 per operation

## Related Documentation

- [config-sync-space-loss-race-condition.md](../bugs/config-sync-space-loss-race-condition.md) - Root cause bug
- [config-sync-system.md](../docs/config-sync-system.md) - Sync architecture
- [useUserSettings.ts](../../src/hooks/business/user/useUserSettings.ts) - Similar hook pattern

---

_Created: 2025-12-13_
