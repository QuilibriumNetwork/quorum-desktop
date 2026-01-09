---
type: task
title: User Data Backup & Restore Feature
status: in-progress
complexity: medium
ai_generated: true
created: 2026-01-07T00:00:00.000Z
updated: '2026-01-09'
related_issues:
  - '#121'
---

# User Data Backup & Restore Feature

https://github.com/QuilibriumNetwork/quorum-desktop/issues/121

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> Reviewd by feature-analyzer agent, security-analyst agent, cryptographer agent
> Soft-review by human


**Files**:
- `src/db/messages.ts` - IndexedDB schema and MessageDB class
- `src/services/BackupService.ts` - NEW: Backup encryption/export/import logic
- `src/services/ConfigService.ts` - Reference for encryption pattern
- `src/components/modals/UserSettingsModal/` - Settings UI
- `src/hooks/business/files/useKeyBackupLogic.ts` - Existing key export logic

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
- Users experiencing the Safari passkey bug must clear cache → lose DM decryption capability forever
- Single-device users with `allowSync=false` have no redundancy for ANYTHING

## Context

### Current Data Storage Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATA LOCATION MATRIX                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ✅ RECOVERABLE (via API/sync):                                         │
│  ├── spaces             → Manifest on API: getSpaceManifest()           │
│  ├── space_keys         → Via UserConfig.spaceKeys sync                 │
│  ├── user_config        → API sync if allowSync=true                    │
│  ├── bookmarks          → Via UserConfig.bookmarks sync                 │
│  ├── space_members      → Re-fetchable from hub                         │
│  └── Space messages     → P2P sync from other members                   │
│                                                                          │
│  ⚠️ UNRECOVERABLE (DM data - LOCAL ONLY):                              │
│  ├── DM messages        → No hub, no peer sync, deleted after fetch     │
│  ├── DM conversations   → Metadata for DMs                              │
│  └── encryption_states  → Double Ratchet state for DM decryption        │
│                                                                          │
│  📋 Other local stores (reconstructable/transient):                     │
│  ├── action_queue       → Transient task queue                          │
│  ├── user_info          → Re-fetchable from API                         │
│  ├── inbox_mapping      → Reconstructable from conversations            │
│  ├── conversation_users → Re-fetchable profiles                         │
│  ├── latest_states      → Derived from encryption_states                │
│  └── deleted_messages   → Sync dedup tombstones                         │
│                                                                          │
│  🔑 Key Storage:                                                        │
│  └── WebAuthn/Passkey   → Ed448 private key (or IndexedDB fallback)    │
│                                                                          │
│  ⚠️ CRITICAL: DM data has NO sync mechanism - backup is the ONLY way   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Existing Encryption Pattern

From `ConfigService.ts` - user config is encrypted with:
```
User Ed448 Private Key → SHA-512 → First 32 bytes → AES-256-GCM key
```

This same pattern can encrypt backups - only the user with their private key can decrypt.

### Recovery Scenarios Today (Without Backup)

| Scenario | Spaces | Space Keys | Space Messages | DM Messages | DM Encryption |
|----------|--------|------------|----------------|-------------|---------------|
| Clear cache, `allowSync=true` | ✅ API | ✅ UserConfig | ✅ Peer sync | ❌ **LOST** | ❌ **LOST** |
| Clear cache, `allowSync=false` | ❌ Lost | ❌ Lost | ❌ Lost | ❌ **LOST** | ❌ **LOST** |
| New device, import key, `allowSync=true` | ✅ API | ✅ UserConfig | ✅ Peer sync | ❌ **LOST** | ❌ **LOST** |
| Safari passkey bug workaround | ✅ API | ✅ UserConfig | ✅ Peer sync | ❌ **LOST** | ❌ **LOST** |

**Key insight:** For users with `allowSync=true`, only DM data is unrecoverable. Everything else syncs.

### Understanding the Encryption Protocols

