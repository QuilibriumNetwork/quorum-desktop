// SyncService.ts - Desktop sync service with new hash-based delta protocol
// This service handles space synchronization operations

import { logger } from '@quilibrium/quorum-shared';
import { MessageDB } from '../db/messages';
import { channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import { Message } from '../api/quorumApi';
import { hexToSpreadArray } from '../utils/crypto';
import {
  SyncService as SharedSyncService,
  SyncSummary,
  SyncManifest,
  SyncDeltaPayload,
  SyncManifestPayload,
  SyncInitiatePayload,
  MemberDigest,
  createSyncSummary,
  createManifest,
  createMemberDigest,
  computeMessageDiff,
  computeMemberDiff,
  computePeerDiff,
  buildMessageDelta,
  buildMemberDelta,
  chunkMessages,
  PeerEntry,
} from '@quilibrium/quorum-shared';
import { IndexedDBAdapter } from '../adapters/indexedDbAdapter';

export class SyncService {
  private messageDB: MessageDB;
  private enqueueOutbound: (callback: () => Promise<string[]>) => void;
  private syncInfo: React.MutableRefObject<{
    [spaceId: string]: {
      expiry: number;
      candidates: any[];
      invokable: NodeJS.Timeout | undefined;
    };
  }>;
  private sendHubMessage: (spaceId: string, message: string) => Promise<string>;
  private storageAdapter: IndexedDBAdapter;
  private sharedSyncService: SharedSyncService;

  constructor(dependencies: {
    messageDB: MessageDB;
    enqueueOutbound: (callback: () => Promise<string[]>) => void;
    syncInfo: React.MutableRefObject<{
      [spaceId: string]: {
        expiry: number;
        candidates: any[];
        invokable: NodeJS.Timeout | undefined;
      };
    }>;
    sendHubMessage: (spaceId: string, message: string) => Promise<string>;
  }) {
    this.messageDB = dependencies.messageDB;
    this.enqueueOutbound = dependencies.enqueueOutbound;
    this.syncInfo = dependencies.syncInfo;
    this.sendHubMessage = dependencies.sendHubMessage;

    // Initialize storage adapter and shared sync service
    this.storageAdapter = new IndexedDBAdapter(dependencies.messageDB);
    this.sharedSyncService = new SharedSyncService({
      storage: this.storageAdapter,
      maxMessages: 1000,
      requestExpiry: 30000,
    });
  }

  /**
   * Syncs all space data (peer map, members, messages) to specific inbox in 5MB chunks.
   */
  async synchronizeAll(spaceId: string, inboxAddress: string): Promise<void> {
    try {
      const ownerKey = await this.messageDB.getSpaceKey(spaceId, 'owner');
      if (ownerKey) {
        this.enqueueOutbound(async () => {
          const memberSet = await this.messageDB.getSpaceMembers(spaceId);
          const messageSet = await this.messageDB.getAllSpaceMessages({ spaceId });
          const hubKey = await this.messageDB.getSpaceKey(spaceId, 'hub');
          const configKey = await this.messageDB.getSpaceKey(spaceId, 'config');
          const outbounds: string[] = [];
          const encryptionState = await this.messageDB.getEncryptionStates({
            conversationId: spaceId + '/' + spaceId,
          });
          const ratchet = JSON.parse(
            JSON.parse(encryptionState[0].state).state
          );
          const id_peer_map = ratchet.id_peer_map;
          const peer_id_map = ratchet.peer_id_map;
          const configKeyParam = configKey
            ? {
                type: 'x448' as const,
                public_key: hexToSpreadArray(configKey.publicKey),
                private_key: hexToSpreadArray(configKey.privateKey),
              }
            : undefined;
          const envelope = await secureChannel.SealSyncEnvelope(
            inboxAddress,
            hubKey.address!,
            {
              type: 'ed448',
              private_key: hexToSpreadArray(hubKey.privateKey),
              public_key: hexToSpreadArray(hubKey.publicKey),
            },
            {
              type: 'ed448',
              private_key: hexToSpreadArray(ownerKey.privateKey),
              public_key: hexToSpreadArray(ownerKey.publicKey),
            },
            JSON.stringify({
              type: 'control',
              message: {
                type: 'sync-peer-map',
                peerMap: {
                  id_peer_map,
                  peer_id_map,
                  // Include critical ratchet state fields for decryption
                  root_key: ratchet.root_key,
                  dkg_ratchet: ratchet.dkg_ratchet,
                  receiving_group_key: ratchet.receiving_group_key,
                  receiving_chain_key: ratchet.receiving_chain_key,
                  current_header_key: ratchet.current_header_key,
                  next_header_key: ratchet.next_header_key,
                  async_dkg_pubkey: ratchet.async_dkg_pubkey,
                  threshold: ratchet.threshold,
                },
              },
            }),
            configKeyParam
          );
          outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));

          // ensures size does not hit group message size limit:
          const chunkSize = 5 * 1024 * 1024;
          for (let i = 0; i < memberSet.length; i++) {
            const chunk = [] as (secureChannel.UserProfile & {
              inbox_address: string;
            })[];

            let messageSize = 0;
            while (
              i < memberSet.length &&
              (messageSize + JSON.stringify(memberSet[i]).length <
                chunkSize ||
                messageSize == 0)
            ) {
              messageSize += JSON.stringify(memberSet[i]).length;
              chunk.push(memberSet[i]);
              i++;
            }

            const envelope = await secureChannel.SealSyncEnvelope(
              inboxAddress,
              hubKey.address!,
              {
                type: 'ed448',
                private_key: hexToSpreadArray(hubKey.privateKey),
                public_key: hexToSpreadArray(hubKey.publicKey),
              },
              {
                type: 'ed448',
                private_key: hexToSpreadArray(ownerKey.privateKey),
                public_key: hexToSpreadArray(ownerKey.publicKey),
              },
              JSON.stringify({
                type: 'control',
                message: {
                  type: 'sync-members',
                  members: chunk,
                },
              }),
              configKeyParam
            );
            outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));
          }
          for (let i = 0; i < messageSet.length; i++) {
            const chunk = [] as Message[];

            let messageSize = 0;
            while (
              i < messageSet.length &&
              (messageSize + JSON.stringify(messageSet[i]).length <
                chunkSize ||
                messageSize == 0)
            ) {
              messageSize += JSON.stringify(messageSet[i]).length;
              chunk.push(messageSet[i]);
              i++;
            }

            const envelope = await secureChannel.SealSyncEnvelope(
              inboxAddress,
              hubKey.address!,
              {
                type: 'ed448',
                private_key: hexToSpreadArray(hubKey.privateKey),
                public_key: hexToSpreadArray(hubKey.publicKey),
              },
              {
                type: 'ed448',
                private_key: hexToSpreadArray(ownerKey.privateKey),
                public_key: hexToSpreadArray(ownerKey.publicKey),
              },
              JSON.stringify({
                type: 'control',
                message: {
                  type: 'sync-messages',
                  messages: chunk,
                },
              }),
              configKeyParam
            );
            outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));
          }
          return outbounds;
        });
      }
    } catch {}
  }

  /**
   * Initiates sync to best candidate peer (highest message count).
   */
  async initiateSync(spaceId: string): Promise<void> {
    logger.log(`[SyncService] initiateSync called for space ${spaceId.substring(0, 12)}`);
    if (
      !this.syncInfo.current[spaceId] ||
      !this.syncInfo.current[spaceId].candidates.length
    ) {
      logger.log(`[SyncService] initiateSync: No candidates available`);
      return;
    }

    const memberSet = await this.messageDB.getSpaceMembers(spaceId);
    const messageSet = await this.messageDB.getAllSpaceMessages({ spaceId });
    logger.log(`[SyncService] initiateSync: We have ${messageSet.length} messages, ${memberSet.length} members`);

    // Compute our manifest hash for comparison
    const ourSummary = createSyncSummary(messageSet as any[], memberSet.length);

    let candidates = this.syncInfo.current[spaceId].candidates;
    logger.log(`[SyncService] initiateSync: ${candidates.length} raw candidates`);

    // Helper to get message count and manifest hash from legacy or new protocol format
    const getMessageCount = (c: any) => c.messageCount ?? c.summary?.messageCount ?? 0;
    const getManifestHash = (c: any) => c.summary?.manifestHash;

    // Filter to candidates that have more messages OR different messages than us
    candidates = candidates
      .filter((c) => {
        const theirCount = getMessageCount(c);
        const theirHash = getManifestHash(c);
        const hasMore = theirCount > messageSet.length;
        // If they have a manifest hash and it differs, they have different messages
        const hasDifferent = theirHash && theirHash !== ourSummary.manifestHash;
        logger.log(`[SyncService] initiateSync: Candidate ${c.inboxAddress?.substring(0, 12)} has ${theirCount} messages, hasMore: ${hasMore}, hasDifferent: ${hasDifferent}`);
        return hasMore || hasDifferent;
      })
      .sort((a, b) => getMessageCount(b) - getMessageCount(a));

    if (candidates.length == 0) {
      logger.log(`[SyncService] initiateSync: No candidates with more or different messages than us`);
      return;
    }

    logger.log(`[SyncService] initiateSync: Syncing with best candidate: ${candidates[0].inboxAddress?.substring(0, 12)}`);
    this.enqueueOutbound(async () => {
      const hubKey = await this.messageDB.getSpaceKey(spaceId, 'hub');
      const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');
      const configKey = await this.messageDB.getSpaceKey(spaceId, 'config');
      const configKeyParam = configKey
        ? {
            type: 'x448' as const,
            public_key: hexToSpreadArray(configKey.publicKey),
            private_key: hexToSpreadArray(configKey.privateKey),
          }
        : undefined;

      const envelope = await secureChannel.SealSyncEnvelope(
        candidates[0].inboxAddress,
        hubKey.address!,
        {
          type: 'ed448',
          private_key: hexToSpreadArray(hubKey.privateKey),
          public_key: hexToSpreadArray(hubKey.publicKey),
        },
        {
          type: 'ed448',
          private_key: hexToSpreadArray(inboxKey.privateKey),
          public_key: hexToSpreadArray(inboxKey.publicKey),
        },
        JSON.stringify({
          type: 'control',
          message: {
            type: 'sync-initiate',
            inboxAddress: inboxKey.address,
            memberCount: memberSet.length,
            messageCount: messageSet.length,
            latestMessageTimestamp:
              messageSet.length > 0
                ? messageSet[messageSet.length - 1].createdDate
                : -1,
            oldestMessageTimestamp:
              messageSet.length > 0 ? messageSet[0].createdDate : -1,
          },
        }),
        configKeyParam
      );
      return [JSON.stringify({ type: 'sync', ...envelope })];
    });
  }

  /**
   * Sends missing data to peer based on their timestamp range.
   */
  async directSync(
    spaceId: string,
    message: {
      inboxAddress: string;
      memberCount: number;
      messageCount: number;
      latestMessageTimestamp: number;
      oldestMessageTimestamp: number;
    }
  ): Promise<void> {
    this.enqueueOutbound(async () => {
      const memberSet = await this.messageDB.getSpaceMembers(spaceId);
      const messageSet = await this.messageDB.getAllSpaceMessages({ spaceId });
      const hubKey = await this.messageDB.getSpaceKey(spaceId, 'hub');
      const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');
      const configKey = await this.messageDB.getSpaceKey(spaceId, 'config');
      const configKeyParam = configKey
        ? {
            type: 'x448' as const,
            public_key: hexToSpreadArray(configKey.publicKey),
            private_key: hexToSpreadArray(configKey.privateKey),
          }
        : undefined;
      const outbounds: string[] = [];
      const encryptionState = await this.messageDB.getEncryptionStates({
        conversationId: spaceId + '/' + spaceId,
      });
      const ratchet = JSON.parse(JSON.parse(encryptionState[0].state).state);
      const id_peer_map = ratchet.id_peer_map;
      const peer_id_map = ratchet.peer_id_map;
      const envelope = await secureChannel.SealSyncEnvelope(
        message.inboxAddress,
        hubKey.address!,
        {
          type: 'ed448',
          private_key: hexToSpreadArray(hubKey.privateKey),
          public_key: hexToSpreadArray(hubKey.publicKey),
        },
        {
          type: 'ed448',
          private_key: hexToSpreadArray(inboxKey.privateKey),
          public_key: hexToSpreadArray(inboxKey.publicKey),
        },
        JSON.stringify({
          type: 'control',
          message: {
            type: 'sync-peer-map',
            peerMap: {
              id_peer_map,
              peer_id_map,
              // Include critical ratchet state fields for decryption
              root_key: ratchet.root_key,
              dkg_ratchet: ratchet.dkg_ratchet,
              receiving_group_key: ratchet.receiving_group_key,
              current_header_key: ratchet.current_header_key,
              next_header_key: ratchet.next_header_key,
              async_dkg_pubkey: ratchet.async_dkg_pubkey,
              threshold: ratchet.threshold,
            },
          },
        }),
        configKeyParam
      );
      outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));

      // ensures size does not hit group message size limit:
      const chunkSize = 5 * 1024 * 1024;
      for (let i = 0; i < memberSet.length; i++) {
        const chunk = [] as (secureChannel.UserProfile & {
          inbox_address: string;
        })[];

        let messageSize = 0;
        while (
          i < memberSet.length &&
          (messageSize + JSON.stringify(memberSet[i]).length < chunkSize ||
            messageSize == 0)
        ) {
          messageSize += JSON.stringify(memberSet[i]).length;
          chunk.push(memberSet[i]);
          i++;
        }

        const envelope = await secureChannel.SealSyncEnvelope(
          message.inboxAddress,
          hubKey.address!,
          {
            type: 'ed448',
            private_key: hexToSpreadArray(hubKey.privateKey),
            public_key: hexToSpreadArray(hubKey.publicKey),
          },
          {
            type: 'ed448',
            private_key: hexToSpreadArray(inboxKey.privateKey),
            public_key: hexToSpreadArray(inboxKey.publicKey),
          },
          JSON.stringify({
            type: 'control',
            message: {
              type: 'sync-members',
              members: chunk,
            },
          }),
          configKeyParam
        );
        outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));
      }
      for (let i = 0; i < messageSet.length; i++) {
        const chunk = [] as Message[];

        let messageSize = 0;
        while (
          i < messageSet.length &&
          (messageSize + JSON.stringify(messageSet[i]).length < chunkSize ||
            messageSize == 0)
        ) {
          if (
            !(
              message.oldestMessageTimestamp > -1 &&
              message.latestMessageTimestamp > -1 &&
              messageSet[i].createdDate >= message.oldestMessageTimestamp &&
              messageSet[i].createdDate <= message.latestMessageTimestamp
            )
          ) {
            messageSize += JSON.stringify(messageSet[i]).length;
            chunk.push(messageSet[i]);
          }
          i++;
        }

        if (messageSize === 0) {
          continue;
        }

        const envelope = await secureChannel.SealSyncEnvelope(
          message.inboxAddress,
          hubKey.address!,
          {
            type: 'ed448',
            private_key: hexToSpreadArray(hubKey.privateKey),
            public_key: hexToSpreadArray(hubKey.publicKey),
          },
          {
            type: 'ed448',
            private_key: hexToSpreadArray(inboxKey.privateKey),
            public_key: hexToSpreadArray(inboxKey.publicKey),
          },
          JSON.stringify({
            type: 'control',
            message: {
              type: 'sync-messages',
              messages: chunk,
            },
          }),
          configKeyParam
        );
        outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));
      }
      return outbounds;
    });
  }

  /**
   * Broadcasts sync request to all members via hub (30s expiry, schedules initiateSync).
   * NEW PROTOCOL: Includes SyncSummary with manifest hash for efficient delta comparison.
   */
  async requestSync(spaceId: string): Promise<void> {
    try {
      this.enqueueOutbound(async () => {
        const hubKey = await this.messageDB.getSpaceKey(spaceId, 'hub');
        const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');
        const configKey = await this.messageDB.getSpaceKey(spaceId, 'config');
        if (configKey) {
          const pubBytes = hexToSpreadArray(configKey.publicKey);
          const privBytes = hexToSpreadArray(configKey.privateKey);
        }
        const expiry = Date.now() + 30000;
        const memberSet = await this.messageDB.getSpaceMembers(spaceId);
        const messageSet = await this.messageDB.getAllSpaceMessages({ spaceId });

        // Create SyncSummary for new protocol (includes manifest hash)
        const summary = createSyncSummary(messageSet as any[], memberSet.length);

        const envelope = await secureChannel.SealHubEnvelope(
          hubKey.address!,
          {
            type: 'ed448',
            private_key: hexToSpreadArray(hubKey.privateKey),
            public_key: hexToSpreadArray(hubKey.publicKey),
          },
          JSON.stringify({
            type: 'control',
            message: {
              type: 'sync-request',
              inboxAddress: inboxKey.address,
              expiry: expiry,
              // Legacy fields (kept for backwards compatibility)
              memberCount: memberSet.length,
              messageCount: messageSet.length,
              // New protocol field
              summary,
            },
          }),
          configKey
            ? {
                type: 'x448',
                public_key: hexToSpreadArray(configKey.publicKey),
                private_key: hexToSpreadArray(configKey.privateKey),
              }
            : undefined
        );
        this.syncInfo.current[spaceId] = {
          expiry,
          candidates: [],
          invokable: setTimeout(() => this.initiateSync(spaceId), 30000),
        };
        return [JSON.stringify({ type: 'group', ...envelope })];
      });
    } catch {}
  }

  /**
   * Sends verify-kicked message for users whose last event was kick.
   */
  async sendVerifyKickedStatuses(spaceId: string): Promise<number> {
    const messages = await this.messageDB.getAllSpaceMessages({ spaceId });
    const lastEventByUser = new Map<string, 'kick' | 'join'>();
    messages
      .filter((m) => m.content?.type === 'kick' || m.content?.type === 'join')
      .sort((a, b) => a.createdDate - b.createdDate)
      .forEach((m) => {
        const addr = (m.content as any).senderId;
        if (!addr) return;
        if (m.content.type === 'kick') lastEventByUser.set(addr, 'kick');
        else if (m.content.type === 'join') lastEventByUser.set(addr, 'join');
      });

    const kicked = Array.from(lastEventByUser.entries())
      .filter(([, evt]) => evt === 'kick')
      .map(([addr]) => addr);

    if (kicked.length === 0) return 0;

    this.enqueueOutbound(async () => {
      return [
        await this.sendHubMessage(
          spaceId,
          JSON.stringify({
            type: 'control',
            message: {
              type: 'verify-kicked',
              addresses: kicked,
            },
          })
        ),
      ];
    });

    return kicked.length;
  }

  /**
   * Responds to sync-request with our counts if we have more data.
   * NEW PROTOCOL: If theirSummary is provided, uses hash-based comparison.
   */
  async informSyncData(
    spaceId: string,
    inboxAddress: string,
    messageCount: number,
    memberCount: number,
    theirSummary?: SyncSummary
  ): Promise<void> {
    logger.log(`[SyncService] informSyncData called for space ${spaceId.substring(0, 12)}, target: ${inboxAddress.substring(0, 12)}`);
    try {
      const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');
      logger.log(`[SyncService] informSyncData: Our inbox: ${inboxKey?.address?.substring(0, 12) || 'none'}`);
      if (inboxKey && inboxKey.address != inboxAddress) {
        const memberSet = await this.messageDB.getSpaceMembers(spaceId);
        const messageSet = await this.messageDB.getAllSpaceMessages({ spaceId });
        logger.log(`[SyncService] informSyncData: We have ${messageSet.length} messages, ${memberSet.length} members`);
        logger.log(`[SyncService] informSyncData: They reported ${messageCount} messages, ${memberCount} members`);

        // Create our summary
        const ourSummary = createSyncSummary(messageSet as any[], memberSet.length);

        // Check if we have anything useful to share
        if (theirSummary) {
          logger.log(`[SyncService] informSyncData: Using new protocol comparison`);
          // New protocol: Use hash-based comparison
          if (
            ourSummary.manifestHash === theirSummary.manifestHash &&
            ourSummary.memberCount === theirSummary.memberCount
          ) {
            // Already in sync
            logger.log(`[SyncService] informSyncData: Already in sync (hash match), not responding`);
            return;
          }

          // Check if we actually have more data or different data
          const hasMoreMessages = ourSummary.messageCount > theirSummary.messageCount;
          const hasMoreMembers = ourSummary.memberCount > theirSummary.memberCount;
          const hasNewerMessages = ourSummary.newestMessageTimestamp > theirSummary.newestMessageTimestamp;
          const hasOlderMessages = ourSummary.oldestMessageTimestamp < theirSummary.oldestMessageTimestamp;
          // If hashes differ, we likely have different messages even if counts are equal
          const hasDifferentMessages = ourSummary.manifestHash !== theirSummary.manifestHash;
          logger.log(`[SyncService] informSyncData: hasMoreMessages=${hasMoreMessages}, hasMoreMembers=${hasMoreMembers}, hasNewerMessages=${hasNewerMessages}, hasOlderMessages=${hasOlderMessages}, hasDifferentMessages=${hasDifferentMessages}`);

          if (!hasMoreMessages && !hasMoreMembers && !hasNewerMessages && !hasOlderMessages && !hasDifferentMessages) {
            logger.log(`[SyncService] informSyncData: We have nothing more to offer, not responding`);
            return;
          }
        } else {
          logger.log(`[SyncService] informSyncData: Using legacy protocol comparison`);
          // Legacy protocol: Simple count comparison
          if (
            messageCount >= messageSet.length &&
            memberCount >= memberSet.length
          ) {
            logger.log(`[SyncService] informSyncData: They have >= our data (legacy), not responding`);
            return;
          }
        }
        logger.log(`[SyncService] informSyncData: We have data to share, sending sync-info`);

        this.enqueueOutbound(async () => {
          const hubKey = await this.messageDB.getSpaceKey(spaceId, 'hub');
          const configKey = await this.messageDB.getSpaceKey(spaceId, 'config');
          const configKeyParam = configKey
            ? {
                type: 'x448' as const,
                public_key: hexToSpreadArray(configKey.publicKey),
                private_key: hexToSpreadArray(configKey.privateKey),
              }
            : undefined;
          const outbounds: string[] = [];

          const envelope = await secureChannel.SealSyncEnvelope(
            inboxAddress,
            hubKey.address!,
            {
              type: 'ed448',
              private_key: hexToSpreadArray(hubKey.privateKey),
              public_key: hexToSpreadArray(hubKey.publicKey),
            },
            {
              type: 'ed448',
              private_key: hexToSpreadArray(inboxKey.privateKey),
              public_key: hexToSpreadArray(inboxKey.publicKey),
            },
            JSON.stringify({
              type: 'control',
              message: {
                type: 'sync-info',
                inboxAddress: inboxKey.address,
                // Legacy fields
                messageCount: messageSet.length,
                memberCount: memberSet.length,
                // New protocol field
                summary: ourSummary,
              },
            }),
            configKeyParam
          );
          outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));
          logger.log(`[SyncService] informSyncData: Queued sync-info response`);

          return outbounds;
        });
      } else {
        logger.log(`[SyncService] informSyncData: Skipping - either no inboxKey or target is ourselves`);
      }
    } catch (error) {
      console.error(`[SyncService] informSyncData error:`, error);
    }
  }

  /**
   * NEW PROTOCOL: Handles sync-initiate with manifest.
   * Responds with our manifest AND sync-delta (bidirectional sync).
   */
  async handleSyncInitiateV2(
    spaceId: string,
    message: SyncInitiatePayload
  ): Promise<void> {
    logger.log(`[SyncService] handleSyncInitiateV2 called for space ${spaceId.substring(0, 12)}`);
    logger.log(`[SyncService] sync-initiate from: ${message.inboxAddress?.substring(0, 12)}`);
    logger.log(`[SyncService] sync-initiate has manifest: ${!!message.manifest}, has memberDigests: ${!!message.memberDigests}, has peerIds: ${!!message.peerIds}`);

    if (!message.manifest || !message.inboxAddress) {
      logger.log(`[SyncService] sync-initiate: Missing manifest or inboxAddress, falling back to legacy directSync`);
      // Fall back to legacy directSync
      await this.directSync(spaceId, message as any);
      return;
    }

    logger.log(`[SyncService] sync-initiate: Their manifest has ${message.manifest.digests.length} digests`);

    this.enqueueOutbound(async () => {
      const hubKey = await this.messageDB.getSpaceKey(spaceId, 'hub');
      const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');
      const configKey = await this.messageDB.getSpaceKey(spaceId, 'config');
      const configKeyParam = configKey
        ? {
            type: 'x448' as const,
            public_key: hexToSpreadArray(configKey.publicKey),
            private_key: hexToSpreadArray(configKey.privateKey),
          }
        : undefined;
      const messageSet = await this.messageDB.getAllSpaceMessages({ spaceId });
      const memberSet = await this.messageDB.getSpaceMembers(spaceId);
      const outbounds: string[] = [];

      logger.log(`[SyncService] sync-initiate: We have ${messageSet.length} messages, ${memberSet.length} members`);

      // Get our peer entries
      const encryptionState = await this.messageDB.getEncryptionStates({
        conversationId: spaceId + '/' + spaceId,
      });
      let peerIds: number[] = [];
      const ourPeerEntries = new Map<number, PeerEntry>();
      if (encryptionState.length > 0) {
        const ratchet = JSON.parse(JSON.parse(encryptionState[0].state).state);
        if (ratchet.id_peer_map) {
          peerIds = Object.keys(ratchet.id_peer_map).map(Number);
          for (const [idStr, pubKey] of Object.entries(ratchet.id_peer_map)) {
            const peerId = parseInt(idStr, 10);
            ourPeerEntries.set(peerId, { peerId, publicKey: pubKey as string });
          }
        }
      }

      // Create our manifest
      const space = await this.messageDB.getSpace(spaceId);
      const channelId = space?.defaultChannelId || spaceId;
      const ourManifest = createManifest(spaceId, channelId, messageSet as any[]);
      const ourMemberDigests = memberSet.map((m) =>
        createMemberDigest({
          address: (m as any).user_address,
          inbox_address: (m as any).inbox_address,
          display_name: (m as any).display_name,
          profile_image: (m as any).user_icon,
        } as any)
      );

      logger.log(`[SyncService] sync-initiate: Our manifest has ${ourManifest.digests.length} digests, ${ourMemberDigests.length} member digests`);
      logger.log(`[SyncService] sync-initiate: Sending manifest to ${message.inboxAddress.substring(0, 12)}`);

      // Send our manifest
      const manifestEnvelope = await secureChannel.SealSyncEnvelope(
        message.inboxAddress,
        hubKey.address!,
        {
          type: 'ed448',
          private_key: hexToSpreadArray(hubKey.privateKey),
          public_key: hexToSpreadArray(hubKey.publicKey),
        },
        {
          type: 'ed448',
          private_key: hexToSpreadArray(inboxKey.privateKey),
          public_key: hexToSpreadArray(inboxKey.publicKey),
        },
        JSON.stringify({
          type: 'control',
          message: {
            type: 'sync-manifest',
            inboxAddress: inboxKey.address,
            manifest: ourManifest,
            memberDigests: ourMemberDigests,
            peerIds,
          } as SyncManifestPayload,
        }),
        configKeyParam
      );
      outbounds.push(JSON.stringify({ type: 'sync', ...manifestEnvelope }));
      logger.log(`[SyncService] sync-initiate: Manifest envelope added to outbounds`);

      // Also build and send sync-delta with data they're missing (bidirectional sync)
      const messageDiff = computeMessageDiff(ourManifest, message.manifest);
      const memberDiff = computeMemberDiff(message.memberDigests || [], ourMemberDigests);
      const peerDiff = computePeerDiff(message.peerIds || [], peerIds);

      logger.log(`[SyncService] sync-initiate: messageDiff - extraIds: ${messageDiff.extraIds.length}, missingIds: ${messageDiff.missingIds.length}, outdatedIds: ${messageDiff.outdatedIds.length}`);
      logger.log(`[SyncService] sync-initiate: memberDiff - extraAddresses: ${memberDiff.extraAddresses.length}, missingAddresses: ${memberDiff.missingAddresses.length}`);
      logger.log(`[SyncService] sync-initiate: peerDiff - extraPeerIds: ${peerDiff.extraPeerIds.length}, missingPeerIds: ${peerDiff.missingPeerIds.length}`);

      const messageMap = new Map(messageSet.map((m) => [m.messageId, m]));
      const memberMap = new Map(memberSet.map((m) => [(m as any).user_address, m]));

      const messageDelta = buildMessageDelta(
        spaceId,
        channelId,
        messageDiff,
        messageMap as any,
        []
      );

      const memberDelta = buildMemberDelta(spaceId, memberDiff, memberMap as any);

      const peerMapDelta = {
        spaceId,
        added: peerDiff.extraPeerIds
          .map((id) => ourPeerEntries.get(id))
          .filter((e): e is PeerEntry => e !== undefined),
        updated: [] as PeerEntry[],
        removed: [] as number[],
      };

      // Send delta if we have data they don't
      const hasMessageDelta = messageDelta.newMessages.length > 0 || messageDelta.updatedMessages.length > 0;
      const hasMemberDelta = memberDelta.members.length > 0;
      const hasPeerDelta = peerMapDelta.added.length > 0;

      logger.log(`[SyncService] sync-initiate: Delta check - hasMessageDelta: ${hasMessageDelta} (new: ${messageDelta.newMessages.length}, updated: ${messageDelta.updatedMessages.length})`);
      logger.log(`[SyncService] sync-initiate: Delta check - hasMemberDelta: ${hasMemberDelta} (${memberDelta.members.length} members)`);
      logger.log(`[SyncService] sync-initiate: Delta check - hasPeerDelta: ${hasPeerDelta} (${peerMapDelta.added.length} peers)`);

      if (hasMessageDelta || hasMemberDelta || hasPeerDelta) {
        logger.log(`[SyncService] sync-initiate: Sending delta(s) to ${message.inboxAddress.substring(0, 12)}`);
        // Chunk and send message deltas
        const allMessages = [...messageDelta.newMessages, ...messageDelta.updatedMessages];
        if (allMessages.length > 0) {
          const chunks = chunkMessages(allMessages as any[]);
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const isLast = i === chunks.length - 1 && !hasMemberDelta && !hasPeerDelta;

            const deltaPayload: SyncDeltaPayload = {
              type: 'sync-delta',
              messageDelta: {
                spaceId,
                channelId,
                newMessages: chunk.filter((m) =>
                  messageDiff.extraIds.includes(m.messageId)
                ) as any[],
                updatedMessages: chunk.filter((m) =>
                  messageDiff.outdatedIds.includes(m.messageId)
                ) as any[],
                deletedMessageIds: isLast ? messageDelta.deletedMessageIds : [],
              },
              isFinal: isLast,
            };

            const envelope = await secureChannel.SealSyncEnvelope(
              message.inboxAddress,
              hubKey.address!,
              {
                type: 'ed448',
                private_key: hexToSpreadArray(hubKey.privateKey),
                public_key: hexToSpreadArray(hubKey.publicKey),
              },
              {
                type: 'ed448',
                private_key: hexToSpreadArray(inboxKey.privateKey),
                public_key: hexToSpreadArray(inboxKey.publicKey),
              },
              JSON.stringify({
                type: 'control',
                message: deltaPayload,
              }),
              configKeyParam
            );
            outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));
          }
        }

        // Send member and peer deltas
        if (hasMemberDelta || hasPeerDelta || allMessages.length === 0) {
          const finalPayload: SyncDeltaPayload = {
            type: 'sync-delta',
            memberDelta: hasMemberDelta ? memberDelta : undefined,
            peerMapDelta: hasPeerDelta ? peerMapDelta : undefined,
            isFinal: true,
          };

          const envelope = await secureChannel.SealSyncEnvelope(
            message.inboxAddress,
            hubKey.address!,
            {
              type: 'ed448',
              private_key: hexToSpreadArray(hubKey.privateKey),
              public_key: hexToSpreadArray(hubKey.publicKey),
            },
            {
              type: 'ed448',
              private_key: hexToSpreadArray(inboxKey.privateKey),
              public_key: hexToSpreadArray(inboxKey.publicKey),
            },
            JSON.stringify({
              type: 'control',
              message: finalPayload,
            }),
            configKeyParam
          );
          outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));
        }
      } else {
        logger.log(`[SyncService] sync-initiate: No delta to send (all data matches)`);
      }

      // Also send sync-peer-map with ratchet state for encryption key sync
      if (encryptionState.length > 0) {
        const ratchet = JSON.parse(JSON.parse(encryptionState[0].state).state);
        if (ratchet.id_peer_map && ratchet.peer_id_map) {
          logger.log(`[SyncService] sync-initiate: Sending sync-peer-map with ratchet state`);
          const peerMapPayload = {
            type: 'sync-peer-map',
            peerMap: {
              id_peer_map: ratchet.id_peer_map,
              peer_id_map: ratchet.peer_id_map,
              root_key: ratchet.root_key,
              dkg_ratchet: ratchet.dkg_ratchet,
              receiving_group_key: ratchet.receiving_group_key,
              receiving_chain_key: ratchet.receiving_chain_key,
              current_header_key: ratchet.current_header_key,
              next_header_key: ratchet.next_header_key,
              async_dkg_pubkey: ratchet.async_dkg_pubkey,
              threshold: ratchet.threshold,
            },
          };

          const peerMapEnvelope = await secureChannel.SealSyncEnvelope(
            message.inboxAddress,
            hubKey.address!,
            {
              type: 'ed448',
              private_key: hexToSpreadArray(hubKey.privateKey),
              public_key: hexToSpreadArray(hubKey.publicKey),
            },
            {
              type: 'ed448',
              private_key: hexToSpreadArray(inboxKey.privateKey),
              public_key: hexToSpreadArray(inboxKey.publicKey),
            },
            JSON.stringify({
              type: 'control',
              message: peerMapPayload,
            }),
            configKeyParam
          );
          outbounds.push(JSON.stringify({ type: 'sync', ...peerMapEnvelope }));
          logger.log(`[SyncService] sync-initiate: Sent sync-peer-map`);
        }
      }

      logger.log(`[SyncService] sync-initiate: Returning ${outbounds.length} outbound envelope(s)`);
      return outbounds;
    });
  }

  /**
   * NEW PROTOCOL: Handles sync-manifest.
   * Computes delta and sends sync-delta payloads.
   */
  async handleSyncManifest(
    spaceId: string,
    targetInbox: string,
    payload: SyncManifestPayload
  ): Promise<void> {
    logger.log(`[SyncService] handleSyncManifest called for space ${spaceId.substring(0, 12)}`);
    logger.log(`[SyncService] sync-manifest: Target inbox: ${targetInbox.substring(0, 12)}`);
    logger.log(`[SyncService] sync-manifest: Their manifest has ${payload.manifest.digests.length} digests, ${payload.memberDigests.length} member digests, ${payload.peerIds.length} peer IDs`);

    this.enqueueOutbound(async () => {
      const hubKey = await this.messageDB.getSpaceKey(spaceId, 'hub');
      const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');
      const configKey = await this.messageDB.getSpaceKey(spaceId, 'config');
      const configKeyParam = configKey
        ? {
            type: 'x448' as const,
            public_key: hexToSpreadArray(configKey.publicKey),
            private_key: hexToSpreadArray(configKey.privateKey),
          }
        : undefined;
      const messageSet = await this.messageDB.getAllSpaceMessages({ spaceId });
      const memberSet = await this.messageDB.getSpaceMembers(spaceId);
      const outbounds: string[] = [];

      logger.log(`[SyncService] sync-manifest: We have ${messageSet.length} messages, ${memberSet.length} members`);

      // Get our peer entries
      const encryptionState = await this.messageDB.getEncryptionStates({
        conversationId: spaceId + '/' + spaceId,
      });
      const ourPeerEntries = new Map<number, PeerEntry>();
      if (encryptionState.length > 0) {
        const ratchet = JSON.parse(JSON.parse(encryptionState[0].state).state);
        if (ratchet.id_peer_map) {
          for (const [idStr, pubKey] of Object.entries(ratchet.id_peer_map)) {
            const peerId = parseInt(idStr, 10);
            ourPeerEntries.set(peerId, { peerId, publicKey: pubKey as string });
          }
        }
      }

      // Build our manifest
      const space = await this.messageDB.getSpace(spaceId);
      const channelId = payload.manifest.channelId || space?.defaultChannelId || spaceId;
      const ourManifest = createManifest(spaceId, channelId, messageSet as any[]);
      const ourMemberDigests = memberSet.map((m) =>
        createMemberDigest({
          address: (m as any).user_address,
          inbox_address: (m as any).inbox_address,
          display_name: (m as any).display_name,
          profile_image: (m as any).user_icon,
        } as any)
      );
      const ourPeerIds = [...ourPeerEntries.keys()];

      // Compute diffs (ourManifest first - we want messages WE have that THEY don't)
      const messageDiff = computeMessageDiff(ourManifest, payload.manifest);
      const memberDiff = computeMemberDiff(payload.memberDigests, ourMemberDigests);
      const peerDiff = computePeerDiff(payload.peerIds, ourPeerIds);

      logger.log(`[SyncService] sync-manifest: Our manifest has ${ourManifest.digests.length} digests`);
      logger.log(`[SyncService] sync-manifest: messageDiff - extraIds: ${messageDiff.extraIds.length}, missingIds: ${messageDiff.missingIds.length}, outdatedIds: ${messageDiff.outdatedIds.length}`);
      logger.log(`[SyncService] sync-manifest: memberDiff - extraAddresses: ${memberDiff.extraAddresses.length}, missingAddresses: ${memberDiff.missingAddresses.length}`);
      logger.log(`[SyncService] sync-manifest: peerDiff - extraPeerIds: ${peerDiff.extraPeerIds.length}, missingPeerIds: ${peerDiff.missingPeerIds.length}`);

      // Build deltas
      const messageMap = new Map(messageSet.map((m) => [m.messageId, m]));
      const memberMap = new Map(memberSet.map((m) => [(m as any).user_address, m]));

      const messageDelta = buildMessageDelta(
        spaceId,
        channelId,
        messageDiff,
        messageMap as any,
        []
      );

      const memberDelta = buildMemberDelta(spaceId, memberDiff, memberMap as any);

      // Build peer map delta
      const peerMapDelta = {
        spaceId,
        added: peerDiff.extraPeerIds
          .map((id) => ourPeerEntries.get(id))
          .filter((e): e is PeerEntry => e !== undefined),
        updated: [] as PeerEntry[],
        removed: [] as number[],
      };

      // Chunk and send message deltas
      const allMessages = [...messageDelta.newMessages, ...messageDelta.updatedMessages];
      logger.log(`[SyncService] sync-manifest: Delta check - newMessages: ${messageDelta.newMessages.length}, updatedMessages: ${messageDelta.updatedMessages.length}, allMessages: ${allMessages.length}`);
      logger.log(`[SyncService] sync-manifest: Delta check - members: ${memberDelta.members.length}, peers: ${peerMapDelta.added.length}`);

      if (allMessages.length > 0) {
        const chunks = chunkMessages(allMessages as any[]);
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const isLast = i === chunks.length - 1;

          const deltaPayload: SyncDeltaPayload = {
            type: 'sync-delta',
            messageDelta: {
              spaceId,
              channelId,
              newMessages: chunk.filter((m) =>
                messageDiff.extraIds.includes(m.messageId)
              ) as any[],
              updatedMessages: chunk.filter((m) =>
                messageDiff.outdatedIds.includes(m.messageId)
              ) as any[],
              deletedMessageIds: isLast ? messageDelta.deletedMessageIds : [],
            },
            isFinal: false,
          };

          const envelope = await secureChannel.SealSyncEnvelope(
            targetInbox,
            hubKey.address!,
            {
              type: 'ed448',
              private_key: hexToSpreadArray(hubKey.privateKey),
              public_key: hexToSpreadArray(hubKey.publicKey),
            },
            {
              type: 'ed448',
              private_key: hexToSpreadArray(inboxKey.privateKey),
              public_key: hexToSpreadArray(inboxKey.publicKey),
            },
            JSON.stringify({
              type: 'control',
              message: deltaPayload,
            }),
            configKeyParam
          );
          outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));
        }
      }

      // Send member and peer deltas
      if (
        memberDelta.members.length > 0 ||
        peerMapDelta.added.length > 0 ||
        allMessages.length === 0
      ) {
        const finalPayload: SyncDeltaPayload = {
          type: 'sync-delta',
          memberDelta: memberDelta.members.length > 0 ? memberDelta : undefined,
          peerMapDelta: peerMapDelta.added.length > 0 ? peerMapDelta : undefined,
          isFinal: true,
        };

        const envelope = await secureChannel.SealSyncEnvelope(
          targetInbox,
          hubKey.address!,
          {
            type: 'ed448',
            private_key: hexToSpreadArray(hubKey.privateKey),
            public_key: hexToSpreadArray(hubKey.publicKey),
          },
          {
            type: 'ed448',
            private_key: hexToSpreadArray(inboxKey.privateKey),
            public_key: hexToSpreadArray(inboxKey.publicKey),
          },
          JSON.stringify({
            type: 'control',
            message: finalPayload,
          }),
          configKeyParam
        );
        outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));
      } else if (outbounds.length > 0) {
        // Mark last message chunk as final - need to re-seal with updated payload
        // For simplicity, just send an empty final
        const finalPayload: SyncDeltaPayload = {
          type: 'sync-delta',
          isFinal: true,
        };

        const envelope = await secureChannel.SealSyncEnvelope(
          targetInbox,
          hubKey.address!,
          {
            type: 'ed448',
            private_key: hexToSpreadArray(hubKey.privateKey),
            public_key: hexToSpreadArray(hubKey.publicKey),
          },
          {
            type: 'ed448',
            private_key: hexToSpreadArray(inboxKey.privateKey),
            public_key: hexToSpreadArray(inboxKey.publicKey),
          },
          JSON.stringify({
            type: 'control',
            message: finalPayload,
          }),
          configKeyParam
        );
        outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));
      }

      // Also send sync-peer-map with ratchet state for encryption key sync
      if (encryptionState.length > 0) {
        const ratchet = JSON.parse(JSON.parse(encryptionState[0].state).state);
        if (ratchet.id_peer_map && ratchet.peer_id_map) {
          logger.log(`[SyncService] sync-manifest: Sending sync-peer-map with ratchet state`);
          const peerMapPayload = {
            type: 'sync-peer-map',
            peerMap: {
              id_peer_map: ratchet.id_peer_map,
              peer_id_map: ratchet.peer_id_map,
              root_key: ratchet.root_key,
              dkg_ratchet: ratchet.dkg_ratchet,
              receiving_group_key: ratchet.receiving_group_key,
              receiving_chain_key: ratchet.receiving_chain_key,
              current_header_key: ratchet.current_header_key,
              next_header_key: ratchet.next_header_key,
              async_dkg_pubkey: ratchet.async_dkg_pubkey,
              threshold: ratchet.threshold,
            },
          };

          const peerMapEnvelope = await secureChannel.SealSyncEnvelope(
            targetInbox,
            hubKey.address!,
            {
              type: 'ed448',
              private_key: hexToSpreadArray(hubKey.privateKey),
              public_key: hexToSpreadArray(hubKey.publicKey),
            },
            {
              type: 'ed448',
              private_key: hexToSpreadArray(inboxKey.privateKey),
              public_key: hexToSpreadArray(inboxKey.publicKey),
            },
            JSON.stringify({
              type: 'control',
              message: peerMapPayload,
            }),
            configKeyParam
          );
          outbounds.push(JSON.stringify({ type: 'sync', ...peerMapEnvelope }));
          logger.log(`[SyncService] sync-manifest: Sent sync-peer-map`);
        }
      }

      logger.log(`[SyncService] sync-manifest: Returning ${outbounds.length} outbound envelope(s)`);
      return outbounds;
    });
  }
}
