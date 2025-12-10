// ConfigService.ts - Extracted from MessageDB.tsx with ZERO modifications
// This service handles user configuration management

import { MessageDB, UserConfig } from '../db/messages';
import { QuorumApiClient } from '../api/baseTypes';
import { Bookmark } from '../api/quorumApi';
import { channel as secureChannel, channel_raw as ch } from '@quilibrium/quilibrium-js-sdk-channels';
import { sha256, base58btc } from '../utils/crypto';
import { int64ToBytes } from '../utils/bytes';
import { getDefaultUserConfig } from '../utils';
import { t } from '@lingui/core/macro';
import { QueryClient } from '@tanstack/react-query';
import { buildSpacesKey, buildConfigKey } from '../hooks';
import { Space } from '../api/quorumApi';
import { validateItems } from '../utils/folderUtils';

export class ConfigService {
  private messageDB: MessageDB;
  private apiClient: QuorumApiClient;
  private spaceInfo: React.MutableRefObject<{ [key: string]: any }>;
  private enqueueOutbound: (action: () => Promise<string[]>) => void;
  private sendHubMessage: (spaceId: string, message: string) => Promise<string>;
  private queryClient: QueryClient;

  constructor(dependencies: {
    messageDB: MessageDB;
    apiClient: QuorumApiClient;
    spaceInfo: React.MutableRefObject<{ [key: string]: any }>;
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
    } catch {}

    const storedConfig = await this.messageDB.getUserConfig({ address });
    if (!savedConfig) {
      if (!storedConfig) {
        return getDefaultUserConfig(address);
      }
      return storedConfig;
    }

    if (savedConfig.timestamp < (storedConfig?.timestamp ?? 0)) {
      console.warn(t`saved config is out of date`);
      return storedConfig;
    }

    if (savedConfig.timestamp == storedConfig?.timestamp) {
      return storedConfig;
    }

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
      ['decrypt']
    );

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
      console.warn(t`received config with invalid signature!`);
      return storedConfig;
    }

    const iv = savedConfig.user_config.substring(
      savedConfig.user_config.length - 24
    );
    const ciphertext = savedConfig.user_config.substring(
      0,
      savedConfig.user_config.length - 24
    );
    const config = JSON.parse(
      Buffer.from(
        await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: Buffer.from(iv, 'hex') },
          subtleKey,
          Buffer.from(ciphertext, 'hex')
        )
      ).toString('utf-8')
    ) as UserConfig;
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
            console.warn(t`decrypted space with no known config key`);
            continue;
          }

          const hub = space.keys.find((k) => k.keyId == 'hub');
          if (!hub) {
            console.warn(t`Decrypted Space with no known hub key`);
            continue;
          }

          for (const key of space.keys) {
            await this.messageDB.saveSpaceKey(key);
          }

          const reg = (await this.apiClient.getSpace(space.spaceId)).data;
          this.spaceInfo.current[space.spaceId] = reg;

          const manifestPayload = await this.apiClient.getSpaceManifest(
            space.spaceId
          );
          if (!manifestPayload) {
            console.warn(t`Could not obtain manifest for Space`);
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

        console.log(`Bookmark sync: ${toDelete.length} deleted, ${toAdd.length} added, ${toUpdate.length} updated`);
      } catch (error) {
        console.error('Bookmark sync failed, attempting to restore local bookmarks:', error);

        // Attempt to restore original bookmarks on failure
        try {
          for (const bookmark of localBookmarks) {
            await this.messageDB.addBookmark(bookmark);
          }
          console.warn('Successfully restored local bookmarks after sync failure');
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
    config,
    keyset,
  }: {
    config: UserConfig;
    keyset: {
      userKeyset: secureChannel.UserKeyset;
      deviceKeyset: secureChannel.DeviceKeyset;
    };
  }) {
    const ts = Date.now();
    config.timestamp = ts;

    if (config.allowSync) {
      console.log('syncing config', config);
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

      // Collect bookmarks before encryption (Phase 7: Sync Integration)
      config.bookmarks = await this.messageDB.getBookmarks();
      // Note: deletedBookmarkIds will be reset AFTER successful sync

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext =
        Buffer.from(
          await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            subtleKey,
            Buffer.from(JSON.stringify(config), 'utf-8')
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

      await this.apiClient.postUserSettings(config.address, {
        user_address: config.address,
        user_public_key: Buffer.from(
          new Uint8Array(userKey.user_key.public_key)
        ).toString('hex'),
        user_config: ciphertext,
        timestamp: ts,
        signature: signature,
      });

      // Reset tombstones only after successful sync (Phase 7: Critical Fix)
      config.deletedBookmarkIds = [];
    }

    await this.messageDB.saveUserConfig(config);
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

