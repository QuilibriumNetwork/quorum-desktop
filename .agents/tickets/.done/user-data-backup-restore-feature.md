---
type: task
title: User Data Backup & Restore Feature
status: done
complexity: medium
ai_generated: true
created: 2026-01-07T00:00:00.000Z
updated: '2026-02-16'
related_issues:
  - '#121'
---

# User Data Backup & Restore Feature

https://github.com/QuilibriumNetwork/quorum-desktop/issues/121

> **AI-Generated**: May contain errors. Verify before use.
> Reviewed by feature-analyzer, security-analyst, cryptographer, and expert-panel agents.
> Soft-review by human.

**Files**:
- `src/db/messages.ts` - IndexedDB schema and MessageDB class
- `src/services/BackupService.ts` - NEW: Backup encryption/export/import logic
- `src/services/ConfigService.ts` - Reference for encryption pattern
- `src/components/modals/UserSettingsModal/Privacy.tsx` - Settings UI (Export Key button lives here)
- `src/hooks/business/files/useKeyBackupLogic.ts` - Existing key export logic (cross-platform adapter pattern)
- `src/hooks/platform/files/useFileDownload.web.ts` - Web file download adapter (follow this pattern for backup export)

## What & Why

**Problem**: Users lose critical local data if they:
- Clear browser cache/data
- Lose/reset their device
- Get forced to re-authenticate (Safari passkey bug)
- Uninstall the mobile app

**Current State**:
- **Messages** exist ONLY on peer devices (P2P architecture) - recoverable via sync IF another peer online
- **DM encryption states** (Double Ratchet) are LOCAL ONLY with **NO recovery path** - this is the critical gap
- **Space encryption states** (Triple Ratchet) sync via `spaceKeys` in UserConfig IF `allowSync=true`
- **User config** (space memberships, bookmarks, spaceKeys) syncs to API IF `allowSync=true`

**Why This Matters**:
- DM history is **permanently unrecoverable** without backup - the Double Ratchet state cannot be reconstructed
- Users experiencing the Safari passkey bug must clear cache, losing DM decryption capability forever
- Single-device users with `allowSync=false` have no redundancy for ANYTHING

## Context

### Data Location Matrix

```
RECOVERABLE (via API/sync) IF allowSync=true:
  spaces             -> Manifest on API: getSpaceManifest()
  space_keys         -> Via UserConfig.spaceKeys sync
  user_config        -> API sync (includes bookmarks, spaceKeys, folders, settings)
  space_members      -> Re-fetchable from hub
  Space messages     -> P2P sync from other members

UNRECOVERABLE WITHOUT BACKUP (local only):
  DM messages        -> No hub, no peer sync, deleted after fetch
  DM conversations   -> Metadata for DMs
  encryption_states  -> Double Ratchet state for DM decryption
  user_config        -> LOCAL ONLY if allowSync=false (spaces, bookmarks, spaceKeys all lost)

RECONSTRUCTABLE (transient/derived):
  action_queue       -> Transient task queue
  user_info          -> Re-fetchable from API
  inbox_mapping      -> Reconstructable from conversations
  conversation_users -> Re-fetchable profiles
  latest_states      -> Derived from encryption_states
  deleted_messages   -> Sync dedup tombstones
```

### Existing Encryption Pattern

From `ConfigService.ts` - user config is encrypted with:
```
User Ed448 Private Key -> SHA-512 -> First 32 bytes -> AES-256-GCM key
```

### Recovery Scenarios Today (Without Backup)

| Scenario | Spaces | Space Keys | Space Messages | DM Messages | DM Encryption |
|----------|--------|------------|----------------|-------------|---------------|
| Clear cache, `allowSync=true` | API | UserConfig | Peer sync | **LOST** | **LOST** |
| Clear cache, `allowSync=false` | Lost | Lost | Lost | **LOST** | **LOST** |
| New device, import key, `allowSync=true` | API | UserConfig | Peer sync | **LOST** | **LOST** |
| Safari passkey bug workaround | API | UserConfig | Peer sync | **LOST** | **LOST** |

**Key insight:** For `allowSync=true` users, only DM data is unrecoverable (everything else syncs). For `allowSync=false` users, *everything* is unrecoverable — including spaces, bookmarks, and spaceKeys. The backup always includes `user_config` to cover both cases.

### Encryption Protocols

