// ConfigService.ts - Extracted from MessageDB.tsx with ZERO modifications
// This service handles user configuration management

import { logger, int64ToBytes, mergeConversationSettings } from '@quilibrium/quorum-shared';
import { MessageDB, UserConfig } from '../db/messages';
import { QuorumApiClient } from '../api/baseTypes';
import type { Bookmark, Space } from '@quilibrium/quorum-shared';
import { channel as secureChannel, channel_raw as ch } from '@quilibrium/quilibrium-js-sdk-channels';
import { sha256, base58btc, decryptUserConfig } from '../utils/crypto';
import { getDefaultUserConfig } from '../utils';
import { t } from '@lingui/core/macro';
import { QueryClient } from '@tanstack/react-query';
import { buildSpacesKey, buildConfigKey } from '../hooks';
import { validateItems } from '../utils/folderUtils';
import { mergeDeviceNames } from './configMergeHelpers';
import type { Ref } from '../types/ref';
import type { SpaceInfoMap } from '../types/spaceRefs';

export class ConfigService {
  private messageDB: MessageDB;
  private apiClient: QuorumApiClient;
  private spaceInfo: Ref<SpaceInfoMap>;
  private enqueueOutbound: (action: () => Promise<string[]>) => void;
  private sendHubMessage: (spaceId: string, message: string) => Promise<string>;
  private queryClient: QueryClient;

  constructor(dependencies: {
    messageDB: MessageDB;
    apiClient: QuorumApiClient;
    spaceInfo: Ref<SpaceInfoMap>;
    enqueueOutbound: (action: () => Promise<string[]>) => void;
    sendHubMessage: (spaceId: string, message: string) => Promise<string>;
    queryClient: QueryClient;
  }) {
    this.messageDB = dependencies.messageDB;
    this.apiClient = dependencies.apiClient;
    this.spaceInfo = dependencies.spaceInfo;
    this.enqueueOutbound = dependencies.enqueueOutbound;
    this.sendHubMessage = dependencies.sendHubMessage;
    this.queryClient = dependencies.queryClient;
  }

