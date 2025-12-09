# Invite System Documentation

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

The Quorum desktop application features a sophisticated dual-key invite system that supports both private and public invite links for spaces. This document explains how the invite system works, its architecture, and important behavioral considerations.

## Architecture Overview

The invite system operates through several key components:

### Core Components

1. **SpaceSettingsModal.tsx** - Main UI for managing invites (lines 742-907)
2. **useInviteManagement.ts** - Hook managing invite state and logic
3. **useInviteValidation.ts** - Hook for validating invite links
4. **useSpaceJoining.ts** - Hook for joining spaces via invites
5. **InvitationService.ts** - Encapsulates core invite-related business logic and interacts with MessageDB for persistence.
6. **MessageDB Context** - Provides access to InvitationService and other services.
7. **InviteLink.tsx** - Component for displaying and processing invite links

### Data Flow

1. **Invite Creation**: Handled by `InvitationService` via `generateNewInviteLink()`
2. **Invite Sending**: Sent via `sendInviteToUser()` to direct message conversations (logic likely within `MessageService` or `InvitationService`)
3. **Invite Processing**: Links parsed and validated through `useInviteValidation` hook
4. **Space Joining**: Users join via `InvitationService`'s `joinInviteLink()` function

## Invite Types and Behavior

### Private Invites

Private invites are sent directly to users via existing conversations or manual address entry. They use unique cryptographic keys for each space and remain private between the sender and recipient.

**Characteristics:**
- Unique keys per invite
- Sent through direct messages
- **Single-use consumption**: Each invite generation consumes one secret from a finite pool
- **Limited supply**: Spaces have a limited number of secrets available for private invites
- Cannot be shared publicly

### Public Invite Links

Public invite links are shareable URLs that anyone can use to join a space. They use a different key system from private invites.

**Characteristics:**
- Same URL for all users
- Can be shared anywhere
- Regeneratable (invalidates previous public link)
- Permanent switch from private-only mode

## Critical System Behavior

### ⚠️ System Switch Behavior

When you generate a public invite link, the system switches from private-only to public-only mode.

**Exact Behavior Flow:**

1. **Phase 1 - Private Only Mode:**
   - Send private invites via "existing conversations" or manual address
   - Each invite generation consumes one secret from the space's finite `evals` array
   - Generated invites remain valid until the space switches to public mode
   - **Limited capacity**: Spaces can only generate a finite number of private invites

2. **Phase 2 - The Switch:**
   - Generate first public link → **ALL previous private invites immediately stop working**
   - New public key is generated alongside original keys (logic now within `InvitationService` or `SpaceService`)
   - System switches to public-only mode while public link exists

3. **Phase 3 - Public-Only Mode:**
   - "Send invite to existing conversations" now sends the **same public URL** to everyone
   - No more unique private invites possible while public link exists
   - Can generate new public links (invalidates old one by creating new config key)
   - **Cannot delete**: True deletion requires backend API endpoint that doesn't exist

**🔥 Most Important Understanding:**

**KEY BEHAVIOR:** "After creating public link, ALL invites become the public URL"
**LIMITATION:** "Cannot return to private-only mode - deletion requires backend API support"

**Critical Code Evidence:**

```typescript
// constructInviteLink() decision logic (now within InvitationService)
// The MessageDB Context provides access to the InvitationService, which orchestrates this logic.
const constructInviteLink = React.useCallback(async (spaceId: string) => {
  // Interaction with SpaceService or MessageDB for space data
  const space = await messageDB.getSpace(spaceId); // This call would be internal to a service
  if (space?.inviteUrl) {
    return space.inviteUrl; // ← Returns public URL if it exists and is truthy
  }
  // ← Falls back to private invite generation when inviteUrl is empty/deleted
```

**Private Invite Secret Consumption (now orchestrated by InvitationService):**

```typescript
// Private invite generation consumes secrets from finite pool
const index_secret_raw = sets[0].evals.shift(); // ← REMOVES secret from evals array
const secret = Buffer.from(new Uint8Array(index_secret_raw)).toString('hex');
// The InvitationService would handle saving the modified encryption state
// await messageDB.saveEncryptionState( // This call would be internal to a service
//   { ...response[0], state: JSON.stringify(sets[0]) }, // ← SAVES modified state
//   true
// );
// Each private invite permanently consumes one secret from the evals array
```

**Regenerate Functionality (Invalidates Old Link):**

