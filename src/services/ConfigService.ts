// ConfigService.ts - Extracted from MessageDB.tsx with ZERO modifications
// This service handles user configuration management

import {
  logger,
  int64ToBytes,
  mergeConversationSettings,
  stripBookmarkSenderIcons,
} from '@quilibrium/quorum-shared';
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
import { recordLastPublish, classifyPublishError } from '../utils/lastPublish';
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

    // Additive by construction: adoptSpaces skips any Space already present.
    await this.adoptSpaces({ spaceKeys: config.spaceKeys ?? [] });

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

    // Merge user notes from remote.
    //
    // Only the TIMESTAMPED tombstones are honoured. `deletedUserNoteAddresses`
    // is still published for clients that predate `deletedUserNotes`, but is
    // deliberately ignored here: a bare address carries no deletion time, and a
    // client that carries userNotes without implementing them never clears the
    // array, so it republishes the same tombstone in every later save. Applying
    // those unconditionally deleted a note the user had re-created — again on
    // every adopt, with no way out. The blob timestamp is no substitute; it is
    // the carrier's republish time, so a months-old deletion looks current.
    // See §11 of ConfigService.unit.test.tsx.
    const noteTombstones = config.deletedUserNotes ?? [];
    const localNoteUpdatedAt = new Map(
      (await this.messageDB.getAllUserNotes()).map(n => [n.targetAddress, n.updatedAt])
    );

    // A deletion only beats a note older than itself. That keeps tombstones
    // doing their real job — a stale device cannot resurrect a note deleted
    // after it last synced — while letting a deliberate rewrite survive.
    const appliedTombstones = noteTombstones.filter(
      t => (localNoteUpdatedAt.get(t.targetAddress) ?? 0) < t.deletedAt
    );
    for (const tombstone of appliedTombstones) {
      await this.messageDB.deleteUserNote(tombstone.targetAddress);
    }
    const deletedNoteAddresses = appliedTombstones.map(t => t.targetAddress);

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
      // Strip the legacy embedded avatars off the REMOTE payload before
      // anything reads it. A device still running an older build keeps
      // publishing them, and without this they would flow straight back into
      // this device's IndexedDB and then back into its own uploads. Mutating
      // `config` (rather than a local copy) also keeps them out of the stored
      // config written at the end of this method.
      const inbound = stripBookmarkSenderIcons(config.bookmarks);
      if (inbound.strippedCount > 0) {
        logger.log(
          `[ConfigService] dropped ${inbound.strippedCount} legacy bookmark avatar(s) ` +
            `from an inbound config (~${Math.round(inbound.bytesFreed / 1024)} KB)`
        );
      }
      config.bookmarks = inbound.bookmarks;

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
        // `addBookmark` enforces MAX_BOOKMARKS and uses IDBObjectStore.add, which
        // REJECTS an existing key — so it is right for `toAdd` and wrong for
        // `toUpdate`, whose keys exist by definition. An update used to throw
        // ConstraintError and abort the whole differential apply.
        for (const bookmark of toAdd) {
          await this.messageDB.addBookmark(bookmark);
        }
        for (const bookmark of toUpdate) {
          await this.messageDB.putBookmark(bookmark);
        }

        logger.log(`Bookmark sync: ${toDelete.length} deleted, ${toAdd.length} added, ${toUpdate.length} updated`);
      } catch (error) {
        console.error('Bookmark sync failed, attempting to restore local bookmarks:', error);

        // Attempt to restore original bookmarks on failure
        try {
          // put, not add: a partially-applied sync leaves some of these rows
          // still present, and `add` would throw on the first one and abandon
          // the rest of the restore.
          for (const bookmark of localBookmarks) {
            await this.messageDB.putBookmark(bookmark);
          }
          logger.warn('Successfully restored local bookmarks after sync failure');
        } catch (restoreError) {
          console.error('Failed to restore local bookmarks:', restoreError);
          // At this point, user may have lost bookmarks - this is logged for debugging
        }

        // Don't throw - continue with rest of config save to avoid corrupting other data
      }
    }

    // Diagnostic only — this does not change what gets adopted.
    //
    // The remote config is applied verbatim, and the sidebar renders from
    // `config.items` (useNavItems.ts:49-53), so a publisher that narrows its
    // Space list empties this device's nav the moment its blob wins on
    // timestamp. Both clients now refuse to publish such a list — desktop in
    // saveConfig below, mobile since its #228/#229 (an earlier revert of the
    // mobile guard is why older notes say it "only warns and publishes
    // anyway"; that has not been true since 2026-08-04). So the known trigger
    // is gone, but this receiver still adopts whatever it is handed, which is
    // why the diagnostic stays: nothing else on this side records the
    // adoption, and every report of "all my Spaces vanished" arrived with no
    // evidence attached.
    await this.recordSpaceListShrinkOnAdopt(storedConfig, config);

    // Device-local, never inherited from the blob. `allowSync` describes THIS
    // device's relationship with the server, but it rides in the account-level
    // config, so a decision made on one device used to be carried to the others.
    //
    // Two ways that turned "off" back on without anyone asking. Local storage
    // lost: the remote wins against `?? 0` above and is adopted verbatim, sync
    // included. Or another device still syncing: turning sync off is never
    // published — that is the whole point of the switch — so the other device
    // never learns, keeps publishing, and eventually wins on timestamp.
    //
    // Set on `config` itself rather than only on the object below, so the DB
    // row, the cache write and the returned value cannot disagree.
    // See 2026-08-08-make-allowsync-a-per-device-setting.md under .agents/issues/
    config.allowSync = storedConfig?.allowSync ?? false;

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
   * Adopt Spaces from key material, skipping any that already exist locally.
   *
   * Extracted from getConfig so the backup restore path can reuse it verbatim
   * rather than reimplement it. Restoring a Space from a `.qmbak` is the SAME
   * operation as adopting one from a synced config — only the source of the key
   * bundle differs — and this is the version that has run on every multi-device
   * login for months.
   *
   * **Additive by construction.** The `if (!existingSpace)` guard is the whole
   * safety property: a Space this device already holds is never touched, so its
   * keys cannot be overwritten by an older bundle. Any caller relying on that
   * (the backup import does) must not bypass this method.
   *
   * The Space *definition* is re-fetched from the API, never taken from the
   * caller — only key material is trusted from the bundle.
   */
  async adoptSpaces({
    spaceKeys,
  }: {
    spaceKeys: NonNullable<UserConfig['spaceKeys']>;
  }): Promise<{
    restored: string[];
    alreadyPresent: string[];
    failed: { spaceId: string; reason: string }[];
  }> {
    const restored: string[] = [];
    const alreadyPresent: string[] = [];
    const failed: { spaceId: string; reason: string }[] = [];

    for (const space of spaceKeys) {
      // Inside its own try: this read used to sit outside the per-Space catch
      // below, so a single transient IndexedDB failure threw straight out of
      // adoptSpaces and discarded the results of every Space already processed
      // and persisted — the exact opposite of the isolation the catch promises.
      let existingSpace: Space | null;
      try {
        existingSpace = await this.messageDB.getSpace(space.spaceId);
      } catch (e) {
        failed.push({
          spaceId: space.spaceId,
          reason: e instanceof Error ? e.message : String(e),
        });
        continue;
      }

      if (existingSpace) {
        // The additive guarantee. Counted rather than silently ignored so a
        // restore can report "3 already present" instead of implying it did
        // nothing.
        alreadyPresent.push(space.spaceId);
      }
      if (!existingSpace) {
        try {
          const config = space.keys.find((k) => k.keyId == 'config');
          if (!config) {
            logger.warn(t`Decrypted Space with no known config key`);
            failed.push({ spaceId: space.spaceId, reason: 'missing config key' });
            continue;
          }

          const hub = space.keys.find((k) => k.keyId == 'hub');
          if (!hub) {
            logger.warn(t`Decrypted Space with no known hub key`);
            failed.push({ spaceId: space.spaceId, reason: 'missing hub key' });
            continue;
          }

          const reg = (await this.apiClient.getSpace(space.spaceId)).data;
          this.spaceInfo.current[space.spaceId] = reg;

          const manifestPayload = await this.apiClient.getSpaceManifest(
            space.spaceId
          );
          if (!manifestPayload) {
            logger.warn(t`Could not obtain manifest for Space`);
            // Reported, like every other failure branch in this loop. Without
            // this the Space fell out of restored/alreadyPresent/failed alike and
            // vanished from the restore report — while its keys, saved a few
            // lines above, were already on disk with no `spaces` row to render.
            failed.push({
              spaceId: space.spaceId,
              reason: 'could not fetch Space manifest',
            });
            continue;
          }

          const ciphertext = JSON.parse(
            manifestPayload.data.space_manifest
          ) as {
            ciphertext: string;
            initialization_vector: string;
            associated_data: string;
          };
          // Decrypt in its OWN try, so "we cannot open this manifest" can be
          // told apart from every other way this block can fail.
          //
          // This used to be reported by pattern-matching the outer catch's error
          // text for /decryption|is not valid JSON|aead/. That is far too broad:
          // the outer try also covers two API calls and two other JSON.parse
          // calls, so an outage returning HTML would fail with "is not valid
          // JSON" and be reported as "you no longer have access to this Space".
          // Telling someone a RECOVERABLE Space is permanently gone is worse
          // than the raw error it replaced, because they stop retrying.
          //
          // Scope, not pattern: only a failure here means the key cannot open
          // the manifest, which is what being removed from a Space looks like.
          let manifest: Space;
          try {
            manifest = JSON.parse(
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
          } catch (decryptError) {
            logger.warn(
              t`Could not decrypt Space manifest — key no longer opens it`,
              decryptError
            );
            failed.push({
              spaceId: space.spaceId,
              reason:
                'you no longer have access to this Space — its keys were changed, ' +
                'which happens when a member is removed',
            });
            continue;
          }

          // Written only once the manifest has decrypted — i.e. once we know
          // this Space can actually be rebuilt. Saving them earlier left
          // orphaned key rows for a Space that never got a `spaces` row: rows
          // nothing renders, nothing exports (getAllSpaceData iterates Spaces,
          // not keys), and nothing cleans up. The kicked-user case reaches
          // exactly that path, because a kick rotates the config key and the
          // old one can no longer open the manifest.
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

          restored.push(space.spaceId);
        } catch (e) {
          console.error(t`Could not add Space`, e);
          // Counted, not rethrown: one unreachable Space must not abandon the
          // rest of the batch. Unchanged behaviour — only now it is reportable
          // instead of visible solely in the console.
          //
          // The manifest-decrypt failure is named specially because it is the
          // EXPECTED outcome for someone who was kicked: a kick rotates the
          // Space's config key and re-encrypts the manifest to it, so the key in
          // an older backup can no longer open it. Measured by the space-kick
          // harness scenario, which saw this surface to the user as
          // `Unexpected token 'D', "Decryption"... is not valid JSON` — the raw
          // JSON.parse error from the SDK's failure string. Accurate, useless.
          // Reported verbatim. The one failure worth translating — the manifest
          // not opening — is caught at its own call site above, so anything
          // reaching here is a genuine error the user should see as-is rather
          // than have guessed at.
          failed.push({
            spaceId: space.spaceId,
            reason: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    return { restored, alreadyPresent, failed };
  }

  /**
   * Record — never block — an incoming config that carries fewer Spaces than
   * this device already had.
   *
   * The number that matters is `stillInDb`: Spaces this device holds complete,
   * usable rows for that are about to stop being rendered. Those are exactly
   * the ones Settings → Restore Spaces puts back, so a non-zero count is this
   * bug firing rather than a legitimate remove-on-another-device.
   *
   * Two deliberate choices:
   * - `console.warn`, not `logger.warn`. The shared logger compiles to a no-op
   *   in production builds, and a diagnostic that is silent in the only build
   *   real users run is not a diagnostic.
   * - A localStorage ring as well as the console. The console is empty unless
   *   devtools happened to be open before the adoption, and this fires while
   *   the user is looking at the sidebar, not at devtools.
   *
   * Wrapped whole in try/catch: an instrument must never be able to break the
   * sync path it is measuring.
   */
  private async recordSpaceListShrinkOnAdopt(
    storedConfig: UserConfig | undefined,
    incoming: UserConfig
  ): Promise<void> {
    try {
      const before = storedConfig?.spaceIds ?? [];
      if (before.length === 0) return;

      const after = new Set(incoming.spaceIds ?? []);
      const dropped = before.filter(id => !after.has(id));
      if (dropped.length === 0) return;

      // Only read the DB once we know something was dropped.
      const dbSpaceIds = new Set((await this.messageDB.getSpaces()).map(s => s.spaceId));
      const stillInDb = dropped.filter(id => dbSpaceIds.has(id));

      const entry = {
        at: new Date().toISOString(),
        incomingTimestamp: incoming.timestamp,
        before: before.length,
        after: after.size,
        dropped: dropped.length,
        stillInDb: stillInDb.length,
        droppedIds: dropped.slice(0, 25),
      };

      console.warn(
        `[ConfigService] ADOPTED a config that drops ${entry.dropped} Space(s) ` +
          `(${entry.before} → ${entry.after}); ${entry.stillInDb} of them are still ` +
          `present in this device's local DB and will disappear from the sidebar:`,
        entry
      );

      if (typeof localStorage === 'undefined') return;
      const KEY = 'quorum:diag:configSpaceShrink';
      let ring: unknown[] = [];
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) ring = parsed;
        }
      } catch {
        // A corrupted ring must not cost us this entry — start a fresh one.
      }
      ring.push(entry);
      localStorage.setItem(KEY, JSON.stringify(ring.slice(-20)));
    } catch (e) {
      console.warn('[ConfigService] space-shrink diagnostic failed (ignored)', e);
    }
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

    // Captured before `ts` overwrites it. Every path below that does NOT reach
    // the server puts this back, so a save that was never published cannot
    // advance this device's timestamp. See the note in the refuse-to-publish
    // branch for why that matters.
    const incomingTimestamp = configInput.timestamp ?? 0;

    // Held rather than thrown, so the local save below still runs. Re-thrown
    // once it has. See the catch around the POST for why both halves matter.
    let publishError: unknown;

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

      // Collect bookmarks before encryption (Phase 7: Sync Integration)
      //
      // Stripped on the way out, not just at creation time. Bookmarks written
      // before this change — and any adopted from a device still running an
      // older build — still carry an embedded base64 avatar per bookmark, which
      // measured 656 KB of an 873 KB blob against a ~1 MB working ceiling. This
      // is the choke point that keeps them out of the upload regardless of what
      // is on disk. The local sweep (useStripBookmarkSenderIcons) then reclaims
      // the disk copy; this line is what protects the blob in the meantime.
      const collectedBookmarks = stripBookmarkSenderIcons(
        await this.messageDB.getBookmarks()
      );
      if (collectedBookmarks.strippedCount > 0) {
        logger.log(
          `[ConfigService] dropped ${collectedBookmarks.strippedCount} legacy bookmark avatar(s) ` +
            `from the sync payload (~${Math.round(collectedBookmarks.bytesFreed / 1024)} KB)`
        );
      }
      config.bookmarks = collectedBookmarks.bookmarks;
      // Note: deletedBookmarkIds will be reset AFTER successful sync

      // Collect user notes before encryption
      config.userNotes = await this.messageDB.getAllUserNotes();
      // Note: deletedUserNoteAddresses will be reset AFTER successful sync

      // Build the payload we POST. The server rejects a config whose spaceIds
      // and spaceKeys disagree, so the parcel is narrowed to Spaces this device
      // can currently prove it holds encryption keys for.
      //
      // This narrowing MUST stay on `uploadConfig`. `config` is what we persist
      // to IndexedDB and push into the React Query cache below; trimming it
      // there deletes Spaces from this device's own nav whenever the local DB is
      // momentarily incomplete, which is how a device silently wipes its own
      // Space list. Note the copies below: folder items are cloned rather than
      // mutated, because a shallow spread still shares those nested objects.
      // See 2026-01-09-config-sync-space-loss-race-condition.md under .agents/issues/
      const uploadConfig: UserConfig = { ...config };
      const validSpaceIds = new Set(config.spaceKeys.map(sk => sk.spaceId));
      uploadConfig.spaceIds = config.spaceIds.filter(id => validSpaceIds.has(id));
      if (config.items) {
        uploadConfig.items = config.items
          .map(item =>
            item.type === 'space'
              ? item
              : // Clone folders: filtering in place would corrupt `config.items`
                { ...item, spaceIds: item.spaceIds.filter(id => validSpaceIds.has(id)) }
          )
          // Drop unkeyed Spaces, and folders left empty by the line above
          .filter(item =>
            item.type === 'space' ? validSpaceIds.has(item.id) : item.spaceIds.length > 0
          );
      }

      // Bidirectional consistency: spaceIds ⟷ spaceKeys, as the server requires
      const finalSpaceIds = new Set(uploadConfig.spaceIds);
      uploadConfig.spaceKeys = config.spaceKeys.filter(sk => finalSpaceIds.has(sk.spaceId));

      // A Space dropped here is one this device still wants but cannot prove a
      // key for right now: an incomplete local DB, not a removal. Deliberate
      // removals never reach this branch, because leaving or deleting a Space
      // takes it out of config.spaceIds before saveConfig runs — nothing is
      // dropped, and the upload proceeds exactly as before. So removals still
      // propagate to other devices on the existing mechanism.
      //
      // Publishing a truncated list is what turns one device's incomplete DB
      // into every device's problem: this config wins on timestamp, and
      // getConfig applies a remote Space list verbatim, so every other device
      // adopts the shorter list. Hold the upload and let a later save publish
      // the full list once the missing Spaces have synced.
      // See 2026-01-09-config-sync-space-loss-race-condition.md under .agents/issues/
      const droppedSpaceIds = config.spaceIds.filter(id => !finalSpaceIds.has(id));

      if (droppedSpaceIds.length > 0) {
        // Local-only: the config below is still persisted with the full list,
        // and tombstones are deliberately NOT cleared, since nothing synced.
        logger.warn(
          `[ConfigService] NOT publishing — would upload ${uploadConfig.spaceIds.length}/${config.spaceIds.length} Spaces; the change is local-only until these finish syncing:`,
          droppedSpaceIds
        );

        // Keep the timestamp we came in with — see `incomingTimestamp` above.
        // `ts` still gates the cache write below, so the UI updates as usual.
        config.timestamp = incomingTimestamp;

        recordLastPublish('held', {
          spacesPublished: uploadConfig.spaceIds.length,
          spacesHeld: droppedSpaceIds.length,
        });
      } else {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const configJson = JSON.stringify(uploadConfig);
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
        try {
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

          recordLastPublish('published', {
            payloadBytes: ciphertext.length,
            spacesPublished: uploadConfig.spaceIds.length,
          });

          // Reset tombstones only after successful sync (Phase 7: Critical Fix)
          config.deletedBookmarkIds = [];
          config.deletedUserNoteAddresses = [];
          config.deletedUserNotes = [];
        } catch (error) {
          // A refused upload used to throw straight out of saveConfig, so the
          // local save at the end never ran and the edit the user had just made
          // was discarded on this device. The server rejects the WHOLE blob when
          // it is oversized (evals bloat, #108), and the queue reads "invalid"
          // in that message as permanent, so nothing retried it either — the
          // change was simply gone. Hold the error, let the save happen, throw
          // after. Covered by ConfigService.unit.test.tsx §8.
          publishError = error;
          logger.warn(
            '[ConfigService] Settings POST failed — keeping the change locally, not published:',
            error
          );

          // Recorded before the timestamp restore below, so the payload size is
          // captured even for the failures we most want to size up.
          recordLastPublish(classifyPublishError(error), {
            payloadBytes: ciphertext.length,
            spacesPublished: uploadConfig.spaceIds.length,
            detail: error instanceof Error ? error.message : String(error),
          });

          // Nothing reached the server, so nothing earned a newer timestamp.
          // Without this, persisting on the failure path would re-open the hole
          // #320 closed: this device would outrank every other one while being
          // the only one that failed to publish, and would then stop applying
          // their configs. Publishing is what earns the right to a newer stamp.
          config.timestamp = incomingTimestamp;
        }
      }
    } else {
      // Sync is off, so nothing was published and the server never agreed to a
      // newer timestamp — keep the one we came in with, exactly as the
      // refuse-to-publish branch does.
      //
      // Without this, every local change on a sync-off device advances its
      // timestamp unwitnessed. Two things follow, both silent. The device
      // drifts ahead of the server, so getConfig starts returning local
      // unconditionally and it stops applying other devices' changes for good.
      // And when the user later turns sync ON, that stale-but-newer picture
      // wins and is adopted verbatim by every other device, taking with it
      // every Space and setting those devices had and this one did not.
      //
      // The write below still happens: the user's change persists locally.
      // Only the claim to authority is withheld.
      // See 2026-08-07-a-device-with-sync-off-still-claims-a-newer-timestamp.md
      config.timestamp = incomingTimestamp;

      recordLastPublish('off');
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

    // Everything local has landed; now let the failure surface. The queue needs
    // this to classify the error (permanent vs retryable) and to show "Failed to
    // save settings". Swallowing it here would look like a passing test and be a
    // silent regression: no retry for transient failures, no message for real
    // ones.
    if (publishError) throw publishError;
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

