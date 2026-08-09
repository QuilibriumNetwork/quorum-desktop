import { logger } from '@quilibrium/quorum-shared';
import { channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import { MessageDB, UserConfig, EncryptionState } from '../db/messages';
import type { Message, Conversation, Space } from '@quilibrium/quorum-shared';

/**
 * Backup format versions.
 *
 * v1 — DM messages, DM conversations, encryption states, user_config.
 * v2 — adds `spaces` + `space_keys`, read from the stores that own them rather
 *      than from the `user_config.spaceKeys` snapshot, and adds `domains`.
 *
 * v1 files exist on users' disks and MUST keep importing. Every reader is
 * expected to handle both; only the writer is pinned to the newest.
 */
export const BACKUP_FORMAT_VERSION = 2;
export type BackupVersion = 1 | 2;

/** Encrypted backup file structure (written to .qmbak) */
export interface BackupFile {
  version: BackupVersion;
  iv: string;         // hex-encoded AES-GCM IV
  ciphertext: string; // hex-encoded encrypted payload
  createdAt: number;  // export timestamp
}

/** Space key material as stored in the `space_keys` object store. */
export interface BackupSpaceKey {
  address?: string;
  spaceId: string;
  keyId: string;
  publicKey: string;
  privateKey: string;
}

/**
 * Which domains this file actually captured.
 *
 * Distinguishes "this format never captured it" from "captured it, and there was
 * nothing there" — an empty `space_keys` means something completely different in
 * a v1 file (never collected) than in a v2 one (the user genuinely has no
 * Spaces). Without this, a restore cannot honestly tell a user why nothing came
 * back, which is the failure this whole rework exists to stop repeating.
 */
export interface BackupDomains {
  dm_messages: boolean;
  dm_conversations: boolean;
  encryption_states: boolean;
  user_config: boolean;
  spaces: boolean;
  space_keys: boolean;
  /** Reserved: Space message history is not exported yet (overhaul design slice 5). */
  space_messages: boolean;
}

/** What a v1 file captured, for reporting on files written before v2. */
export const V1_DOMAINS: BackupDomains = {
  dm_messages: true,
  dm_conversations: true,
  encryption_states: true,
  user_config: true,
  spaces: false,
  space_keys: false,
  space_messages: false,
};

/** Decrypted backup payload */
export interface BackupPayload {
  messages: Message[];
  conversations: Conversation[];
  encryption_states: EncryptionState[];
  user_config?: UserConfig;
  /** v2+ */
  spaces?: Space[];
  /** v2+ — the irreplaceable part; see MessageDB.getAllSpaceData. */
  space_keys?: BackupSpaceKey[];
  /** v2+ — absent on v1 files, for which V1_DOMAINS applies. */
  domains?: BackupDomains;
}

/** Error categories for user-facing messages */
export type BackupErrorType =
  | 'DECRYPTION_FAILED'
  | 'INVALID_FORMAT'
  | 'IMPORT_FAILED';

const BACKUP_DOMAIN_PREFIX = 'quorum-backup-v1';

/**
 * What a given file actually captured.
 *
 * Deliberately NOT "does the array have entries" — an empty `space_keys` in a v2
 * file means the user has no Spaces, which is a true and useful answer, whereas
 * in a v1 file it means the format never looked. Falls back to the file's version
 * when `domains` is absent, so v1 files describe themselves correctly.
 *
 * The domain prefix stays `quorum-backup-v1` at every version: it is a key
 * derivation salt, not a format version, and changing it would make every
 * existing backup undecryptable.
 */
export function domainsOf(
  file: Pick<BackupFile, 'version'>,
  payload: BackupPayload
): BackupDomains {
  if (payload.domains) return payload.domains;
  if (file.version === 1) return V1_DOMAINS;

  // A v2 file with no `domains` block shouldn't exist, but infer rather than
  // throw — a restore that works is worth more than a strict parse.
  return {
    dm_messages: Array.isArray(payload.messages),
    dm_conversations: Array.isArray(payload.conversations),
    encryption_states: Array.isArray(payload.encryption_states),
    user_config: !!payload.user_config,
    spaces: Array.isArray(payload.spaces),
    space_keys: Array.isArray(payload.space_keys),
    space_messages: false,
  };
}

/**
 * Adopts Spaces from key material, skipping any already present locally.
 *
 * Injected rather than imported so BackupService does not depend on
 * ConfigService. In the app this is `ConfigService.adoptSpaces`, which is the
 * same path a fresh device runs on every synced login — see its doc comment for
 * the additive guarantee this relies on.
 */
export type AdoptSpacesFn = (args: {
  spaceKeys: NonNullable<UserConfig['spaceKeys']>;
}) => Promise<{
  restored: string[];
  alreadyPresent: string[];
  failed: { spaceId: string; reason: string }[];
}>;

/** Per-domain outcome of a restore, so the caller can say what did NOT happen. */
export interface RestoreReport {
  messagesWritten: number;
  conversationsWritten: number;
  /** Messages in the file that were NOT written because the user deleted them. */
  messagesSkippedAsDeleted: number;
  /** Conversations in the file NOT written because the user deleted the chat. */
  conversationsSkippedAsDeleted: number;
  spacesRestored: string[];
  spacesAlreadyPresent: string[];
  spacesFailed: { spaceId: string; reason: string }[];
  /** Format of the file that was read. */
  version: BackupVersion;
  /** What that file captured. */
  domains: BackupDomains;
}

export class BackupService {
  private messageDB: MessageDB;
  private adoptSpaces?: AdoptSpacesFn;
  private isProcessing = false;

  constructor({
    messageDB,
    adoptSpaces,
  }: {
    messageDB: MessageDB;
    /** Omit to disable Space restore entirely (export-only usage, tests). */
    adoptSpaces?: AdoptSpacesFn;
  }) {
    this.messageDB = messageDB;
    this.adoptSpaces = adoptSpaces;
  }

  /**
   * Rebuilds the per-Space key bundles that `adoptSpaces` expects from the flat
   * arrays stored in a v2 payload.
   *
   * A Space with no encryption state is dropped rather than passed on: adoptSpaces
   * would persist `{ ...undefined, inboxId }`, writing a corrupt state row that
   * looks present and cannot decrypt anything. `saveConfig` filters the same case
   * on the way out (ConfigService.ts:591), and this is the same rule on the way
   * back in.
   */
  private async buildSpaceBundles(payload: BackupPayload): Promise<{
    bundles: NonNullable<UserConfig['spaceKeys']>;
    skipped: { spaceId: string; reason: string }[];
  }> {
    const bundles: NonNullable<UserConfig['spaceKeys']> = [];
    const skipped: { spaceId: string; reason: string }[] = [];

    // Departure gate — the deletion axis for Spaces (design §4.1).
    //
    // Additive alone would happily re-add a Space the user left or was removed
    // from after the backup was taken, and `adoptSpaces` re-registers with the
    // hub, so a kicked user would silently re-announce to the Space that removed
    // them.
    //
    // Gated HERE and not inside `adoptSpaces` on purpose. That method also serves
    // config sync, where the payload is the account's CURRENT state — published
    // after the departure — rather than a snapshot from the past. Blocking there
    // would break the legitimate case of leaving on one device and rejoining on
    // another. A backup file is stale by construction; a synced config is not.
    const departed = new Map(
      (await this.messageDB.getDepartedSpaces()).map((d) => [d.spaceId, d])
    );

    for (const space of payload.spaces ?? []) {
      const departure = departed.get(space.spaceId);
      if (departure) {
        skipped.push({
          spaceId: space.spaceId,
          reason:
            departure.reason === 'removed'
              ? 'you were removed from this Space after this backup was taken'
              : 'you left this Space after this backup was taken',
        });
        continue;
      }

      const keys = (payload.space_keys ?? []).filter(
        (k) => k.spaceId === space.spaceId
      );
      const encryptionState = (payload.encryption_states ?? []).find(
        (s) => s.conversationId === `${space.spaceId}/${space.spaceId}`
      );

      if (keys.length === 0) {
        skipped.push({ spaceId: space.spaceId, reason: 'no key material in backup' });
        continue;
      }
      if (!encryptionState) {
        skipped.push({ spaceId: space.spaceId, reason: 'no encryption state in backup' });
        continue;
      }

      bundles.push({ spaceId: space.spaceId, encryptionState, keys });
    }

    return { bundles, skipped };
  }

  /**
   * Derives a domain-separated AES-256-GCM key from the user's Ed448 private key.
   * Uses 'quorum-backup-v1' prefix for domain separation from ConfigService.
   */
  private async deriveKey(
    privateKey: Uint8Array,
    usage: KeyUsage
  ): Promise<CryptoKey> {
    // Domain-separated: SHA-512('quorum-backup-v1' + privateKey)[0:32]
    const prefixBytes = new TextEncoder().encode(BACKUP_DOMAIN_PREFIX);
    const combined = new Uint8Array(prefixBytes.length + privateKey.length);
    combined.set(prefixBytes);
    combined.set(privateKey, prefixBytes.length);

    const derived = await crypto.subtle.digest('SHA-512', combined);

    return window.crypto.subtle.importKey(
      'raw',
      derived.slice(0, 32),
      { name: 'AES-GCM', length: 256 },
      false,
      [usage]
    );
  }

  /**
   * Exports an encrypted backup of all DM data.
   * Returns a Blob containing the encrypted .qmbak file.
   */
  async exportBackup({
    keyset,
    address,
  }: {
    keyset: secureChannel.UserKeyset;
    address: string;
  }): Promise<Blob> {
    if (this.isProcessing) {
      throw new Error('A backup operation is already in progress');
    }

    this.isProcessing = true;
    try {
      logger.log('[BackupService] Starting backup export...');

      // 1. Collect DM data and Space key material.
      //
      // Space keys are read from the `space_keys` store, NOT from
      // `user_config.spaceKeys` — that snapshot is only ever assembled when sync
      // is on, so exporting via it captures nothing for precisely the users with
      // no server-side copy to fall back on. See MessageDB.getAllSpaceData.
      const dmData = await this.messageDB.getAllDMData({ address });
      const spaceData = await this.messageDB.getAllSpaceData();

      const payload: BackupPayload = {
        ...dmData,
        spaces: spaceData.spaces,
        space_keys: spaceData.space_keys,
        domains: {
          dm_messages: true,
          dm_conversations: true,
          encryption_states: true,
          user_config: true,
          spaces: true,
          space_keys: true,
          // Space message history is still out of scope (overhaul design slice 5).
          // Declared false rather than omitted so a restore can say so plainly
          // instead of silently restoring nothing.
          space_messages: false,
        },
      };

      logger.log('[BackupService] Collected data:', {
        messages: payload.messages.length,
        conversations: payload.conversations.length,
        encryption_states: payload.encryption_states.length,
        hasUserConfig: !!payload.user_config,
        spaces: payload.spaces?.length ?? 0,
        space_keys: payload.space_keys?.length ?? 0,
      });

      // 2. Encrypt the payload
      const privateKey = new Uint8Array(keyset.user_key.private_key);
      const subtleKey = await this.deriveKey(privateKey, 'encrypt');
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const payloadJson = JSON.stringify(payload);
      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        subtleKey,
        new TextEncoder().encode(payloadJson)
      );

      // 3. Build backup file
      const backupFile: BackupFile = {
        version: BACKUP_FORMAT_VERSION,
        iv: Buffer.from(iv).toString('hex'),
        ciphertext: Buffer.from(encrypted).toString('hex'),
        createdAt: Date.now(),
      };

      const blob = new Blob([JSON.stringify(backupFile)], {
        type: 'application/json',
      });

      // Size is logged because nothing else measures it and the budget is real:
      // ~2 MB of polynomial evals is pre-allocated per CREATED Space and rides in
      // its encryption state (see 2025-12-09-encryption-state-evals-bloat.md).
      // A local file has no ~1 MB server ceiling, but a user still has to
      // download it.
      logger.log('[BackupService] Backup export complete', {
        version: backupFile.version,
        bytes: blob.size,
        approxMB: Math.round((blob.size / 1024 / 1024) * 100) / 100,
      });

      return blob;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Validates a raw file as a BackupFile structure.
   * Throws a typed error if invalid.
   */
  private parseBackupFile(raw: string): BackupFile {
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BackupError('INVALID_FORMAT', 'File is not valid JSON');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new BackupError('INVALID_FORMAT', 'File is not a valid backup');
    }
    // Both versions are readable. v1 files are on users' disks right now and a
    // rejected restore is the same outcome as no backup at all; they simply
    // carry less (see V1_DOMAINS). A version ABOVE the one this build knows is a
    // different case — that file was written by a newer client and may hold
    // domains this code would silently drop, so refuse rather than half-restore.
    if (parsed.version !== 1 && parsed.version !== 2) {
      throw new BackupError(
        'INVALID_FORMAT',
        parsed.version > BACKUP_FORMAT_VERSION
          ? `This backup was made by a newer version of Quorum (format ${parsed.version}). Update the app, then import it.`
          : `Unknown backup version: ${parsed.version}`
      );
    }
    if (typeof parsed.iv !== 'string' || typeof parsed.ciphertext !== 'string' || typeof parsed.createdAt !== 'number') {
      throw new BackupError('INVALID_FORMAT', 'Backup file is missing required fields');
    }

    return parsed as BackupFile;
  }

  /**
   * Imports an encrypted .qmbak backup file.
   * Phase 2: Skips encryption_states and user_config (user has active sessions).
   * Returns count of messages and conversations restored.
   */
  async importBackup({
    keyset,
    fileContent,
  }: {
    keyset: secureChannel.UserKeyset;
    fileContent: string;
  }): Promise<RestoreReport> {
    if (this.isProcessing) {
      throw new Error('A backup operation is already in progress');
    }

    this.isProcessing = true;
    try {
      logger.log('[BackupService] Starting backup import...');

      // 1. Validate file structure
      const backupFile = this.parseBackupFile(fileContent);

      // 2. Decrypt
      const privateKey = new Uint8Array(keyset.user_key.private_key);
      const subtleKey = await this.deriveKey(privateKey, 'decrypt');

      let decryptedBytes: ArrayBuffer;
      try {
        decryptedBytes = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: Buffer.from(backupFile.iv, 'hex') },
          subtleKey,
          Buffer.from(backupFile.ciphertext, 'hex')
        );
      } catch {
        throw new BackupError('DECRYPTION_FAILED', 'Wrong account or corrupted backup file');
      }

      // 3. Parse and validate payload
      let payload: BackupPayload;
      try {
        payload = JSON.parse(new TextDecoder().decode(decryptedBytes));
      } catch {
        throw new BackupError('DECRYPTION_FAILED', 'Decrypted data is not valid JSON');
      }

      if (!Array.isArray(payload.messages) || !Array.isArray(payload.conversations)) {
        throw new BackupError('INVALID_FORMAT', 'Backup payload is missing messages or conversations');
      }

      const domains = domainsOf(backupFile, payload);

      logger.log('[BackupService] Decrypted payload:', {
        version: backupFile.version,
        messages: payload.messages.length,
        conversations: payload.conversations.length,
        encryption_states: payload.encryption_states?.length ?? 0,
        hasUserConfig: !!payload.user_config,
        spaces: payload.spaces?.length ?? 0,
        space_keys: payload.space_keys?.length ?? 0,
        domains,
      });

      // A v1 file predates Space key capture entirely, so a user importing one
      // will get no Spaces back and no error to explain why. Say it here rather
      // than let it read as a restore that worked.
      if (!domains.space_keys) {
        logger.warn(
          '[BackupService] This backup contains no Space key material ' +
            `(format v${backupFile.version}). DM history will restore; Spaces cannot.`
        );
      }

      // 4. DM messages and conversations — upsert by id, unchanged and already
      // idempotent, which is what makes a second import of the same file a no-op.
      let result;
      try {
        result = await this.messageDB.importDMData({
          messages: payload.messages,
          conversations: payload.conversations,
        });
      } catch (e) {
        // Typed, so the UI can distinguish "this file is wrong" from "this device
        // could not write it" — previously both surfaced as whatever raw string
        // IndexedDB happened to produce.
        throw new BackupError(
          'IMPORT_FAILED',
          e instanceof Error
            ? `Could not write the restored data: ${e.message}`
            : 'Could not write the restored data'
        );
      }

      // 5. Spaces — additive only.
      //
      // Reconciled per record rather than per file: `adoptSpaces` restores a
      // Space only when this device does not already have it, so importing into
      // a live account cannot overwrite working key material, and importing an
      // OLDER backup cannot roll a Space back. That single property is what makes
      // every merge case safe (design §4) without asking the file how old it is.
      //
      // Encryption states are deliberately still not written for DMs — that is
      // the SDK-gated slice, see design §6.
      let spacesRestored: string[] = [];
      let spacesAlreadyPresent: string[] = [];
      let spacesFailed: { spaceId: string; reason: string }[] = [];

      if (!domains.space_keys) {
        logger.warn(
          '[BackupService] No Space key material in this backup ' +
            `(format v${backupFile.version}) — DM history restored, Spaces cannot be.`
        );
      } else if (!this.adoptSpaces) {
        // The file HAS Space keys but this instance cannot adopt them. Previously
        // neither branch fired here, so the restore silently ignored them and the
        // report said nothing at all — the same silent gap this rework exists to
        // close, just one layer up.
        logger.warn(
          '[BackupService] Backup contains Space keys but no adoptSpaces was ' +
            'provided — Spaces were not restored.'
        );
        spacesFailed = (payload.spaces ?? []).map((s) => ({
          spaceId: s.spaceId,
          reason: 'Space restore is not available in this context',
        }));
      } else {
        // Wrapped so a Space-restore failure cannot erase a DM restore that has
        // ALREADY been written to disk at step 4. Without this the whole promise
        // rejected and the user was told "Failed to import backup" about an
        // import whose messages had landed and were staying — which reads as
        // total failure and invites a needless retry. Per-domain outcomes, in
        // keeping with the rest of the design.
        try {
          const { bundles, skipped } = await this.buildSpaceBundles(payload);
          spacesFailed = skipped;

          if (bundles.length > 0) {
            const adopted = await this.adoptSpaces({ spaceKeys: bundles });
            spacesRestored = adopted.restored;
            spacesAlreadyPresent = adopted.alreadyPresent;
            spacesFailed = [...skipped, ...adopted.failed];
          }
        } catch (e) {
          logger.error('[BackupService] Space restore failed', e);
          spacesFailed = [
            ...spacesFailed,
            {
              spaceId: '*',
              reason: e instanceof Error ? e.message : String(e),
            },
          ];
        }
      }

      const report: RestoreReport = {
        ...result,
        spacesRestored,
        spacesAlreadyPresent,
        spacesFailed,
        version: backupFile.version,
        domains,
      };

      logger.log('[BackupService] Import complete:', {
        ...report,
        spacesRestored: spacesRestored.length,
        spacesAlreadyPresent: spacesAlreadyPresent.length,
        spacesFailed: spacesFailed.length,
      });

      return report;
    } finally {
      this.isProcessing = false;
    }
  }
}

export class BackupError extends Error {
  type: BackupErrorType;

  constructor(type: BackupErrorType, message: string) {
    super(message);
    this.type = type;
    this.name = 'BackupError';
  }
}
