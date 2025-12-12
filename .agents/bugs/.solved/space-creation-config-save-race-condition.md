# Space Creation Config Save Race Condition

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

When creating a new space, the space does not appear in the navigation menu after creation completes. This happens on both localhost and staging with sync enabled. A page refresh is required to see the newly created space.

### Observable Behavior
1. User creates a new space successfully
2. Space is saved to database
3. Space does NOT appear in left navigation bar
4. User refreshes page → space now appears
5. Console shows sync succeeded with no errors

### Debug Evidence
From console logs during space creation:
```
[DEBUG] Before filtering: {spaceIds: 15, spaceKeys: 16, items: 12}
```

The new space (`QmW9Hfzqqc96Z5zNf9HbGUm178Qrqoz38ezfKs4LbSvjJu`) is in `spaceIds` (15 spaces) but NOT in `spaceKeys` (only has keys for 14 other spaces + 2 orphaned spaces).

After filtering logic runs, the new space gets removed because it lacks encryption keys, causing it to disappear from the nav menu.

---

## Root Cause

### The Race Condition

In `SpaceService.ts` (and the original `MessageDB.tsx` on develop), space creation follows this sequence:

```typescript
// WRONG ORDER (line 447-468 in SpaceService.ts):
await saveConfig({                           // 1. Save config (with new space in spaceIds)
  config: {
    ...config,
    spaceIds: [...config.spaceIds, spaceAddress]  // ← Space added to config
  },
  keyset,
});

await messageDB.saveEncryptionState({       // 2. Save encryption state AFTER
  state: JSON.stringify(session),
  conversationId: spaceAddress + '/' + spaceAddress,
  ...
});
```

**What happens:**
1. `saveConfig()` is called with the new space in `spaceIds`
2. Inside `saveConfig()` (ConfigService.ts:392-411), it fetches encryption states from the database
3. **The new space doesn't have encryption state yet** because it hasn't been saved
4. The bidirectional filtering logic (added 2025-12-12 for server validation) removes spaces without encryption
5. New space gets filtered out of `spaceIds` before sync
6. User sees no space in nav menu

### Why It Worked Before

The original `develop` branch had the SAME ordering bug (confirmed via git history - see `MessageDB.tsx` line 2938-2958), BUT it didn't cause visible issues because:

- **No filtering existed** in develop's `saveConfig`
- Spaces without encryption were still synced to server
- Server didn't validate `spaceIds ⟷ spaceKeys` consistency

### Why It Fails Now

On 2025-12-12, we added bidirectional filtering to fix folder operations failing with `400 - invalid config missing data`:

```typescript
// ConfigService.ts:413-442
// Filter spaceIds to only include spaces WITH encryption keys
const validSpaceIds = new Set(config.spaceKeys.map(sk => sk.spaceId));
config.spaceIds = config.spaceIds.filter(id => validSpaceIds.has(id));

// Filter spaceKeys to only include keys for spaces IN spaceIds
const finalSpaceIds = new Set(config.spaceIds);
config.spaceKeys = config.spaceKeys.filter(sk => finalSpaceIds.has(sk.spaceId));
```

This filtering is **necessary** for server validation (server rejects configs where `spaceIds.length !== spaceKeys.length`), but it exposes the ordering bug in space creation.

---

## Solution

**Swap the order**: Save encryption state BEFORE saving config.

### Implementation (SpaceService.ts:431-471)

```typescript
// CORRECT ORDER:
// 1. Save encryption state FIRST
await this.messageDB.saveEncryptionState({
  state: JSON.stringify(session),
  timestamp: ts,
  conversationId: spaceAddress + '/' + spaceAddress,
  inboxId: inboxAddress,
}, true);

// 2. Save config AFTER (now encryption exists when filtering runs)
const config = await this.messageDB.getUserConfig({
  address: registration.user_address,
});
await this.saveConfig({
  config: {
    ...config,
    spaceIds: [...config.spaceIds, spaceAddress],
  },
  keyset,
});
```

### Why This Works

When `saveConfig()` runs:
1. It fetches encryption states from database (line 398-407)
2. **New space NOW has encryption state** (saved in step 1)
3. Filtering logic keeps the space (has encryption ✓)
4. Config syncs with space included
5. Space appears in nav menu immediately

### Files Changed
- `src/services/SpaceService.ts:431-471` - Moved `saveEncryptionState` before config save

---

## Prevention

### Rule: Always Save Encryption Before Config

Any code that adds a space to `spaceIds` must ensure encryption state exists first:

```typescript
// ✅ CORRECT pattern:
await saveEncryptionState({ ... });  // 1. Encryption first
await saveConfig({
  spaceIds: [...spaceIds, newSpace]  // 2. Then add to config
});

// ❌ WRONG pattern:
await saveConfig({
  spaceIds: [...spaceIds, newSpace]  // Config first
});
await saveEncryptionState({ ... });  // Encryption after
```

### Where to Check

Search for any code that modifies `spaceIds` or `items`:
```bash
git grep "spaceIds.*push\|spaceIds.*=.*\[" src/services/
```

Verify encryption is saved BEFORE `saveConfig` is called.

### Test During Development

When creating/joining spaces, check console for debug logs:
```
[DEBUG] Before filtering: {spaceIds: X, spaceKeys: Y}
```

If `spaceIds > spaceKeys` after a space operation, encryption is being saved too late.

---

## Related Issues

- **Folder operations failing with 400** - Fixed 2025-12-12 by adding bidirectional filtering
- **Server validation** - Server requires perfect `spaceIds ⟷ spaceKeys` consistency
- **Original develop branch** - Had same bug but was hidden by lack of filtering

---

_Created: 2025-12-12_
_Fixed: 2025-12-12_
