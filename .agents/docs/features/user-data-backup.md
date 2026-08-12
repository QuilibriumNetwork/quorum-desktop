---
type: doc
title: User Data Backup & Restore
status: done
ai_generated: true
reviewed_by: null
created: 2026-02-16
updated: 2026-08-12
related_docs:
  - data-management-architecture-guide.md
  - config-sync-system.md
  - cryptographic-architecture.md
related_tasks:
  - user-data-backup-restore-feature.md
---

# User Data Backup & Restore

> **AI-Generated**: May contain errors. Verify before use.

## Overview

The backup system allows users to export and import encrypted `.qmbak` files containing their direct message history and, since format v2, their Spaces and Space keys. This protects against data loss from browser cache clears, device resets, or the Safari passkey bug — scenarios where DM data is permanently unrecoverable due to the P2P architecture (no server-side message storage).

The feature lives in **User Settings > Security > Data Backup** and provides two operations:
- **Export**: encrypts all DM data into a downloadable `.qmbak` file
- **Import**: decrypts a `.qmbak` file and restores messages into IndexedDB

## Architecture

### File Format

Backup files use the `.qmbak` extension and contain a JSON `BackupFile` structure:

```typescript
interface BackupFile {
  version: BackupVersion;  // 1 | 2 — writer is pinned to the newest (2)
  iv: string;         // hex-encoded AES-GCM IV (12 bytes)
  ciphertext: string; // hex-encoded encrypted payload
  createdAt: number;  // export timestamp (ms)
}
```

**Two format versions exist and both must keep importing** (`BackupService.ts:6-17`).
v1 files are on users' disks already; only the *writer* is pinned to the newest:

| Version | Carries |
|---|---|
| **v1** | DM messages, DM conversations, encryption states, `user_config` |
| **v2** (current, `BACKUP_FORMAT_VERSION = 2`) | everything in v1, **plus `spaces` + `space_keys`** read from the stores that own them rather than from the `user_config.spaceKeys` snapshot, **plus `domains`** |

The encrypted payload (`BackupPayload`) contains:

```typescript
interface BackupPayload {
  messages: Message[];           // DM messages only
  conversations: Conversation[]; // DM conversation metadata
  encryption_states: EncryptionState[]; // Double Ratchet states
  user_config?: UserConfig;      // bookmarks, settings
  spaces?: Space[];              // v2
  space_keys?: BackupSpaceKey[]; // v2
  domains?: BackupDomains;       // v2 — what this file actually captured
}
```

`domains` exists so a restore can state plainly what a file did and did not
capture, instead of silently restoring nothing. It distinguishes "an empty
`space_keys` means the user has no Spaces" (v2, a true answer) from "the format
never looked" (v1). `space_messages` is declared `false` rather than omitted, for
the same reason.

### Encryption

Backups use **AES-256-GCM** with a domain-separated key derived from the user's Ed448 private key:

```
SHA-512('quorum-backup-v1' + privateKey)[0:32] → AES-256 key
```

The `quorum-backup-v1` domain prefix ensures the backup encryption key is distinct from the config encryption key used by `ConfigService` (which derives via `SHA-512(privateKey)[0:32]` without a prefix). AES-GCM provides both confidentiality and authentication — a wrong key or tampered file fails decryption.

### Key Components

- **`src/services/BackupService.ts`** — Core service with `exportBackup()` and `importBackup()` methods. Handles encryption, decryption, file validation, and concurrency guards.
- **`src/db/messages.ts`** — `getAllDMData()` collects all DM data for export; `importDMData()` writes messages and conversations via a single atomic IndexedDB transaction.
- **`src/hooks/business/user/useUserSettings.ts`** — `exportBackup()` and `importBackup()` functions that wire the service to the UI, handling file download and file reading.
- **`src/components/modals/UserSettingsModal/Security.tsx`** — UI with Export button and "Import a backup instead" link, in the "Data Backup" section below "Account Key".
- **`src/services/index.ts`** — Re-exports `BackupService`, `BackupError`, and related types.

### Data Flow

**Export:**
```
Security.tsx (click Export)
  → useUserSettings.exportBackup()
    → BackupService.exportBackup()
      → MessageDB.getAllDMData() — paginated fetch of DM conversations, messages, encryption states, config
      → deriveKey() — domain-separated AES key from Ed448 private key
      → AES-GCM encrypt(JSON payload)
      → return Blob
    → generate filename (quorum_backup_YYYYMMDD_HHMMSS_XXXXXX.qmbak)
    → DOM download via createObjectURL
```

**Import:**
```
Security.tsx (click "Import a backup instead" → file picker)
  → useUserSettings.importBackup(file)
    → file.text()
    → BackupService.importBackup()
      → parseBackupFile() — validate JSON structure, version, required fields
      → deriveKey() — same domain-separated derivation
      → AES-GCM decrypt
      → validate payload shape (messages array, conversations array)
      → MessageDB.importDMData() — single atomic IndexedDB transaction
        → put() for each conversation (dedup by key)
        → put() for each message (dedup by messageId)
    → show success count or error
```

### Import Behavior

When importing on an already-active account:
- **Messages and conversations** are restored via `put()` (upsert). Existing records are overwritten; new records are added. Importing the same backup twice produces no duplicates.
- **Encryption states** are **skipped** — overwriting active Double Ratchet states would break DM decryption with counterparties.
- **User config** is **skipped** — overwriting would lose the user's current bookmarks and settings.
- **Spaces (v2)** are restored **additively** via an injected `adoptSpaces` function, with a departure gate.