  /**
   * Retrieves user config from remote/local, decrypts, verifies signature, and syncs new spaces.
   */
  async getConfig({
    address,
    userKey,
  }: {
    address: string;
    userKey: secureChannel.UserKeyset;
  }) {
    let savedConfig: secureChannel.UserConfig | undefined;
    try {
      savedConfig = (await this.apiClient.getUserSettings(address)).data;
    } catch { /* ignore - proceed with stored config */ }

    const storedConfig = await this.messageDB.getUserConfig({ address });
    if (!savedConfig) {
      if (!storedConfig) {
        return getDefaultUserConfig(address);
      }
      return storedConfig;
    }

    if (savedConfig.timestamp < (storedConfig?.timestamp ?? 0)) {
      logger.warn(t`saved config is out of date`);
      return storedConfig;
    }

    if (savedConfig.timestamp == storedConfig?.timestamp) {
      return storedConfig;
    }

    if (
      !JSON.parse(
        ch.js_verify_ed448(
          Buffer.from(new Uint8Array(userKey.user_key.public_key)).toString(
            'base64'
          ),
          Buffer.from(
            new Uint8Array([
              ...new Uint8Array(
                Buffer.from(savedConfig.user_config, 'utf-8')
              ),
              ...int64ToBytes(savedConfig.timestamp),
            ])
          ).toString('base64'),
          Buffer.from(savedConfig.signature, 'hex').toString('base64')
        )
      )
    ) {
      logger.warn(t`received config with invalid signature!`);
      return storedConfig;
    }

    const config = (await decryptUserConfig(
      savedConfig.user_config,
      new Uint8Array(userKey.user_key.private_key)
    )) as UserConfig;
    if (!config) {
      return storedConfig;
    }

    // Validate and sanitize items array to enforce limits (max 20 folders, 100 spaces per folder)
    if (config.items) {
      config.items = validateItems(config.items);
    }

    for (const space of config.spaceKeys ?? []) {
      const existingSpace = await this.messageDB.getSpace(space.spaceId);
      if (!existingSpace) {
        try {
          const config = space.keys.find((k) => k.keyId == 'config');
          if (!config) {
            logger.warn(t`Decrypted Space with no known config key`);
            continue;
          }

          const hub = space.keys.find((k) => k.keyId == 'hub');
          if (!hub) {
            logger.warn(t`Decrypted Space with no known hub key`);
            continue;
          }

          for (const key of space.keys) {
            // Per-device-signing flip (Option A): a fresh device no longer
            // adopts the shared `signing` slot. It signs with its own
            // per-device `inbox` key (getSigningKey falls through to it) and
            // announces that key via announce-keys. Skipping the synced
            // `signing` key here — and NOT deriving one from `inbox` below —
            // is what puts a fresh second device on its own key. Devices set
            // up before this flip keep any previously-saved `signing` slot
            // untouched (getSigningKey still reads it), so nothing regresses.
            if (key.keyId === 'signing') continue;
            await this.messageDB.saveSpaceKey(key);
          }

          const reg = (await this.apiClient.getSpace(space.spaceId)).data;
          this.spaceInfo.current[space.spaceId] = reg;

          const manifestPayload = await this.apiClient.getSpaceManifest(
            space.spaceId
          );
          if (!manifestPayload) {
            logger.warn(t`Could not obtain manifest for Space`);
            continue;
          }

          const ciphertext = JSON.parse(
            manifestPayload.data.space_manifest
          ) as {
            ciphertext: string;
            initialization_vector: string;
            associated_data: string;
          };
          const manifest = JSON.parse(
            Buffer.from(
              JSON.parse(
                ch.js_decrypt_inbox_message(
                  JSON.stringify({
                    inbox_private_key: [
                      ...new Uint8Array(
                        Buffer.from(config.privateKey, 'hex')
                      ),
                    ],
                    ephemeral_public_key: [
                      ...new Uint8Array(
                        Buffer.from(
                          manifestPayload.data.ephemeral_public_key,
                          'hex'
                        )
                      ),
                    ],
                    ciphertext: ciphertext,
                  })
                )
              )
            ).toString('utf-8')
          ) as Space;

          const ip = ch.js_generate_ed448();
          const inboxPair = JSON.parse(ip);
          const ih = await sha256.digest(
            Buffer.from(new Uint8Array(inboxPair.public_key))
          );
          const inboxAddress = base58btc.baseEncode(ih.bytes);

          await this.messageDB.saveSpace(manifest);
          await this.messageDB.saveEncryptionState(
            { ...space.encryptionState, inboxId: inboxAddress },
            true
          );

          await this.apiClient.postHubAdd({
            hub_address: hub.address!,
            hub_public_key: hub.publicKey,
            hub_signature: Buffer.from(
              JSON.parse(
                ch.js_sign_ed448(
                  Buffer.from(hub.privateKey, 'hex').toString('base64'),
                  Buffer.from(
                    new Uint8Array([
                      ...new Uint8Array(
                        Buffer.from(
                          'add' +
                            Buffer.from(
                              new Uint8Array(inboxPair.public_key)
                            ).toString('hex'),
                          'utf-8'
                        )
                      ),
                    ])
                  ).toString('base64')
                )
              ),
              'base64'
            ).toString('hex'),
            inbox_public_key: Buffer.from(
              new Uint8Array(inboxPair.public_key)
            ).toString('hex'),
            inbox_signature: Buffer.from(
              JSON.parse(
                ch.js_sign_ed448(
                  Buffer.from(new Uint8Array(inboxPair.private_key)).toString(
                    'base64'
                  ),
                  Buffer.from(
                    new Uint8Array([
                      ...new Uint8Array(
                        Buffer.from('add' + hub.publicKey, 'utf-8')
                      ),
                    ])
                  ).toString('base64')
                )
              ),
              'base64'
            ).toString('hex'),
          });

          this.enqueueOutbound(async () => [
            JSON.stringify({
              type: 'listen',
              inbox_addresses: [inboxAddress],
            }),
          ]);

          await this.messageDB.saveSpaceKey({
            spaceId: space.spaceId,
            keyId: 'inbox',
            address: inboxAddress,
            publicKey: Buffer.from(
              new Uint8Array(inboxPair.public_key)
            ).toString('hex'),
            privateKey: Buffer.from(
              new Uint8Array(inboxPair.private_key)
            ).toString('hex'),
          });

          this.enqueueOutbound(async () => [
            await this.sendHubMessage(
              space.spaceId,
              JSON.stringify({
                type: 'control',
                message: {
                  type: 'sync',
                  inboxAddress: inboxAddress,
                },
              })
            ),
          ]);
        } catch (e) {
          console.error(t`Could not add Space`, e);
        }
      }
    }

    // Merge deviceNames: additive union so names from all devices survive concurrent saves
    const deviceNamesMerge = mergeDeviceNames(
      storedConfig?.deviceNames,
      config.deviceNames,
      storedConfig?.deletedDeviceNameAddresses,
      config.deletedDeviceNameAddresses
    );
    config.deviceNames = deviceNamesMerge.deviceNames;
    config.deletedDeviceNameAddresses = deviceNamesMerge.deletedDeviceNameAddresses;

    // Merge per-conversation DM settings: per-entry last-write-wins by updatedAt
    // (see mergeConversationSettings). Prevents an unrelated remote config save
    // from clobbering another conversation's local override.
    config.conversationSettings = mergeConversationSettings(
      storedConfig?.conversationSettings,
      config.conversationSettings
    );

    // Merge user notes from remote
    const deletedNoteAddresses = config.deletedUserNoteAddresses ?? [];

    // Always apply remote tombstones — even when there are no notes to merge
    for (const addr of deletedNoteAddresses) {
      await this.messageDB.deleteUserNote(addr);
    }

    if (config.userNotes && config.userNotes.length > 0) {
      const localNotes = await this.messageDB.getAllUserNotes();
      const remoteNotes = config.userNotes.filter(
        n => !deletedNoteAddresses.includes(n.targetAddress)
      );

      // Last-write-wins per targetAddress
      const noteMap = new Map<string, { targetAddress: string; note: string; updatedAt: number }>();
      for (const n of [...localNotes, ...remoteNotes]) {
        const existing = noteMap.get(n.targetAddress);
        if (!existing || n.updatedAt > existing.updatedAt) {
          noteMap.set(n.targetAddress, n);
        }
      }

      // Sync merged notes to local DB
      for (const note of noteMap.values()) {
        await this.messageDB.saveUserNote(note.targetAddress, note.note);
      }

      logger.log(`User note sync: ${noteMap.size} notes merged, ${deletedNoteAddresses.length} deleted`);
    }

    // Merge bookmarks from remote
    if (config.bookmarks && config.bookmarks.length > 0) {
      const localBookmarks = await this.messageDB.getBookmarks();
      const mergedBookmarks = this.mergeBookmarks(
        localBookmarks,
        config.bookmarks,
        config.deletedBookmarkIds ?? []
      );

      // Apply differential sync
      try {
        const localMap = new Map(localBookmarks.map(b => [b.bookmarkId, b]));
        const mergedMap = new Map(mergedBookmarks.map(b => [b.bookmarkId, b]));

        // Calculate differential changes
        const toDelete = localBookmarks.filter(b => !mergedMap.has(b.bookmarkId));
        const toAdd = mergedBookmarks.filter(b => !localMap.has(b.bookmarkId));
        const toUpdate = mergedBookmarks.filter(b => {
          const existing = localMap.get(b.bookmarkId);
          return existing && existing.createdAt !== b.createdAt;
        });

        // Apply only necessary changes (much faster than replace-all)
        for (const bookmark of toDelete) {
          await this.messageDB.removeBookmark(bookmark.bookmarkId);
        }
        for (const bookmark of [...toAdd, ...toUpdate]) {
          await this.messageDB.addBookmark(bookmark);
        }

        logger.log(`Bookmark sync: ${toDelete.length} deleted, ${toAdd.length} added, ${toUpdate.length} updated`);
      } catch (error) {
        console.error('Bookmark sync failed, attempting to restore local bookmarks:', error);

        // Attempt to restore original bookmarks on failure
        try {
          for (const bookmark of localBookmarks) {
            await this.messageDB.addBookmark(bookmark);
          }
          logger.warn('Successfully restored local bookmarks after sync failure');
        } catch (restoreError) {
          console.error('Failed to restore local bookmarks:', restoreError);
          // At this point, user may have lost bookmarks - this is logged for debugging
        }

        // Don't throw - continue with rest of config save to avoid corrupting other data
      }
    }

    await this.messageDB.saveUserConfig({
      ...config,
      timestamp: savedConfig.timestamp,
    });
    const updatedSpaces = await this.messageDB.getSpaces();
    await this.queryClient.setQueryData(buildSpacesKey({}), () => updatedSpaces);
    await this.queryClient.setQueryData(
      buildConfigKey({ userAddress: config.address! }),
      () => config
    );
    return config;
  }