```typescript
// Generate new config keypair
const configPair = JSON.parse(ch.js_generate_x448());

// Post new evals with NEW config key
await apiClient.postSpaceInviteEvals({
  config_public_key: newConfigKey,
  space_evals: newEvals,
  ...
});

// Update local inviteUrl to use new key
space.inviteUrl = `${baseUrl}#spaceId=${spaceId}&configKey=${newConfigKey}`;
```

**User Experience Impact:**

- **Private-Only Spaces**: Private invites are truly private and never expire (until switching to public)
- **Active Public Spaces**: The "Send invite" feature becomes a public link distributor
- **No Rollback**: Once in public mode, cannot return to private-only (requires backend delete API)
- **Regeneration Works**: Creating new public link orphans old server data, making old link unusable

**Example Timeline:**
1. Send 5 private invites → 5 secrets consumed from `evals` array, invites work with unique keys
2. Generate public link → Those 5 private invites immediately break, but secrets already consumed
3. Send "private" invite to friend → Actually sends the public URL (no secrets consumed)
4. Generate new public link → Old public link stops working (new config key), old server data orphaned
5. Cannot return to private mode → Stuck in public-only mode permanently

## Technical Architecture Details

### Dual Key System Architecture

**Two Separate Invite Systems:**

1. **Original Space Keys** (Space Creation):

   ```
   Created: When space is first created
   Keys: config_key, hub_key (from space creation)
   Used by: constructInviteLink() when space.inviteUrl is null
   Lifetime: Permanent until public links are enabled
   ```

2. **Public Link Keys** (On-Demand Generation):
   ```
   Created: When generateNewInviteLink() is called
   Keys: New X448 key pairs + updated config
   Used by: constructInviteLink() when space.inviteUrl exists
   Lifetime: Until regenerated
   ```

### Invite Link Structures

**Private Invites (Original Keys + Consumed Secrets):**

```
https://[domain]/#spaceId={SPACE_ID}&configKey={ORIGINAL_CONFIG_PRIVATE_KEY}&template={TEMPLATE}&secret={CONSUMED_SECRET}&hubKey={HUB_PRIVATE_KEY}
```

**Note**: The `secret` parameter comes from `evals.shift()` - each private invite permanently consumes one secret from the space's finite pool.

**Public Links (Generated Keys):**

```
https://[domain]/invite/#spaceId={SPACE_ID}&configKey={NEW_CONFIG_PRIVATE_KEY}
```

**Domain Resolution (as of September 22, 2025):**
- **Production** (`app.quorummessenger.com`): Uses `qm.one` for short links
- **Staging** (`test.quorummessenger.com`): Uses `test.quorummessenger.com`
- **Local Development** (`localhost`): Uses `localhost:port` with http protocol

### Cryptographic Flow

**Private Invites (constructInviteLink):**

1. **Check**: Does `space.inviteUrl` exist?
2. **If NO**: Use original space creation keys
3. **Secret Consumption**: `sets[0].evals.shift()` permanently removes one secret from the finite pool
4. **Template Construction**: Uses existing encryption states and ratchets
5. **Link Generation**: Includes template, consumed secret, and hub keys
6. **State Update**: The `InvitationService` now handles saving the modified encryption state (with one less secret) back to the database.
7. **Validation**: Uses original config keys for decryption

**Public Links (generateNewInviteLink):**

1. **Key Generation**: Create new X448 key pair
2. **Key Storage**: Save new config keys to database
3. **Space Update**: Set `space.inviteUrl` with new link
4. **Manifest Creation**: Encrypt space data with new keys
5. **Validation**: Uses new config keys for decryption

### Key Decision Logic

```typescript
// The critical decision point in constructInviteLink(), now orchestrated by InvitationService
if (space?.inviteUrl) {
  return space.inviteUrl; // PUBLIC SYSTEM
} else {
  // PRIVATE SYSTEM - use original keys. These calls would be internal to a service.
  const config_key = await messageDB.getSpaceKey(spaceId, 'config');
  const hub_key = await messageDB.getSpaceKey(spaceId, 'hub');
}
```

### Database Operations

- **Space Keys**: Multiple types stored ('hub', 'owner', 'config', 'space')
- **Key Evolution**: Original keys preserved, new keys added when public links enabled
- **Space State**: `inviteUrl` property determines which key system is active
- **Member Management**: Real-time updates via WebSocket sync
- **Message History**: Persistent storage in local MessageDB, managed by `MessageService`.

## Recommendations

### Security Improvements

1. **Implement Banned User Tracking**: Create persistent ban list to prevent re-joining
2. **Enhanced Validation**: Add banned user checks in invite processing


### Code Quality

1. **Centralized Validation**: Move invite validation logic to single location
2. **Type Safety**: Improve TypeScript definitions for invite-related types
3. **Error Handling**: More granular error categorization and handling
4. **Documentation**: Better code comments explaining the dual key system

### Current Public Invite Link UI Flow

**No Link State**: Shows warning text + "Generate Public Invite Link" button → Direct generation → Link appears with "Generate New Link" button

**Link Exists State**: Shows copyable link field with "Generate New Link" button (modal confirm) → Operations show loading callouts → Success callouts (3s auto-dismiss)

**Note**: Delete button was removed (2025-10-04) as true deletion requires backend API support that doesn't exist.

## Summary

The invite system uses a sophisticated **dual key architecture** that supports both private and public invite modes. Key characteristics:

1. **Private invites consume finite secrets** - each generation permanently uses one secret from the `evals` array
2. **Public link mode is NOT reversible** - switching to public is permanent (deletion requires backend API)
3. **"Expiration" errors are validation failures** - often due to secret exhaustion or key mismatches
4. **No persistent user blocking** - kicked users can easily rejoin
5. **Regeneration invalidates old links** - creates new config key, orphaning old server data

The system is cryptographically sound but switching to public mode is a one-way operation with current implementation.

## Frequently Asked Questions

### Can kicked users receive new invites?

**Answer: YES** - There are no blocks preventing kicked users from receiving invites in existing conversations.

The system allows selecting any existing conversation and does not check if users were previously kicked. Previously kicked users can still receive invite messages in their direct conversations.

### Why do I get "Invite Link Expired" errors?

**Answer:** This occurs due to cryptographic validation failures, not time-based expiration.

**Common Causes:**
- **Secret exhaustion**: Space has run out of secrets in the `evals` array for private invites
- **Key system conflict**: Using private invite links after switching to public mode
- Links using old keys after public link generation
- Missing or corrupted space configuration

The error message "expired or invalid" is misleading - invite links don't actually expire based on time, but private invites have limited capacity.

### Can kicked users rejoin via public invite links?

**Answer: YES** - Kicked users can immediately rejoin via public invite links.

There is no persistent "ban list" or kicked user tracking. Public invite links bypass membership checks entirely.

**Prevention methods:**
- Regenerate invite links after kicking users (creates new config key)
- Manually manage invite distribution
- ~~Switch to private-only invites~~ (not possible once in public mode)

### Can I go back to private-only mode after enabling public links?

**Answer: NO** - Cannot return to private-only mode with current implementation.

True deletion requires a backend `DELETE /invite/evals` API endpoint that doesn't exist. You can only:
- **Regenerate** the public link (invalidates old one by creating new config key)
- **Cannot delete** server-side invite evals (remains in public mode permanently)

---

## Environment-Specific Invite System (September 2025 Update)

### Dynamic Domain Resolution

The invite system now dynamically detects the environment and uses appropriate domains:

**Implementation:** `src/utils/inviteDomain.ts`

1. **Production Environment** (`app.quorummessenger.com`):
   - Generates invite links with `qm.one` (short domain)
   - Accepts both `qm.one` and `app.quorummessenger.com` links
   - Maintains backward compatibility with all existing invites

2. **Staging Environment** (`test.quorummessenger.com`):
   - Generates invite links with `test.quorummessenger.com`
   - Only accepts staging domain links (isolation from production)
   - Prevents cross-environment invite confusion

3. **Local Development** (`localhost:port`):
   - Generates invite links with `http://localhost:port`
   - Accepts all domains for comprehensive testing
   - Supports common development ports (3000, 5173, etc.)

