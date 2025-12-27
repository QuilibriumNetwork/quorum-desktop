# Triple Ratchet State Save Destroys Template/Evals Fields

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

When attempting to send a private invite to an existing conversation (without generating a public invite first), users receive the error:

```
Error: Encryption state is missing required template data. Please generate a public invite link first.
```

This error occurs at `InvitationService.ts:74` when `constructInviteLink()` checks for `sets[0].template`.

**Expected behavior**: Private invites should work at any time, regardless of whether messages have been sent in the space.

**Actual behavior**: Private invites only work if NO messages have been sent in the space after creation. Once a message is sent, the `template` and `evals` fields are lost.

## Root Cause

### The Bug

When `encryptAndSendToSpace()` saves the encryption state after `TripleRatchetEncrypt`, it **only saves the ratchet state**, discarding the `template` and `evals` fields required for private invite generation.

**Location**: `src/services/MessageService.ts:216-227`

```typescript
const saveState = async () => {
  await this.messageDB.saveEncryptionState(
    {
      state: JSON.stringify({ state: result.ratchet_state }),  // ❌ BUG: Only saves ratchet state
      timestamp: Date.now(),
      inboxId: spaceId,
      conversationId: spaceId + '/' + spaceId,
      sentAccept: false,
    },
    true
  );
};
```

### Why This Matters

The encryption state for spaces has THREE components:

| Field | Purpose | Needed For |
|-------|---------|------------|
| `state` | Triple Ratchet state for encryption | Message encryption/decryption |
| `template` | DKG ratchet template | Private invite generation |
| `evals` | Polynomial evaluations (~10,000 secrets) | Private invite generation (consumes one per invite) |

When only `{ state: result.ratchet_state }` is saved, `template` and `evals` are permanently lost.

### Compare With Correct Pattern

The receive-side code in the same file correctly preserves all fields:

**Location**: `src/services/MessageService.ts:2390-2393`

```typescript
newState = JSON.stringify({
  ...keys,                          // ✅ CORRECT: Preserves template/evals
  state: JSON.stringify(ratchet),   // Updates only ratchet_state
});
```

### This Is a Regression

**develop branch**: Does NOT save encryption state after `TripleRatchetEncrypt` for regular space messages (see `MessageDB.tsx:4828-4855`). This inadvertently preserved template/evals by not overwriting them.

**cross-platform branch**: Added state saving (which IS needed for ratchet synchronization), but the implementation loses template/evals.

### Additional Bug Locations

The same bug pattern was introduced in three more locations by commit `a37bb283`:

| Location | Context |
|----------|---------|
| `MessageService.ts:3593-3608` | Edit message path |
| `MessageService.ts:3740-3755` | Pin message path |
| `MessageService.ts:3854-3869` | Retry message path |

All use the same incorrect pattern: `JSON.stringify({ state: result.ratchet_state })`.

## Solution

### Fix 1: Preserve existing fields when saving state

Update `encryptAndSendToSpace()` to preserve template/evals:

```typescript
// In encryptAndSendToSpace() - MessageService.ts:188-246
const response = await this.messageDB.getEncryptionStates({
  conversationId: spaceId + '/' + spaceId,
});
const sets = response.map((e) => JSON.parse(e.state));

// ... encryption logic ...

const saveState = async () => {
  await this.messageDB.saveEncryptionState(
    {
      state: JSON.stringify({
        ...sets[0],                    // ✅ Preserve template, evals, and any other fields
        state: result.ratchet_state,   // Update only the ratchet state
      }),
      timestamp: Date.now(),
      inboxId: response[0]?.inboxId || spaceId,
      conversationId: spaceId + '/' + spaceId,
      sentAccept: false,
    },
    true
  );
};
```

### Fix 2: Apply same fix to edit/pin/retry paths

Update the three locations from commit `a37bb283` with the same pattern.

### Files to Modify

| File | Lines | Context |
|------|-------|---------|
| `src/services/MessageService.ts` | 216-227 | `encryptAndSendToSpace()` |
| `src/services/MessageService.ts` | 3593-3608 | Edit message path |
| `src/services/MessageService.ts` | 3740-3755 | Pin message path |
| `src/services/MessageService.ts` | 3854-3869 | Retry message path |

## Prevention

1. **Pattern documentation**: Add a comment explaining the full structure of space encryption states
2. **Type safety**: Consider creating a TypeScript interface for the complete encryption state structure
3. **Unit test**: Add test verifying template/evals are preserved after message send

## Verification

After fix:
1. Create a new space
2. Send a message in the space
3. Go to Space Settings → Invites
4. Select an existing conversation
5. Click "Send Invite"
6. ✅ Should succeed (currently fails with "missing template data" error)

## Open Questions

Before implementing the fix, verify:

1. **Does `...sets[0]` spreading work correctly?**
   - `sets[0]` should contain `{ state, template, evals }`
   - After spread + override: `{ ...sets[0], state: newRatchetState }` should preserve `template` and `evals`
   - Need to confirm this doesn't introduce any nested object reference issues

2. **Are there edge cases where template/evals should NOT be preserved?**
   - After `generateNewInviteLink()` - a new session is created with fresh template/evals
   - After `kickUser()` - a rekey happens
   - These operations already save the full session object, so this fix shouldn't interfere

3. **Does this pattern match what the codebase already does?**
   - ✅ YES - Line 2390-2393 uses `{ ...keys, state: JSON.stringify(ratchet) }` for control messages
   - The fix aligns with the established pattern

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Breaking existing message encryption | Low | The fix only adds fields, doesn't change ratchet_state handling |
| Breaking state saving for Action Queue | Low | The state field is still saved correctly |
| Stale template/evals after rekey | Low | Rekey operations save full session, not just ratchet_state |

## Related Documentation

- [Invite System Analysis](.agents/docs/features/invite-system-analysis.md) - Full invite system documentation
- [Encryption State Structure](src/services/InvitationService.ts:55-105) - How template/evals are used
- [Space Message Comparison Audit](.agents/reports/action-queue/004-space-message-code-comparison-audit.md) - Original analysis that led to a37bb283

## Commit History

| Commit | Description | Impact |
|--------|-------------|--------|
| `a37bb283` | Added state saving for edit/pin paths | Introduced the bug pattern |
| `b5013cf6` | Extracted `encryptAndSendToSpace()` | Consolidated the bug into shared helper |

---

_Created: 2025-12-27_
_Branch: cross-platform_
_Introduced by: Service extraction refactor + commit a37bb283_
