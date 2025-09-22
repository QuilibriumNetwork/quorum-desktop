# Invite System Documentation

## Overview

The Quorum desktop application features a sophisticated dual-key invite system that supports both private and public invite links for spaces. This document explains how the invite system works, its architecture, and important behavioral considerations.

## Architecture Overview

The invite system operates through several key components:

### Core Components

1. **SpaceEditor.tsx** - Main UI for managing invites (lines 742-907)
2. **useInviteManagement.ts** - Hook managing invite state and logic
3. **useInviteValidation.ts** - Hook for validating invite links
4. **useSpaceJoining.ts** - Hook for joining spaces via invites
5. **MessageDB.tsx** - Core database operations for invites
6. **InviteLink.tsx** - Component for displaying and processing invite links

### Data Flow

1. **Invite Creation**: Generated through `generateNewInviteLink()` in MessageDB.tsx (lines 3829-3869)
2. **Invite Sending**: Sent via `sendInviteToUser()` to direct message conversations (lines 3800-3827)
3. **Invite Processing**: Links parsed and validated through `useInviteValidation` hook
4. **Space Joining**: Users join via `joinInviteLink()` function (lines 4290-4346)

## Invite Types and Behavior

### Private Invites

Private invites are sent directly to users via existing conversations or manual address entry. They use unique cryptographic keys for each space and remain private between the sender and recipient.

**Characteristics:**
- Unique keys per invite
- Sent through direct messages
- Valid indefinitely (until public links are enabled)
- Cannot be shared publicly

### Public Invite Links

Public invite links are shareable URLs that anyone can use to join a space. They use a different key system from private invites.

**Characteristics:**
- Same URL for all users
- Can be shared anywhere
- Regeneratable (invalidates previous public link)
- Permanent switch from private-only mode

## Critical System Behavior

### 🚨 Permanent System Switch

Once you generate a public invite link, the system **PERMANENTLY** switches from private-only to public-only mode. This is a **one-way operation** with significant implications.

**Exact Behavior Flow:**

1. **Phase 1 - Private Only Mode:**
   - Send private invites via "existing conversations" or manual address
   - All use unique, secure private keys per invite
   - Private invites remain valid indefinitely

2. **Phase 2 - The Switch (PERMANENT):**
   - Generate first public link → **ALL previous private invites immediately stop working**
   - Original config key is **overwritten** with new public key (MessageDB.tsx line 4007-4016)
   - System permanently switches to public-only mode

3. **Phase 3 - Public-Only Mode (NO GOING BACK):**
   - "Send invite to existing conversations" now sends the **same public URL** to everyone
   - No more unique private invites possible
   - All future invites are the same public link

**🔥 Most Important Misunderstanding:**

**WRONG:** "After creating public link, I can still send new private invites from scratch"
**CORRECT:** "After creating public link, ALL invites become the public URL - there are no more private invites ever"

**Critical Code Evidence:**

```typescript
// constructInviteLink() decision logic - MessageDB.tsx lines 3933-3935
const constructInviteLink = React.useCallback(async (spaceId: string) => {
  const space = await messageDB.getSpace(spaceId);
  if (space?.inviteUrl) {
    return space.inviteUrl; // ← ALWAYS returns public URL if it exists
  }
  // ← This private invite code is NEVER reached again once public link exists
```

**User Experience Impact:**

- **Private-Only Spaces**: Private invites are truly private and never expire
- **Post-Public Spaces**: The "Send invite" feature becomes a public link distributor
- **No Rollback**: There's no way to return to private-only mode once public links are enabled
- **All Future Invites**: Same URL for everyone, no matter how you send them

**Example Timeline:**
1. Send 5 private invites → All work with unique keys
2. Generate public link → Those 5 private invites immediately break
3. Send "private" invite to friend → Actually sends the public URL
4. Regenerate public link → Previous public URL breaks, friend's link stops working
5. Send another "private" invite → Sends the new public URL (same for everyone)

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

**Private Invites (Original Keys):**

```
https://[domain]/#spaceId={SPACE_ID}&configKey={ORIGINAL_CONFIG_PRIVATE_KEY}&template={TEMPLATE}&secret={SECRET}&hubKey={HUB_PRIVATE_KEY}
```

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
3. **Template Construction**: Uses existing encryption states and ratchets
4. **Link Generation**: Includes template, secret, and hub keys
5. **Validation**: Uses original config keys for decryption

**Public Links (generateNewInviteLink):**

1. **Key Generation**: Create new X448 key pair
2. **Key Storage**: Save new config keys to database
3. **Space Update**: Set `space.inviteUrl` with new link
4. **Manifest Creation**: Encrypt space data with new keys
5. **Validation**: Uses new config keys for decryption