### Key Benefits:
- **No hardcoded domains**: Automatically adapts to deployment environment
- **Staging isolation**: Test environment works independently
- **Local testing**: Developers can test invite flows without deployment
- **Production safety**: No changes to existing production behavior

### Files Modified:
- `src/utils/inviteDomain.ts` - New utility for dynamic domain resolution
- `src/components/context/MessageDB.tsx` - Provides access to `InvitationService` which uses dynamic domain for invite generation
- `src/components/modals/JoinSpaceModal.tsx` - Uses dynamic domain for display
- `src/hooks/business/spaces/useInviteValidation.ts` - Dynamic validation prefixes

## Duplicate Prevention (Fixed)

**Issues Fixed**: Multiple join messages, redundant invites to existing members

**Changes**:
- `InvitationService.joinInviteLink()` - Added membership check before saving member/sending join message
- `useInviteManagement.invite()` - Added membership validation with warning display
- `MessageDB` context - Provides access to `SpaceService` for `getSpaceMember()` for membership checks

**Result**: Clean invite flow with no duplicate joins or redundant invite sending.

---

_Created: July 30, 2025 by Claude Code_
_Updated: September 22, 2025 - Corrected reversibility of public invite links_
_Updated: September 25, 2025 - Added duplicate prevention fixes_
_Updated: October 4, 2025 - Corrected deletion capability (requires backend API, not currently possible)_
_Verified: December 9, 2025 - File paths confirmed current_
_Covers: SpaceEditor.tsx, useInviteManagement.ts, useInviteValidation.ts, useSpaceJoining.ts, InvitationService.ts, MessageDB Context, InviteLink.tsx, inviteDomain.ts_
