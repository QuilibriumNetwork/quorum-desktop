# Bloated Encryption States Causing Config Sync Failure

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms
- Creating a space fails with API error: `invalid config missing data` (400 Bad Request)
- The error occurs during `ConfigService.saveConfig` when `allowSync: true`
- The `user_config` payload is ~21MB (should be <1MB)
- Only affects accounts that have been heavily used for testing

## Root Cause
Some spaces have abnormally large `encryptionState.state` values (~2MB each instead of a few KB). The encryption state is the serialized Double Ratchet session used for E2E encryption.

**Affected data structure**: `spaceKeys[].encryptionState.state` (stored in `encryption_states` IndexedDB table)

**Example of bloated spaces found during debugging**:
```
QmQ9rMCs7s... state: 2,020,485 bytes (should be ~10KB)
QmaAmbTJQS... state: 2,020,448 bytes
Qmaa7TT5Hj... state: 2,020,679 bytes
QmbRsVoZAX... state: 2,021,634 bytes
QmbigfEwHY... state: 2,020,461 bytes
```

**Unknown**: Why these states grew so large. Possible causes:
- Bug in Double Ratchet implementation accumulating old message keys
- Corruption during testing
- Memory leak in session serialization
- Issue with how states are saved/merged

## Solution (Temporary Workaround)
Added a filter in `ConfigService.saveConfig` to skip encryption states larger than 100KB:

```typescript
// src/services/ConfigService.ts (lines 403-414)
const allSpaceKeys = await Promise.all(spaceKeysPromises);
const MAX_STATE_SIZE = 100000; // 100KB limit per encryption state
config.spaceKeys = allSpaceKeys.filter(sk => {
  if (sk.encryptionState === undefined) return false;
  const stateSize = JSON.stringify(sk.encryptionState).length;
  if (stateSize > MAX_STATE_SIZE) {
    console.warn('Skipping bloated encryption state for space:', sk.spaceId, 'size:', stateSize);
    return false;
  }
  return true;
});
```

**Impact of workaround**: Spaces with bloated states won't sync their encryption session to other devices. Users would need to re-establish encryption on new devices for those spaces.

## Debug Code for Future Investigation

To re-enable debugging, add this code in `ConfigService.saveConfig` after building the payload (around line 446):

```typescript
// Debug config size breakdown
console.log('Config size breakdown:');
console.log('  spaceKeys:', JSON.stringify(config.spaceKeys || []).length, 'bytes, count:', config.spaceKeys?.length);
console.log('  bookmarks:', JSON.stringify(config.bookmarks || []).length, 'bytes, count:', config.bookmarks?.length);
console.log('  items:', JSON.stringify(config.items || []).length, 'bytes, count:', config.items?.length);
console.log('  spaceIds:', JSON.stringify(config.spaceIds || []).length, 'bytes, count:', config.spaceIds?.length);
console.log('  Total config JSON:', JSON.stringify(config).length, 'bytes');

// Per-space breakdown
console.log('  Per-space key sizes:');
(config.spaceKeys || []).forEach(function(sk) {
  const size = JSON.stringify(sk).length;
  const keysSize = JSON.stringify(sk.keys || []).length;
  const stateSize = JSON.stringify(sk.encryptionState || {}).length;
  console.log('    ' + sk.spaceId.substring(0, 10) + '... total:', size, 'keys:', keysSize, '(' + (sk.keys?.length || 0) + ' keys)', 'state:', stateSize);
});
```

## Further Investigation Needed
1. Examine the actual content of a bloated `state` string to understand what's accumulating
2. Check `EncryptionService.ts` and Double Ratchet usage for potential memory leaks
3. Review how `saveEncryptionState` is called - possible duplicate/accumulated saves
4. Check if this correlates with specific user actions (heavy messaging, rejoining spaces, etc.)

## Prevention
- Consider adding a size limit check when saving encryption states
- Add monitoring/alerts for unusually large encryption states
- Investigate periodic cleanup of old message keys in the Double Ratchet implementation

## Related Files
- `src/services/ConfigService.ts:403-414` - Workaround filter
- `src/db/messages.ts:135-137` - encryption_states table definition
- `src/db/messages.ts:429-445` - getEncryptionStates method
- `src/db/messages.ts:780-795` - saveEncryptionState method
- `src/services/EncryptionService.ts` - Double Ratchet implementation

---

_Created: 2025-12-09_
_Status: Workaround implemented, root cause investigation pending_