**Space Messages (Triple Ratchet)**:
- Encryption state syncs via `spaceKeys[].encryptionState` in UserConfig
- New device can decrypt Space messages IF it receives the ratchet state from sync
- All members share the same session state

**DM Messages (Double Ratchet)**:
- Encryption state is per-device, per-contact-inbox
- Each device has SEPARATE sessions with each of the other party's devices
- The `encryption_states` IndexedDB store contains these sessions
- **No mechanism exists to sync or backup these states**
- Without the exact ratchet state, past DMs are mathematically impossible to decrypt

---

## Implementation

### MVP: Export Backup Only (Settings)

Minimal viable feature - just export. Test that the backup file is valid before building restore.

- [ ] **Add DM export method to MessageDB** (`src/db/messages.ts`)
    - `getAllDMMessages()` - returns all DM messages (excludes Space messages)
    - Implementation: Get all `type: 'direct'` conversations, then fetch messages for each
    - Space messages are excluded because they resync from other members
    - DM messages cannot resync (no hub, no peer sync) - must be backed up
    - Note: `getConversations({ type: 'direct' })` already exists, just needs high limit

- [ ] **Create BackupService** (`src/services/BackupService.ts`)
    - Follow same pattern as ConfigService (keyset passed to methods, used transiently, never stored)
    - Constructor receives: `{ messageDB: MessageDB }`
    - `exportBackup({ keyset })` method collects and encrypts data
    - Collect only unrecoverable data (keeps backup small and focused)
    - Include (DM data only - the ONLY unrecoverable data):
        - `messages` (DMs only) - no hub, no peer sync, truly lost without backup
        - `conversations` (`type: 'direct'` only) - DM metadata
        - `encryption_states` - critical for decrypting DM history (Double Ratchet state)
    - Exclude (all recoverable via sync or API):
        - `messages` (Space) - resync from other space members
        - `conversations` (`type: 'group'`) - Space conversations, recoverable
        - `spaces` - manifest stored on API server, recoverable via `getSpaceManifest()`
        - `user_config` - syncs via API if `allowSync=true`
        - `space_keys` - syncs via UserConfig.spaceKeys
        - `bookmarks` - syncs via UserConfig.bookmarks
        - `action_queue` - transient task queue
        - `user_info` - re-fetchable from API
        - `inbox_mapping` - reconstructable from conversations
        - `conversation_users` - re-fetchable from API (cached profiles)
        - `latest_states` - derived from encryption_states (performance cache)
        - `muted_users` - low priority, can be re-applied manually
        - `deleted_messages` - only for sync dedup, not user data
        - `space_members` - re-fetchable from hub

- [ ] **Implement backup encryption**
    - Use domain-separated key derivation: `SHA-512('quorum-backup-v1' + privateKey)[0:32]`
    - File format: `{ version: 1, iv: hex, ciphertext: hex, createdAt: timestamp, signature: hex }`
    - Sign ALL fields: `version || iv || ciphertext || createdAt`
    - Verify signature BEFORE decryption on import

- [ ] **Add "Export Backup" button** (`UserSettingsModal/PrivacySecurity.tsx`)
    - Near existing "Export Key" button
    - Filename: `quorum_backup_YYYYMMDD_HHMMSS_XXXXXX.qmbak` (XXXXXX = last 6 chars of user address)
    - Disable button while exporting (`isProcessing` state)

**MVP Done when:** User can click button → encrypted .qmbak file downloads

---

### Phase 2: Import Backup (Settings)

Add ability to restore messages from backup while logged in.

- [ ] **Add "Import Backup" button** (next to Export)
- [ ] **Implement decryption and validation**
    - Verify signature first
    - Check `version: 1`
    - Decrypt with user's key
- [ ] **Restore data to IndexedDB**
    - Merge messages by messageId (no duplicates)
    - **Skip encryption_states** (user has active sessions)
    - Invalidate React Query cache
- [ ] **Show success message**

---

### Phase 3: Restore on Login Screen

For fresh device / cache cleared scenarios.

