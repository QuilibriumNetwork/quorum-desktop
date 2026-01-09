---
type: doc
title: Config Sync System
status: done
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: 2025-12-12T00:00:00.000Z
---

# Config Sync System

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

The Config Sync System enables cross-device synchronization of user configuration data. When enabled via the Privacy settings toggle (`allowSync`), user data is encrypted, signed, and uploaded to the Quorum API, allowing users to restore their configuration on new devices.

**Key File**: `src/services/ConfigService.ts`

## What Gets Synced

The `UserConfig` object contains all user-specific data that syncs across devices:

```typescript
export type UserConfig = {
  address: string;                    // User's wallet address (key)
  timestamp?: number;                 // Last sync timestamp (conflict resolution)
  allowSync?: boolean;                // Privacy toggle - enables/disables sync

  // Space membership
  spaceIds: string[];                 // Legacy flat list of space IDs
  items?: NavItem[];                  // Ordered list with folder support

  // Encryption keys (for E2E encryption recovery)
  spaceKeys?: {
    spaceId: string;
    encryptionState: EncryptionState; // Triple Ratchet session state (Space encryption)
    keys: SpaceKey[];                 // config, hub, inbox keys
  }[];

  // User preferences
  notificationSettings?: {
    [spaceId: string]: NotificationSettings;
  };

  // Bookmarks (personal saved messages)
  bookmarks?: Bookmark[];
  deletedBookmarkIds?: string[];      // Tombstones for deletion sync

  nonRepudiable?: boolean;            // Message signing preference
};
```

## Architecture

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SAVE CONFIG FLOW                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User Action (create space, add bookmark, change setting)               │
│       ↓                                                                  │
│  ConfigService.saveConfig()                                              │
│       ↓                                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ 1. Collect and filter current data                              │    │
│  │    - Fetch all spaces from IndexedDB                            │    │
│  │    - Fetch space keys and encryption states                      │    │
│  │    - Filter spaces without encryption states                     │    │
│  │    - Filter spaceIds and items to match spaceKeys (consistency)  │    │
│  │    - Fetch bookmarks                                             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│       ↓                                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ 2. Encrypt (if allowSync=true)                                   │    │
│  │    - Derive AES key: SHA-512(user_private_key)[0:32]            │    │
│  │    - Generate random 12-byte IV                                  │    │
│  │    - AES-GCM encrypt JSON config                                 │    │
│  │    - Append IV to ciphertext (hex encoded)                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│       ↓                                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ 3. Sign                                                          │    │
│  │    - Message: ciphertext || timestamp (8 bytes, big-endian)      │    │
│  │    - Ed448 sign with user private key                            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│       ↓                                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ 4. Upload                                                        │    │
│  │    POST /api/settings/{address}                                  │    │
│  │    {                                                             │    │
│  │      user_address: string,                                       │    │
│  │      user_public_key: string (hex),                              │    │
│  │      user_config: string (ciphertext+iv, hex),                   │    │
│  │      timestamp: number,                                          │    │
│  │      signature: string (hex)                                     │    │
│  │    }                                                             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│       ↓                                                                  │
│  Save to local IndexedDB (always, regardless of sync)                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         GET CONFIG FLOW                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  App startup / Device switch                                             │
│       ↓                                                                  │
│  ConfigService.getConfig()                                               │
│       ↓                                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ 1. Fetch from API and local                                      │    │
│  │    - GET /api/settings/{address} → remote config                 │    │
│  │    - messageDB.getUserConfig() → local config                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│       ↓                                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ 2. Compare timestamps                                            │    │
│  │    - If remote.timestamp < local.timestamp → use local           │    │
│  │    - If remote.timestamp == local.timestamp → use local          │    │
│  │    - If remote.timestamp > local.timestamp → decrypt remote      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│       ↓                                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ 3. Verify signature                                              │    │
│  │    - Ed448 verify(public_key, ciphertext || timestamp, sig)      │    │
│  │    - If invalid → reject remote, use local                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│       ↓                                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ 4. Decrypt                                                       │    │
│  │    - Extract IV from last 24 chars (12 bytes hex)                │    │
│  │    - Derive AES key from user private key                        │    │
│  │    - AES-GCM decrypt → UserConfig JSON                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│       ↓                                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ 5. Merge and apply                                               │    │
│  │    - Sync new spaces (create inbox, register with hub)           │    │
│  │    - Merge bookmarks (last-write-wins + tombstones)              │    │
│  │    - Save merged config to local IndexedDB                       │    │
│  │    - Update React Query cache                                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Cryptographic Details

### Key Derivation

The encryption key is derived from the user's Ed448 private key:

```typescript
// Derive 64-byte hash from private key
const derived = await crypto.subtle.digest(
  'SHA-512',
  Buffer.from(new Uint8Array(userKey.user_key.private_key))
);

// Use first 32 bytes as AES-256 key
const subtleKey = await window.crypto.subtle.importKey(
  'raw',
  derived.slice(0, 32),
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'] // or ['decrypt']
);
```

### Encryption (AES-GCM)

```typescript
// Generate random IV
const iv = crypto.getRandomValues(new Uint8Array(12));

// Encrypt config JSON
const encrypted = await window.crypto.subtle.encrypt(
  { name: 'AES-GCM', iv: iv },
  subtleKey,
  Buffer.from(JSON.stringify(config), 'utf-8')
);

// Concatenate ciphertext + IV (both hex encoded)
const ciphertext = Buffer.from(encrypted).toString('hex')
                 + Buffer.from(iv).toString('hex');
```

### Signing (Ed448)

The signature covers both the ciphertext and timestamp to prevent replay attacks:

```typescript
const message = Buffer.from(
  new Uint8Array([
    ...new Uint8Array(Buffer.from(ciphertext, 'utf-8')),
    ...int64ToBytes(timestamp), // 8 bytes, big-endian
  ])
);

const signature = ch.js_sign_ed448(
  privateKeyBase64,
  message.toString('base64')
);
```

## Conflict Resolution

### Timestamp-Based Resolution

The system uses a simple **last-write-wins** strategy based on timestamps:

1. Compare `remote.timestamp` vs `local.timestamp`
2. Higher timestamp wins
3. Equal timestamps → prefer local (no network needed)

### Bookmark Merge Strategy

Bookmarks use a more sophisticated merge with tombstone tracking:

```typescript
mergeBookmarks(local, remote, deletedIds):
  1. Filter out any bookmark in deletedIds (tombstones)
  2. For bookmarks pointing to same messageId, keep newer one
  3. Combine remaining local and remote bookmarks
  4. Sort by createdAt descending
```

**Why tombstones?** Without deletion tracking, a deleted bookmark would "resurrect" when syncing with a device that still has it.

## Triggers: When Sync Happens

Config is saved (and potentially synced) when:

| Action | Files Modified |
|--------|----------------|
| Create space | `SpaceService.ts` → adds to `spaceIds` + `items` |
| Join space via invite | `InvitationService.ts` → adds to `spaceIds` + `items` |
| Create/delete folder | Various → modifies `items` array |
| Reorder spaces/folders | Drag handlers → modifies `items` array |
| Add/remove bookmark | `useBookmarks.ts` → modifies `bookmarks` + `deletedBookmarkIds` |
| Change notification settings | Settings UI → modifies `notificationSettings` |
| Toggle privacy settings | Privacy UI → modifies `allowSync`, `nonRepudiable` |

## Safety Mechanisms

### Encryption State Filtering

Spaces without complete encryption data are filtered out during sync to prevent server validation errors. This happens in two scenarios:

#### 1. Missing Encryption States

Spaces that haven't completed encryption setup are excluded:

```typescript
// Filter out spaces with undefined encryptionState
config.spaceKeys = allSpaceKeys.filter(sk => sk.encryptionState !== undefined);
```

#### 2. Bidirectional Config Consistency Check (Added 2025-12-12)

We perform **two-way filtering** to ensure perfect consistency between `spaceKeys` and `spaceIds`:

```typescript
// Step 1: Filter spaceIds/items to only include spaces WITH encryption keys
const validSpaceIds = new Set(config.spaceKeys.map(sk => sk.spaceId));
config.spaceIds = config.spaceIds.filter(id => validSpaceIds.has(id));

if (config.items) {
  config.items = config.items.filter(item => {
    if (item.type === 'space') {
      return validSpaceIds.has(item.id);
    } else {
      // For folders, filter out spaces without encryption keys
      item.spaceIds = item.spaceIds.filter(id => validSpaceIds.has(id));
      // Remove empty folders
      return item.spaceIds.length > 0;
    }
  });
}

// Step 2: Filter spaceKeys to only include keys for spaces IN the final spaceIds
const finalSpaceIds = new Set(config.spaceIds);
config.spaceKeys = config.spaceKeys.filter(sk => finalSpaceIds.has(sk.spaceId));
```

**Why bidirectional filtering?** The server validates that `spaceIds` and `spaceKeys` must be perfectly in sync:
- Every space in `spaceIds` must have keys in `spaceKeys` (prevents "missing encryption" errors)
- Every key in `spaceKeys` must reference a space in `spaceIds` (prevents "orphaned keys" errors)

Mismatches result in `400 - invalid config missing data` errors.

**Impact**:
- Spaces without complete encryption won't appear in the nav bar
- They remain in the local database (not deleted)
- Once encryption completes, they'll automatically appear on next sync

**Related bug**: Fixed folder operations failing with `400 - invalid config missing data` on staging (2025-12-12)

### Signature Verification

Remote configs with invalid signatures are rejected:

```typescript
if (!ch.js_verify_ed448(publicKey, message, signature)) {
  console.warn('received config with invalid signature!');
  return storedConfig; // Fall back to local
}
```

### Error Recovery for Bookmarks

If bookmark sync fails partway through, the system attempts to restore original local bookmarks:

```typescript
try {
  // Apply differential changes...
} catch (error) {
  // Attempt to restore original bookmarks
  for (const bookmark of localBookmarks) {
    await this.messageDB.addBookmark(bookmark);
  }
}
```

## Privacy Control

The `allowSync` toggle in Privacy settings controls whether config syncs to the server:

- **`allowSync: true`**: Full encryption → sign → upload flow
- **`allowSync: false`**: Only saves to local IndexedDB

When disabled, user data stays entirely on the local device. Switching devices requires manual setup.

## Size Limits

The API has an implicit size limit on the config payload. Based on observed failures:

- **Typical config size**: 10KB - 500KB
- **Maximum observed working**: ~1MB
- **Failure threshold**: ~21MB (caused by bloated encryption states)

The 100KB per-encryption-state filter keeps total payload well under limits.

## Related Documentation

- [Data Management Architecture](data-management-architecture-guide.md) - Overall data architecture
- [Bookmarks Feature](features/messages/bookmarks.md) - Detailed bookmark sync implementation
- [Bloated Encryption States Bug](../bugs/bloated-encryption-states-sync-failure.md) - Known issue with large states

## File Reference

| File | Purpose |
|------|---------|
| `src/services/ConfigService.ts` | Main sync implementation |
| `src/db/messages.ts:50-75` | UserConfig type definition |
| `src/utils.ts:17-18` | getDefaultUserConfig() |
| `src/api/baseTypes.ts` | API client methods |
| `src/hooks/queries/config/` | React Query integration |

---


*Updated: 2025-12-12* - Added spaceIds/items filtering for server validation consistency