  /**
   * Saves config to local DB and optionally syncs to remote (encrypted with AES-GCM, signed with Ed448).
   */
  async saveConfig({
    config: configInput,
    keyset,
  }: {
    config: UserConfig;
    keyset: {
      userKeyset: secureChannel.UserKeyset;
      deviceKeyset: secureChannel.DeviceKeyset;
    };
  }) {
    // Deep-clone before mutating: callers (e.g. useChannelMute's optimistic
    // update) may pass the same object reference held by the React Query
    // cache. In-place mutations below would silently corrupt the cache and
    // produce delayed "phantom" reverts after queue completion.
    const config: UserConfig = JSON.parse(JSON.stringify(configInput));

    const ts = Date.now();
    config.timestamp = ts;

    if (config.allowSync) {
      const userKey = keyset.userKeyset;
      const derived = await crypto.subtle.digest(
        'SHA-512',
        Buffer.from(new Uint8Array(userKey.user_key.private_key))
      );

      const subtleKey = await window.crypto.subtle.importKey(
        'raw',
        derived.slice(0, 32),
        {
          name: 'AES-GCM',
          length: 256,
        },
        false,
        ['encrypt']
      );

      const spaces = await this.messageDB.getSpaces();

      // Fetch all space keys and encryption states in parallel
      const spaceKeysPromises = spaces.map(async (space) => {
        const [keys, encryptionState] = await Promise.all([
          this.messageDB.getSpaceKeys(space.spaceId),
          this.messageDB.getEncryptionStates({
            conversationId: space.spaceId + '/' + space.spaceId,
          }),
        ]);
        return {
          spaceId: space.spaceId,
          encryptionState: encryptionState[0],
          keys: keys,
        };
      });

      const allSpaceKeys = await Promise.all(spaceKeysPromises);
      // Filter out entries with undefined encryptionState
      config.spaceKeys = allSpaceKeys.filter(sk => sk.encryptionState !== undefined);

      // Log warning if spaces are being filtered out (helps debug potential sync issues)
      const spacesWithoutEncryption = allSpaceKeys.filter(sk => sk.encryptionState === undefined);
      if (spacesWithoutEncryption.length > 0) {
        logger.warn(
          `[ConfigService] ${spacesWithoutEncryption.length} space(s) filtered from sync (missing encryption state):`,
          spacesWithoutEncryption.map(sk => sk.spaceId)
        );
      }

      // Ensure spaceIds and items only include spaces that have encryption keys
      // This prevents server validation errors when some spaces don't have complete encryption data
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

      // After filtering spaceIds/items, also filter spaceKeys to only include spaces that are still in spaceIds
      // This ensures bidirectional consistency: spaceIds ⟷ spaceKeys
      const finalSpaceIds = new Set(config.spaceIds);
      config.spaceKeys = config.spaceKeys.filter(sk => finalSpaceIds.has(sk.spaceId));

      // Collect bookmarks before encryption (Phase 7: Sync Integration)
      config.bookmarks = await this.messageDB.getBookmarks();
      // Note: deletedBookmarkIds will be reset AFTER successful sync

      // Collect user notes before encryption
      config.userNotes = await this.messageDB.getAllUserNotes();
      // Note: deletedUserNoteAddresses will be reset AFTER successful sync

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const configJson = JSON.stringify(config);
      const ciphertext =
        Buffer.from(
          await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            subtleKey,
            Buffer.from(configJson, 'utf-8')
          )
        ).toString('hex') + Buffer.from(iv).toString('hex');

      const signature = Buffer.from(
        JSON.parse(
          ch.js_sign_ed448(
            Buffer.from(
              new Uint8Array(userKey.user_key.private_key)
            ).toString('base64'),
            Buffer.from(
              new Uint8Array([
                ...new Uint8Array(Buffer.from(ciphertext, 'utf-8')),
                ...int64ToBytes(ts),
              ])
            ).toString('base64')
          )
        ),
        'base64'
      ).toString('hex');

      logger.log('[ConfigService] Posting settings to server...', {
        address: config.address,
        timestamp: ts,
      });
      await this.apiClient.postUserSettings(config.address, {
        user_address: config.address,
        user_public_key: Buffer.from(
          new Uint8Array(userKey.user_key.public_key)
        ).toString('hex'),
        user_config: ciphertext,
        timestamp: ts,
        signature: signature,
      });
      logger.log('[ConfigService] Settings posted successfully');

      // Reset tombstones only after successful sync (Phase 7: Critical Fix)
      config.deletedBookmarkIds = [];
      config.deletedUserNoteAddresses = [];
    }