The import runs in a single IndexedDB `readwrite` transaction across the `messages` and `conversations` stores. If any write fails, the entire transaction aborts — no partial imports.

### The departure gate (v2 Space restore)

`buildSpaceBundles()` (`BackupService.ts`) refuses to re-add a Space the user has
since left or been removed from, checked against `getDepartedSpaces()`. This is a
safety property, not a tidiness one: `adoptSpaces` **re-registers with the hub**,
so restoring a stale backup would make a removed user silently re-announce
themselves to the Space that kicked them.

The gate deliberately lives here and **not** inside `adoptSpaces`, because that
method also serves config sync, where the payload is the account's *current*
state (published after the departure) rather than a snapshot from the past.
A backup file is stale by construction; a synced config is not. Blocking inside
`adoptSpaces` would break the legitimate "leave on one device, rejoin on another"
case.

A Space is also skipped, and reported, when the file carries no key material for
it, or no encryption state — `adoptSpaces` would otherwise persist a corrupt
state row that looks present and decrypts nothing.

### Error Handling

`BackupError` provides typed error categories for user-facing messages:

| Type | Cause | User Message |
|------|-------|-------------|
| `DECRYPTION_FAILED` | Wrong account's backup or corrupted file | "Wrong account or corrupted backup file" |
| `INVALID_FORMAT` | Not valid JSON, wrong version, missing fields | Specific validation message |
| `IMPORT_FAILED` | IndexedDB write error | Transaction abort message |

A service-level `isProcessing` guard prevents concurrent export/import operations. The UI disables both buttons while either operation is running.

## UI Design

The Data Backup section appears in **User Settings > Security**, below the "Account Key" section:

- **Export button** — prominent, inside a bordered card with descriptive text
- **Import link** — subtle underlined text ("Import a backup instead") inside the same card, since importing on an active account is a rare action
- **Feedback** — `Callout` components below the card show success counts or error messages

## Technical Decisions

- **Domain-separated key derivation**: Prevents key reuse between ConfigService and BackupService. Even though both derive from the same Ed448 private key, the domain prefix produces a completely different AES key.
- **Full payload always exported**: `encryption_states` and `user_config` are always included in the export even though the current import skips them. This future-proofs the backup file for a potential fresh-device restore flow.
- **`put()` for dedup**: IndexedDB `put()` performs upsert by primary key. This is simpler and safer than checking for existence before writing — it naturally handles the "import same backup twice" case.
- **Paginated export**: `getAllDMData()` fetches conversations in pages of 1000 and messages per-conversation using the existing `getAllConversationMessages()` method, avoiding IndexedDB transaction timeouts on large datasets.
- **Subtle import link**: Since importing on an active account is rare (most data recovers via sync), the import action uses understated styling rather than a full button.

## Known Limitations

> ✅ **The Spaces limitation was FIXED on 2026-08-09 — this note is kept for
> history, corrected 2026-08-12.**
>
> This doc previously carried a warning that a `.qmbak` "cannot restore Spaces at
> all". That was true of the v1 format and is **no longer true**. Commit
> `d53aa5e9b` ("feat(backup): back up Space keys, and never let a restore undo a
> deletion", #324) shipped format **v2**, which reads `spaces` and `space_keys`
> from the stores that own them rather than from the `user_config.spaceKeys`
> snapshot — so the old dependency on `if (config.allowSync)` is gone and a
> sync-off user's export now carries their Space key material.
>
> Restore is additive and gated: `buildSpaceBundles()` skips any Space the user
> has since left or been removed from (`getDepartedSpaces()`), because
> `adoptSpaces` re-registers with the hub and a stale backup would otherwise make
> a removed user silently re-announce themselves to a Space that kicked them.
> Spaces lacking key material or encryption state in the file are skipped and
> reported rather than restored half-formed.
>
> Design history: [`.agents/issues/.open/2026-08-09-backup-restore-overhaul-design.md`](../../issues/.open/2026-08-09-backup-restore-overhaul-design.md).

- **No automatic backups** — users must manually export. There is no scheduled or triggered backup.
- **No incremental backups** — each export contains all DM data. Acceptable given DM-only scope keeps file sizes manageable.
- **Space messages not backed up** — they resync from other members. Single-member spaces can lose message history (space definition recovers via API).
- **No fresh-device restore during onboarding** — users must complete login first, then import from Settings. A dedicated onboarding restore flow is a potential future enhancement.
- **Import skips encryption states and config** — on an active account, only messages and conversations are restored. An `allowSync=false` user who lost data and then joined new spaces before importing cannot recover their old space list from the backup.
- **DM session continuity is not restored** — history comes back, sessions do not. See §6 of the overhaul design above (absorbed from [the now-archived DM-sessions issue](../../issues/.archived/2026-08-05-qmbak-backup-cannot-restore-dm-sessions.md)).

## Related Documentation

- [Data Management Architecture](../data-management-architecture-guide.md) — IndexedDB schema, service architecture
- [Config Sync System](../config-sync-system.md) — ConfigService encryption pattern (reference for domain separation)
- [Cryptographic Architecture](../cryptographic-architecture.md) — Ed448 key hierarchy
- [Task: User Data Backup & Restore](../../issues/.done/user-data-backup-restore-feature.md) — Implementation task with full context

_Last updated: 2026-08-12_