- [ ] **Add "Restore from Backup" option** (`Login.tsx`)
- [ ] **Flow**:
    1. User imports their Ed448 `.key` file (from "Export Key" feature)
    2. App derives AES key from imported Ed448 key
    3. User selects `.qmbak` backup file
    4. App decrypts backup with derived AES key
    5. App restores ALL data (including encryption_states - safe on fresh device)
- [ ] **Complete onboarding after restore**

**Note**: User MUST have their `.key` file to decrypt the backup. The backup is encrypted with a key derived from the Ed448 private key.

---

### Phase 4: Smart Merge (Later)

- [ ] Message deduplication by messageId
- [ ] Keep newer version on conflict
- [ ] Conversation metadata merge

---

## Edge Cases

| Scenario | Expected Behavior | Risk | Mitigation |
|----------|-------------------|------|------------|
| Restore old backup on device with newer DM states | User prompted to skip encryption_states | 🚨 High - breaks DM | Never overwrite newer states |
| Backup file corrupted | Show error, abort restore | Medium | Validate checksum/structure |
| Backup from different account | Decrypt fails (wrong key) | Low | Key derivation ensures this |
| Very large backup (years of messages) | May timeout or fail | Medium | Chunk processing, progress UI |
| Restore on device with partial sync | Merge needed | High | Deduplicate by messageId |
| User restores then peer syncs same messages | Duplicates possible | Medium | Dedupe on messageId |
| **Single-member space messages lost** | Space recovers, messages don't | Low | ⚠️ **Not covered** - see below |
| **Abandoned space (all peers offline)** | Space recovers, messages can't sync | Low | ⚠️ **Not covered** - see below |

### Limitations: Space Messages Not Backed Up

**By design, this backup feature focuses on DM data only.** Space messages are excluded because:
1. They typically resync from other members via P2P
2. Including them would make backups potentially huge (thousands of messages)

**Edge cases NOT covered:**
- **Single-member spaces**: If user creates a space, posts messages, and loses device before anyone joins → messages are lost (space definition recovers via API)
- **Abandoned spaces**: If all other members are permanently offline → messages can't sync back

**Why this is acceptable for MVP:**
- These scenarios are rare (most spaces have active members)
- Space definitions still recover (just not messages)
- Users can mitigate by inviting members or using DMs for critical 1:1 content
- Future enhancement: Optional "Include Space messages" checkbox for users with single-member spaces

### DM Encryption State Conflict - Detailed Analysis

The Double Ratchet protocol advances with EVERY message. This creates serious backup/restore challenges:

```
Scenario: User has Device A (active) and creates backup.
          User gets Device B, imports key, sends new DMs from Device B.
          User loses Device B, restores backup from Device A to Device C.

Problem: Backup has OLD ratchet states. Device B advanced the ratchet.

What happens:
┌─────────────────────────────────────────────────────────────────────────┐
│  Timeline:                                                               │
│                                                                          │
│  Device A: state=S1 ──[backup]──────────────────────[restore to C]      │
│                                                         ↓                │
│  Device B: state=S1 → S2 → S3 → S4 (new DMs)──[lost]   state=S1 (old!)  │
│                                                                          │
│  Result on Device C:                                                     │
│  - Messages sent before backup (S1): ✅ Can decrypt                     │
│  - Messages sent from Device B (S2-S4): ❌ Cannot decrypt               │
│  - New messages after restore: ⚠️ Ratchet desync with counterparty     │
└─────────────────────────────────────────────────────────────────────────┘

The counterparty's device advanced to expect state S4.
Device C is at state S1. They can no longer communicate properly.
```

**Key insight**: Unlike Space encryption (Triple Ratchet) which has a shared session, DM encryption (Double Ratchet) creates device-specific sessions. Restoring an old state doesn't just lose history - it breaks future communication.

**Mitigation strategies**:
1. **On fresh device**: Safe to restore (no existing states, counterparty will reinitialize)
2. **On device with states**: NEVER overwrite - compare timestamps, keep newer
3. **Best practice**: Create fresh backup AFTER each DM session, BEFORE switching devices
4. **Consider**: Re-initialize DM sessions after restore (loses history but fixes sync)