    logger.log('[ConfigService] Saving config to local DB...');
    await this.messageDB.saveUserConfig(config);
    logger.log('[ConfigService] Config saved to local DB');

    // Skip the cache write if a newer optimistic update arrived while this
    // queue task was processing. A later queue task will reconcile DB and
    // cache; without this guard we'd overwrite the user's latest state.
    const cacheKey = buildConfigKey({ userAddress: config.address! });
    const cacheUpdatedAt =
      this.queryClient.getQueryState(cacheKey)?.dataUpdatedAt ?? 0;
    if (cacheUpdatedAt <= ts) {
      this.queryClient.setQueryData(cacheKey, config);
    }
  }

  /**
   * Merge local and remote bookmarks with conflict resolution
   * Strategy: Last-write-wins with tombstone tracking for deletions
   * Deduplication: Prevents multiple bookmarks pointing to same message
   */
  private mergeBookmarks(
    local: Bookmark[],
    remote: Bookmark[],
    deletedIds: string[]
  ): Bookmark[] {
    const bookmarkMap = new Map<string, Bookmark>();
    const messageIdToBookmarkId = new Map<string, string>(); // Track by messageId to prevent duplicates

    const addBookmark = (bookmark: Bookmark) => {
      if (deletedIds.includes(bookmark.bookmarkId)) return;

      // Check for existing bookmark pointing to same message
      const existingBookmarkId = messageIdToBookmarkId.get(bookmark.messageId);
      const existing = existingBookmarkId ? bookmarkMap.get(existingBookmarkId) : undefined;

      if (!existing || bookmark.createdAt > existing.createdAt) {
        // Remove old duplicate if exists
        if (existingBookmarkId) {
          bookmarkMap.delete(existingBookmarkId);
        }
        bookmarkMap.set(bookmark.bookmarkId, bookmark);
        messageIdToBookmarkId.set(bookmark.messageId, bookmark.bookmarkId);
      }
    };

    // Add local and remote bookmarks with deduplication
    local.forEach(addBookmark);
    remote.forEach(addBookmark);

    // Convert back to array and sort by creation time (newest first)
    return Array.from(bookmarkMap.values())
      .sort((a, b) => b.createdAt - a.createdAt);
  }
}

