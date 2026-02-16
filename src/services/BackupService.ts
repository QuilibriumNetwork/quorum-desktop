import { logger } from '@quilibrium/quorum-shared';
import { channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import { MessageDB, UserConfig, EncryptionState } from '../db/messages';
import { Message, Conversation } from '../api/quorumApi';

/** Encrypted backup file structure (written to .qmbak) */
export interface BackupFile {
  version: 1;
  iv: string;         // hex-encoded AES-GCM IV
  ciphertext: string; // hex-encoded encrypted payload
  createdAt: number;  // export timestamp
}

/** Decrypted backup payload */
export interface BackupPayload {
  messages: Message[];
  conversations: Conversation[];
  encryption_states: EncryptionState[];
  user_config?: UserConfig;
}

/** Error categories for user-facing messages */
export type BackupErrorType =
  | 'DECRYPTION_FAILED'
  | 'INVALID_FORMAT'
  | 'IMPORT_FAILED';

const BACKUP_DOMAIN_PREFIX = 'quorum-backup-v1';

export class BackupService {
  private messageDB: MessageDB;
  private isProcessing = false;

  constructor({ messageDB }: { messageDB: MessageDB }) {
    this.messageDB = messageDB;
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

      // 1. Collect all DM data
      const payload: BackupPayload = await this.messageDB.getAllDMData({ address });

      logger.log('[BackupService] Collected data:', {
        messages: payload.messages.length,
        conversations: payload.conversations.length,
        encryption_states: payload.encryption_states.length,
        hasUserConfig: !!payload.user_config,
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
        version: 1,
        iv: Buffer.from(iv).toString('hex'),
        ciphertext: Buffer.from(encrypted).toString('hex'),
        createdAt: Date.now(),
      };

      logger.log('[BackupService] Backup export complete');

      return new Blob([JSON.stringify(backupFile)], { type: 'application/json' });
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
    if (parsed.version !== 1) {
      throw new BackupError('INVALID_FORMAT', `Unknown backup version: ${parsed.version}`);
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
  }): Promise<{ messagesWritten: number; conversationsWritten: number }> {
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

      logger.log('[BackupService] Decrypted payload:', {
        messages: payload.messages.length,
        conversations: payload.conversations.length,
        encryption_states: payload.encryption_states?.length ?? 0,
        hasUserConfig: !!payload.user_config,
      });

      // 4. Import messages and conversations only (skip encryption_states and user_config)
      const result = await this.messageDB.importDMData({
        messages: payload.messages,
        conversations: payload.conversations,
      });

      logger.log('[BackupService] Import complete:', result);

      return result;
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