**Space Messages (Triple Ratchet)**: State syncs via `spaceKeys[].encryptionState` in UserConfig. All members share the same session state.

**DM Messages (Double Ratchet)**: State is per-device, per-contact-inbox. Each device has SEPARATE sessions. The `encryption_states` IndexedDB store contains these. **No sync mechanism exists.** Without the exact ratchet state, past DMs are mathematically impossible to decrypt.

---

## TypeScript Interfaces

Define these in `src/services/BackupService.ts`:

```typescript
/** Encrypted backup file structure (written to .qmbak) */
interface BackupFile {
  version: 1;
  iv: string;         // hex-encoded AES-GCM IV
  ciphertext: string; // hex-encoded encrypted payload
  createdAt: number;  // export timestamp
}

/** Decrypted backup payload */
interface BackupPayload {
  messages: Message[];            // type: 'direct' only
  conversations: Conversation[];  // type: 'direct' only
  encryption_states: EncryptionState[];
  user_config?: UserConfig;       // always exported; restored only on fresh device
}

/** Error categories for user-facing messages */
type BackupErrorType =
  | 'DECRYPTION_FAILED'    // wrong key or corrupted file
  | 'INVALID_FORMAT'       // not a valid .qmbak file
  | 'IMPORT_FAILED';       // IndexedDB write error
```

---

## Implementation

### Phase 1: Export Backup (MVP)

Minimal viable feature - export only. Validates the backup format before building import.

- [x] **Add DM backup export method to MessageDB** (`src/db/messages.ts`)
    - `getAllDMData(): Promise<BackupPayload>`
    - Fetch DM conversations with `getConversations({ type: 'direct' })` (already exists)
    - For each conversation, fetch messages using existing `getAllConversationMessages()` (line 1295) which already handles full conversation export
    - Collect all `encryption_states` for DM conversations
    - Also include `user_config` (always — small object, covers `allowSync=false` users)
    - Reuses existing paginated methods to avoid IndexedDB transaction timeouts

- [x] **Create BackupService** (`src/services/BackupService.ts`)
    - Follow ConfigService pattern (keyset passed to methods, used transiently, never stored)
    - Constructor receives: `{ messageDB: MessageDB }`
    - Define `BackupFile`, `BackupPayload`, and `BackupErrorType` types (see above)
    - `async exportBackup({ keyset }): Promise<Blob>` method

- [x] **Implement backup encryption**
    - Domain-separated key derivation: `SHA-512('quorum-backup-v1' + privateKey)[0:32]`
    - Encrypt JSON payload with AES-256-GCM (provides both confidentiality and authentication)
    - File format: `BackupFile { version: 1, iv, ciphertext, createdAt }`
    - AES-GCM authentication tag ensures: wrong key fails, tampered data fails, corrupted file fails

- [x] **Add "Export Backup" button** (`UserSettingsModal/Privacy.tsx`)
    - Near existing "Export Key" button
    - Filename: `quorum_backup_YYYYMMDD_HHMMSS_XXXXXX.qmbak` (XXXXXX = last 6 chars of user address)
    - Disable button while exporting (`isProcessing` state)

**MVP Done when:** User can click button, encrypted `.qmbak` file downloads.

**Data always included in export:**
- `messages` (DMs only) - no hub, no peer sync, truly lost without backup
- `conversations` (`type: 'direct'` only) - DM metadata
- `encryption_states` - Double Ratchet state for DM decryption
- `user_config` - spaces, bookmarks, spaceKeys, settings (recoverable via API sync for `allowSync=true` users, but NOT for `allowSync=false` users — including it always ensures both are covered)

**Data excluded** (all recoverable via sync, API, or reconstructable):
- Space messages, spaces, action_queue, user_info, inbox_mapping, conversation_users, latest_states, muted_users, deleted_messages, space_members

---

### Phase 2: Import Backup (Settings)

Add ability to restore messages from backup while logged in.

- [x] **Add "Import Backup" button** (next to Export)
    - File picker filtered to `.qmbak`
    - Disable both export/import buttons while either operation is in progress

- [x] **Implement decryption and validation**
    - Validate file structure matches `BackupFile` shape (version, iv, ciphertext, createdAt)
    - Reject unknown versions with clear error message
    - Derive key with same domain separation, attempt AES-GCM decryption
    - On decryption failure: show "Wrong account or corrupted backup" error
    - Validate decrypted JSON matches `BackupPayload` shape

