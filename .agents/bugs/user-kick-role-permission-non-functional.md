# user:kick Role Permission is Non-Functional for Non-Owners

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Symptoms

The `user:kick` permission can be assigned to roles in Space Settings, but **moderators (non-owners) cannot actually kick users** even when they have a role with this permission.

- The "Kick User" permission appears in the role settings dropdown
- Users with this permission see the Kick button in the UI
- **Clicking the button fails** because the underlying operation requires cryptographic keys that only the space owner possesses

## Root Cause

The `kickUser()` function in [SpaceService.ts:663-730](src/services/SpaceService.ts#L663-L730) requires the **space owner's ED448 private key** to:

1. Sign the new space registration (line 725-730)
2. Sign the space manifest update (line 794-806)
3. Sign the sync envelope for broadcasting the kick (line 951-979)

When a non-owner calls `kickUser()`:

```typescript
// Line 686 - This returns undefined for non-owners
const ownerKey = await this.messageDB.getSpaceKey(spaceId, 'owner');

// Lines 707, 715, 727 - These crash because ownerKey is undefined
...hexToSpreadArray(ownerKey.publicKey)...
...ownerKey.privateKey...
```

**The owner key is only stored when creating a space** ([SpaceService.ts:370-377](src/services/SpaceService.ts#L370-L377)). When users join via invite, they only receive:
- `hub` key
- `config` key
- `inbox` key

They **never receive the `owner` key** because sharing it would compromise space security.

## Comparison: message:delete Works, user:kick Does Not

| Permission | How it works | Non-owner support |
|------------|--------------|-------------------|
| `message:delete` | Delete messages are **regular encrypted messages** that receiving clients validate by checking sender's roles | ✅ Works - validated on receive side |
| `user:kick` | Kick requires **owner signature** on space registration + manifest + sync envelope | ❌ Broken - requires owner private key |

The `message:delete` permission works because:
1. The sender broadcasts a delete message (no special key needed)
2. **Receiving clients** validate if sender has `message:delete` role ([MessageService.ts:839-848](src/services/MessageService.ts#L839-L848))

The `user:kick` permission fails because:
1. Kicking requires signing with the owner's ED448 private key
2. Only the space owner has this key
3. There's no delegation mechanism for moderators

## Solution

**Remove the `user:kick` permission from the role settings UI** until a proper delegation mechanism is implemented.

### Immediate Fix (Remove Broken Feature)

1. **Remove from role permission options** in [Roles.tsx:168-171](src/components/modals/SpaceSettingsModal/Roles.tsx#L168-L171):
   ```typescript
   // Remove this option:
   {
     value: 'user:kick',
     label: t`Kick Users`,
   },
   ```

2. **Remove from Permission type** (optional, for cleanup):
   - File: [quorumApi.ts:3](src/api/quorumApi.ts#L3)
   - Remove `'user:kick'` from the union type

3. **Remove canKickUser checks** that reference role permissions:
   - [channelPermissions.ts:113-124](src/utils/channelPermissions.ts#L113-L124) - Simplify to only check `isSpaceOwner`
   - [permissions.ts:53](src/utils/permissions.ts#L53) - Remove from owner's implicit permissions (owner already can kick via protocol)

### Future Implementation (If Delegated Kicking is Desired)

A proper implementation would require one of:

**Option A: Owner Delegation via Signed Authorization**
- Moderator requests kick
- Owner client receives request and signs it
- Broadcast the owner-signed kick
- Requires owner to be online

**Option B: Multi-Signature Protocol Change**
- Modify protocol to accept moderator signatures for kicks
- Receiving clients would validate both moderator role AND moderator signature
- Requires protocol-level changes to the Quilibrium SDK

Both options are significant architectural changes and should be tracked as a separate feature task if needed.

## Files Affected

**UI (to remove broken feature):**
- `src/components/modals/SpaceSettingsModal/Roles.tsx:168-171` - Permission dropdown

**Types (optional cleanup):**
- `src/api/quorumApi.ts:3` - Permission type definition

**Permission logic (simplification):**
- `src/utils/channelPermissions.ts:113-124` - canKickUser function
- `src/utils/permissions.ts:53` - getPermissions function

## Prevention

When adding permission-based features:
1. **Verify the underlying operation can actually be performed by non-owners**
2. Check if the operation requires cryptographic keys that are owner-only
3. Add receiving-side validation if the permission is broadcast-based
4. Don't expose UI for features that will fail at runtime

---

_Created: 2025-12-14_
_Severity: Medium (broken feature, no security impact)_
_Type: Feature that was implemented incompletely_