---

## Verification

### MVP Testing
- [ ] Export creates `.qmbak` file
- [ ] File is encrypted (not readable as plaintext)
- [ ] File contains signature
- [ ] File size is reasonable (not empty)

### Phase 2+ Testing
- [ ] Import decrypts and restores messages
- [ ] Wrong key fails gracefully
- [ ] Duplicate messages handled
- [ ] Encryption states skipped when logged in

---

## Definition of Done

### MVP
- [ ] BackupService with exportBackup() method
- [ ] Export button in Settings
- [ ] Encrypted .qmbak file downloads
- [ ] No TypeScript errors

### Full Feature
- [ ] Import in Settings (Phase 2)
- [ ] Restore on Login (Phase 3)
- [ ] Message deduplication (Phase 4)

---

## Security Requirements

> Reviewed by human + cryptographic expert

Based on security analysis, these requirements should be addressed during implementation:

### Critical (Must Fix in MVP)

1. **Domain separation in key derivation**
   - Do NOT reuse the same key derivation as UserConfig sync
   - Add context string to prevent cross-protocol attacks:
   ```
   SHA-512('quorum-backup-v1' + privateKey) → First 32 bytes → AES key
   ```
   - Different cryptographic contexts MUST use different derived keys

2. **Sign ALL fields including version and IV**
   - Sign: `version || iv || ciphertext || createdAt`
   - Verify signature BEFORE attempting decryption
   - Prevents version field manipulation and detects tampering early
   - File format: `{ version, iv, ciphertext, createdAt, signature }`

3. **Backup file size limit**
   - Add `MAX_BACKUP_SIZE = 100MB` check before processing
   - Prevents DoS via multi-GB files
   - Check size BEFORE attempting decryption

### High (Should Fix)

4. **Backup versioning**
   - Include `version: 1` in backup format
   - Reject unknown versions with clear error
   - Migration strategy can be added later when needed

5. **Disable buttons during operations**
   - Disable export/import buttons while either operation is in progress
   - Simple `isProcessing` state flag

6. **Replay protection for restore**
   - Warn user when restoring backup older than current data
   - Compare `backup.createdAt` vs latest local message timestamp
   - User must confirm to proceed with older backup

---

## Future Considerations (Out of Scope)

1. **Automatic periodic backups** - Save to local file system automatically
2. **Cloud backup integration** - Optional encrypted backup to user's cloud storage
3. **Incremental backups** - Only backup changes since last backup
4. **Cross-platform restore** - Restore desktop backup on mobile (needs quorum-shared integration)
5. **Server-side encrypted backup** - Store encrypted backup blob on API (user-controlled)
6. **Large backup handling** - Size estimation, chunked processing, compression, progress UI (not needed until file/video uploads)
7. **Post-export verification** - Decrypt backup after creation to verify integrity (AES-GCM already provides integrity, so this is extra paranoia)

---

## Related Documentation

- [Data Management Architecture](../docs/data-management-architecture-guide.md) - IndexedDB schema
- [Config Sync System](../docs/config-sync-system.md) - Encryption pattern to reuse
- [Cryptographic Architecture](../docs/cryptographic-architecture.md) - Key hierarchy
- [Passkey Authentication Flow](../reports/onboarding-flow/passkey-authentication-flow-analysis-2025-11-23.md) - Key export logic
- [Safari Passkey Bug](../bugs/safari-passkey-session-loss-random-logout.md) - Motivation for this feature

---

## Updates

**2026-01-07 - Claude**: Initial task creation. Analyzed P2P architecture, identified encryption state as critical unrecoverable data, proposed phased implementation with merge safety.

**2026-01-07 - Claude**: Clarified restore logic - two entry points with different behaviors. Settings import ALWAYS skips encryption_states (safe message restore). Login screen restore includes encryption_states (fresh device). Simplified Phase 3 since encryption state handling is now entry-point dependent.