- [x] **Restore data to IndexedDB with atomic transaction**
    - Open single `readwrite` transaction across messages + conversations stores
    - Deduplicate messages by `messageId` using `put()` (upsert - existing records kept as-is)
    - **Skip encryption_states** (user has active sessions - overwriting would break DM)
    - **Skip user_config** (user has active config - overwriting would lose current state)
    - On any write error: abort transaction (no partial imports)
    - On success: invalidate React Query cache, show success message with count

- [x] **Error handling**
    - Wrap entire import in try/catch
    - Map errors to `BackupErrorType` for user-facing messages
    - Log detailed error for debugging via `logger.error()`
    - Never leave DB in partial state (transaction abort handles this)

---

### Phase 3: Restore on Login Screen (Future — not planned)

For fresh device / cache cleared scenarios. **Deferred**: users can import backups from Settings (Phase 2) after logging in, which covers the practical use case. Phase 3 would require careful UX design around the onboarding flow — when a returning user imports their key, the app auto-detects their remote profile and skips onboarding entirely, so there's no natural screen to surface a restore option without interrupting the flow.

If revisited, key design questions to resolve first:
- Where in the login/onboarding flow should the option appear?
- How to handle the auto-skip behavior of `fetchUser` for registered users?
- Should it be a third button on the Login screen, or integrated into the onboarding state machine?
- Should `encryption_states` and `user_config` be restored on a fresh device (safe but adds complexity)?

---

## Edge Cases

| Scenario | Behavior | Mitigation |
|----------|----------|------------|
| Restore old backup on device with active sessions | Skip encryption_states and user_config (Phase 2 always skips both) | Entry-point dependent: Settings skips, Login restores |
| Backup file corrupted | AES-GCM decryption fails, show error | Graceful error message, no data modified |
| Backup from different account | Decryption fails (wrong derived key) | Show "Wrong account or corrupted backup" |
| Large backup (10K+ DMs) | Paginated export avoids timeout | Fetch messages in pages of 1000 |
| Import on device with existing messages | Dedup by messageId via `put()` | No duplicates, existing data preserved |
| Single-member space messages | **Not covered** - space definition recovers, messages don't | Acceptable: rare scenario, future enhancement possible |

### DM Encryption State Conflict

The Double Ratchet advances with EVERY message. Restoring old states doesn't just lose history - it breaks future communication with the counterparty.

```
Device A: state=S1 --[backup]------------------------[restore to C]
                                                        |
Device B: state=S1 -> S2 -> S3 -> S4 (new DMs)--[lost]  state=S1 (old!)

Result on Device C:
  Messages before backup (S1): Can decrypt
  Messages from Device B (S2-S4): Cannot decrypt
  New messages after restore: Ratchet desync with counterparty
```

**Mitigation**:
1. **Fresh device (Phase 3)**: Safe to restore - no existing states, counterparty will reinitialize
2. **Existing device (Phase 2)**: NEVER overwrite - always skip encryption_states
3. **Best practice**: Create fresh backup AFTER each DM session, BEFORE switching devices

---

## Security

### Domain Separation (Required)

Do NOT reuse the same key derivation as ConfigService/UserConfig sync. Different cryptographic contexts MUST use different derived keys:

```
ConfigService:  SHA-512(privateKey)[0:32]              -> AES key for config
BackupService:  SHA-512('quorum-backup-v1' + privateKey)[0:32] -> AES key for backups
```

### Authentication