### Key Decision Logic

```typescript
// The critical decision point in constructInviteLink()
if (space?.inviteUrl) {
  return space.inviteUrl; // PUBLIC SYSTEM
} else {
  // PRIVATE SYSTEM - use original keys
  const config_key = await messageDB.getSpaceKey(spaceId, 'config');
  const hub_key = await messageDB.getSpaceKey(spaceId, 'hub');
}
```

### Database Operations

- **Space Keys**: Multiple types stored ('hub', 'owner', 'config', 'space')
- **Key Evolution**: Original keys preserved, new keys added when public links enabled
- **Space State**: `inviteUrl` property determines which key system is active
- **Member Management**: Real-time updates via WebSocket sync
- **Message History**: Persistent storage in local MessageDB

## Recommendations

### Security Improvements

1. **Implement Kicked User Tracking**: Create persistent ban list to prevent re-joining
2. **Enhanced Validation**: Add kicked user checks in invite processing
3. **Key System Warning**: Alert users that enabling public links invalidates private invites
4. **Separate Key Systems**: Consider maintaining both key systems simultaneously

### UX Improvements

1. **Better Error Messages**: Distinguish between expired, invalid, and access-denied scenarios
2. **Kicked User Notifications**: Clear indication when users are blocked from spaces
3. **Invite History**: Track sent invites and their status
4. **Key System Education**: Explain the difference between private and public invite systems
5. **Migration Warning**: Warn users before switching from private-only to public linking

### Code Quality

1. **Centralized Validation**: Move invite validation logic to single location
2. **Type Safety**: Improve TypeScript definitions for invite-related types
3. **Error Handling**: More granular error categorization and handling
4. **Documentation**: Better code comments explaining the dual key system

### Critical UX Issues to Address

1. **Hidden Key Switch**: Users don't understand that enabling public links breaks private invites
2. **Misleading Tooltips**: Current tooltip doesn't explain the dual system impact
3. **No Rollback**: Once public links are enabled, there's no way to go back to private-only mode

### Current Public Invite Link UI Flow

**No Link State**: Shows warning text + "Generate Public Invite Link" button → Direct generation → Link appears with "Delete Current Link" and "Generate New Link" buttons

**Link Exists State**: Shows copyable link field with action buttons → "Delete Current Link" (modal confirm) or "Generate New Link" (modal confirm) → Operations show loading callouts → Success callouts (3s auto-dismiss)

During any generation operation, existing UI elements hide and only the relevant loading callout displays.

## Summary

The invite system uses a sophisticated **dual key architecture** that supports both private and public invite modes. Key characteristics:

1. **Private invites are permanent** - they use stable space creation keys
2. **Public link generation is a one-way operation** - permanently changes invite behavior
3. **"Expiration" errors are key mismatches** - not time-based expiration
4. **No persistent user blocking** - kicked users can easily rejoin

The system is cryptographically sound but requires careful understanding of the permanent switch from private to public mode.

## Frequently Asked Questions

### Can kicked users receive new invites?

**Answer: YES** - There are no blocks preventing kicked users from receiving invites in existing conversations.

The system allows selecting any existing conversation and does not check if users were previously kicked. Previously kicked users can still receive invite messages in their direct conversations.

### Why do I get "Invite Link Expired" errors?

**Answer:** This occurs due to cryptographic validation failures, not time-based expiration.

**Common Causes:**
- Key system conflict between original space keys vs. public link keys
- Links using old keys after public link generation
- Missing or corrupted space configuration

The error message "expired or invalid" is misleading - invite links don't actually expire based on time.

### Can kicked users rejoin via public invite links?

**Answer: YES** - Kicked users can immediately rejoin via public invite links.

There is no persistent "ban list" or kicked user tracking. Public invite links bypass membership checks entirely.

**Prevention methods:**
- Regenerate invite links after kicking users
- Switch to private-only invites
- Manually manage invite distribution

### Can I go back to private-only mode after enabling public links?

**Answer: NO** - Enabling public links is a permanent, one-way operation.

Once you generate a public link, all future "private" invites will actually send the same public URL. There is no way to return to true private-only mode.

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
- `src/components/context/MessageDB.tsx` - Uses dynamic domain for invite generation
- `src/components/modals/JoinSpaceModal.tsx` - Uses dynamic domain for display
- `src/hooks/business/spaces/useInviteValidation.ts` - Dynamic validation prefixes

---

_Document created: July 30, 2025_
_Updated: September 22, 2025_
_Covers: SpaceEditor.tsx, useInviteManagement.ts, useInviteValidation.ts, useSpaceJoining.ts, MessageDB.tsx, InviteLink.tsx, inviteDomain.ts_