**2026-01-07 - Claude**: Added Security Requirements section based on security-analyst review. Critical: Ed448 signature on backup files, domain-separated key derivation. High: size limits, privacy-preserving filenames, versioning, mutex, verification. Dismissed non-issues: backup file swapping (requires compromised key), timestamp binding (display-only field), login overwrite warning (fresh device by design).

**2026-01-07 - Claude**: Restructured into MVP phases. MVP = Export only (3 tasks). Phase 2 = Import in Settings. Phase 3 = Restore on Login. Phase 4 = Smart merge. Simplified security requirements after human review.

**2026-01-07 - Claude**: Feature analysis review. Clarified Phase 3 flow requires prior key import. Clarified IndexedDB store selection: skip space_keys/bookmarks stores (redundant with user_config).

**2026-01-07 - Claude**: Architecture decision: Use separate BackupService (same pattern as ConfigService). Keyset is passed to methods and used transiently - never stored. This follows existing codebase conventions and keeps code organized. The action-queue vulnerability was about persisting keys to IndexedDB, not about passing them to methods.

**2026-01-07 - Claude**: Cryptographic expert review. Added 3 critical requirements: (1) Domain separation in key derivation - use `SHA-512('quorum-backup-v1' + key)` instead of plain `SHA-512(key)` to prevent cross-protocol attacks, (2) Sign ALL fields including version and IV, (3) Backup file size limit (100MB). Added high-priority replay protection warning. Dismissed filename privacy concern as non-issue (matches key export pattern). Double Ratchet edge case analysis validated as correct.

**2026-01-07 - Claude**: Senior engineer data review. Validated understanding of data storage/sync is correct. Added complete list of excluded stores with reasons: inbox_mapping (reconstructable), conversation_users (re-fetchable), latest_states (derived), muted_users (low priority), deleted_messages (sync-only), space_members (re-fetchable). Fixed typo in config-sync-system.md: "Double Ratchet" → "Triple Ratchet" for spaceKeys (Space encryption uses Triple Ratchet, not Double).

**2026-01-08 - Claude**: Updated backup filename format to `quorum_backup_YYYYMMDD_HHMMSS_XXXXXX.qmbak` where XXXXXX is the last 6 characters of the user's address. This helps users identify which account a backup belongs to, especially when managing multiple identities.

**2026-01-08 - Claude**: Added prerequisite task for bulk export methods in MessageDB. Current methods are paginated (`getMessages`) or filtered by type (`getConversations`). Need `getAllMessages()` and `getAllConversations()` for backup export. Verified DM architecture: messages ARE truly unrecoverable - no hub storage, no peer sync for DMs, only temporary per-device inboxes that are deleted after fetch. Task assumptions are correct.

**2026-01-08 - Claude**: Scoped backup to DM-only messages. Space messages (`type: 'group'`) excluded - they resync from other space members and could be thousands of messages. DM messages (`type: 'direct'`) are much smaller in volume and truly unrecoverable. Changed `getAllMessages()` to `getAllDMMessages()`. This keeps backups small and focused on unrecoverable data only.

**2026-01-08 - Claude**: Major simplification after deep-dive into sync architecture. Discovered that spaces (including single-member/owned spaces) ARE recoverable - manifest is stored on API server via `postSpaceManifest()` and retrieved via `getSpaceManifest()`. Space keys (including owner key) sync via UserConfig.spaceKeys. For `allowSync=true` users, the ONLY unrecoverable data is DM-related: messages, conversations, and encryption_states. Removed `spaces` and `user_config` from required backup - they sync automatically. Updated data matrix and recovery scenarios to reflect this clearer understanding.

**2026-01-08 - Claude**: Documented known limitations in Edge Cases section. Space messages are intentionally NOT backed up to keep backups small. Two edge cases not covered: (1) single-member space messages lost if device lost before anyone joins, (2) abandoned space messages can't sync if all peers offline. Accepted for MVP - these are rare scenarios, space definitions still recover, future enhancement could add optional "Include Space messages" checkbox.