AES-256-GCM provides authenticated encryption. On decryption:
- Wrong key -> fails (different account's backup rejected)
- Tampered ciphertext -> fails (integrity violation detected)
- Modified IV -> fails (authentication check fails)

No separate signature step needed. The authentication tag built into GCM is sufficient for our threat model (user importing their own backup file).

**Optional enhancement**: Ed448 signature on backup fields for defense-in-depth. Deprioritized - implement if time allows after core feature ships.

### Concurrency

- Disable both export/import buttons while either operation runs (`isProcessing` state)
- Service-level guard: throw if operation already in progress

---

## Verification

### Phase 1 Testing
- [ ] Export creates `.qmbak` file
- [ ] File is encrypted (not readable as plaintext)
- [ ] File is non-empty and reasonable size
- [ ] Decryption with correct key succeeds (manual validation)
- [ ] Decryption with wrong key fails

### Phase 2 Testing
- [ ] Import decrypts and restores messages
- [ ] Wrong key fails gracefully with user-facing error
- [ ] Duplicate messages not created (import twice = same data)
- [ ] Encryption states and user_config skipped when logged in
- [ ] Partial failure rolls back (no corrupt state)

---

## Definition of Done

### Phase 1 (MVP)
- [ ] `BackupPayload` and `BackupFile` TypeScript interfaces defined
- [ ] `getAllDMData()` in MessageDB (reusing existing `getAllConversationMessages()`)
- [ ] `BackupService` with `exportBackup()` method
- [ ] Export button in Settings
- [ ] Encrypted `.qmbak` file downloads
- [ ] No TypeScript errors

### Phase 2
- [ ] Import button in Settings
- [ ] Decryption + validation pipeline
- [ ] Atomic IndexedDB import with dedup and rollback
- [ ] Error handling with user-facing messages

### Phase 3 (Future — not planned)
- [ ] Restore option on Login screen (requires UX design work)
- [ ] Full restore including encryption_states and user_config

---

## Limitations (Accepted)

- **Space messages not backed up**: They resync from other members. Edge case: single-member spaces lose messages (rare, space definition still recovers via API).
- **No automatic backups**: Manual export only. Users must remember to back up.
- **No incremental backups**: Full export each time. Acceptable given DM-only scope keeps files small.
- **Phase 2 skips user_config**: When importing on an existing account, `user_config` (spaces, bookmarks, folders) is skipped to avoid overwriting the user's current state. This means an `allowSync=false` user who logged back in, joined new spaces, and *then* imports an old backup won't recover their old spaces/bookmarks. **Future enhancement**: Add a user prompt during Phase 2 import asking whether to keep current settings or replace with the backup's, with a clear explanation of what each choice means.

---

## Related Documentation

- [Data Management Architecture](../docs/data-management-architecture-guide.md) - IndexedDB schema
- [Config Sync System](../docs/config-sync-system.md) - Encryption pattern reference
- [Cryptographic Architecture](../docs/cryptographic-architecture.md) - Key hierarchy
- [Passkey Authentication Flow](../reports/onboarding-flow/passkey-authentication-flow-analysis-2025-11-23.md) - Key export logic
- [Safari Passkey Bug](../bugs/safari-passkey-session-loss-random-logout.md) - Motivation for this feature

---

## Updates

**2026-01-07 - 2026-01-08**: Initial task creation through iterative refinement. Analyzed P2P architecture, identified DM encryption state as critical unrecoverable data. Scoped to DM-only backup. Security review added domain separation, signature requirements. Data architecture validated by senior engineer review. See git history for full changelog.

**2026-02-16**: Major rewrite based on expert panel review (Architecture, Implementation, Pragmatism experts). Key changes:
- **Dropped Phase 4** (Smart Merge) - deduplication is built into Phase 2's import logic via `put()` upsert, no separate merge phase needed
- **Added TypeScript interfaces** (`BackupFile`, `BackupPayload`, `BackupErrorType`) - missing type safety flagged by all experts
- **Added error handling requirements** - atomic IndexedDB transactions with rollback, error categorization for user-facing messages
- **Added paginated export** - reuses existing `getAllConversationMessages()` to avoid browser timeouts on large datasets
- **Simplified encryption** - removed Ed448 signature requirement (AES-GCM already provides authentication); kept as optional enhancement
- **Removed "Future Considerations" section** - YAGNI; features will surface organically when needed
- **Removed 100MB file size limit** - hypothetical attack scenario; add when real usage data warrants it
- **Removed replay protection warning** - the "never overwrite newer encryption_states" logic already handles this
- **Condensed spec** from 410 lines to ~200 lines focused on actionable implementation details

**2026-02-16**: Added `user_config` to backup payload. Always exported (tiny object, covers `allowSync=false` users who have no API recovery path). On import: Phase 2 (logged in) skips it, Phase 3 (fresh device) restores it. Same skip-if-active pattern as `encryption_states`.

**2026-02-16**: Phase 1 and Phase 2 implemented and tested. Phase 3 (Restore on Login Screen) deferred — the auto-skip behavior of `fetchUser` for returning users means there's no natural onboarding screen to surface a restore option. Users can import backups from Settings after logging in (Phase 2), which is sufficient for now.
