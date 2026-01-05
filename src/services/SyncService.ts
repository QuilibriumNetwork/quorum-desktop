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
  SyncRequestPayload,
  SyncInfoPayload,
  MemberDigest,
  createMemberDigest,
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
   * Uses SharedSyncService for candidate selection and payload building.
   */
  async initiateSync(spaceId: string): Promise<void> {
    logger.log(`[SyncService] initiateSync called for space ${spaceId.substring(0, 12)}`);

    // Transfer candidates from local syncInfo to SharedSyncService
    if (this.syncInfo.current[spaceId]?.candidates) {
      for (const candidate of this.syncInfo.current[spaceId].candidates) {
        if (candidate.inboxAddress && candidate.summary) {
          this.sharedSyncService.addCandidate(spaceId, {
            inboxAddress: candidate.inboxAddress,
            summary: candidate.summary,
          });
        }
      }
    }

    const space = await this.messageDB.getSpace(spaceId);
    const channelId = space?.defaultChannelId || spaceId;
    const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');

    // Get peer IDs
    const encryptionState = await this.messageDB.getEncryptionStates({
      conversationId: spaceId + '/' + spaceId,
    });
    let peerIds: number[] = [];
    if (encryptionState.length > 0) {
      const ratchet = JSON.parse(JSON.parse(encryptionState[0].state).state);
      if (ratchet.id_peer_map) {
        peerIds = Object.keys(ratchet.id_peer_map).map(Number);
      }
    }

    // Build sync-initiate using SharedSyncService
    const initiateResult = await this.sharedSyncService.buildSyncInitiate(
      spaceId,
      channelId,
      inboxKey.address!,
      peerIds
    );

    if (!initiateResult) {
      logger.log(`[SyncService] initiateSync: No suitable candidates`);
      return;
    }

    logger.log(`[SyncService] initiateSync: Syncing with: ${initiateResult.target.substring(0, 12)}`);

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

      const envelope = await secureChannel.SealSyncEnvelope(
        initiateResult.target,
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
          message: initiateResult.payload,
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
   * Uses SharedSyncService for O(1) cached payload generation.
   */
  async requestSync(spaceId: string): Promise<void> {
    logger.log(`[SyncService] requestSync called for space ${spaceId}`);
    try {
      const space = await this.messageDB.getSpace(spaceId);
      const channelId = space?.defaultChannelId || spaceId;
      const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');

      // Build sync request using SharedSyncService (uses cached XOR-based hash)
      const syncRequest = await this.sharedSyncService.buildSyncRequest(
        spaceId,
        channelId,
        inboxKey.address!
      );

      // Schedule sync initiation
      this.sharedSyncService.scheduleSyncInitiation(
        spaceId,
        () => this.initiateSync(spaceId),
        30000
      );

      this.enqueueOutbound(async () => {
        const hubKey = await this.messageDB.getSpaceKey(spaceId, 'hub');
        const configKey = await this.messageDB.getSpaceKey(spaceId, 'config');

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
              ...syncRequest,
              // Legacy fields for backwards compatibility
              memberCount: syncRequest.summary.memberCount,
              messageCount: syncRequest.summary.messageCount,
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

        // Track in local syncInfo for legacy compatibility
        this.syncInfo.current[spaceId] = {
          expiry: syncRequest.expiry,
          candidates: [],
          invokable: undefined, // Handled by SharedSyncService
        };

        logger.log(`[SyncService] requestSync: Sending sync-request for space ${spaceId}`);
        return [JSON.stringify({ type: 'group', ...envelope })];
      });
    } catch (error) {
      logger.error(`[SyncService] requestSync failed for space ${spaceId}:`, error);
    }
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
   * Uses SharedSyncService for O(1) cached comparison.
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

      if (!inboxKey || inboxKey.address === inboxAddress) {
        logger.log(`[SyncService] informSyncData: Skipping - either no inboxKey or target is ourselves`);
        return;
      }

      const space = await this.messageDB.getSpace(spaceId);
      const channelId = space?.defaultChannelId || spaceId;

      // Build a summary for legacy protocol if theirSummary not provided
      const effectiveSummary: SyncSummary = theirSummary || {
        messageCount,
        memberCount,
        newestMessageTimestamp: 0,
        oldestMessageTimestamp: 0,
        manifestHash: '', // Empty hash means legacy - will trigger diff check
      };

      // Use SharedSyncService to check if we have data to share
      const syncInfo = await this.sharedSyncService.buildSyncInfo(
        spaceId,
        channelId,
        inboxKey.address!,
        effectiveSummary
      );

      if (!syncInfo) {
        logger.log(`[SyncService] informSyncData: SharedSyncService says we have nothing to offer`);
        return;
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
              ...syncInfo,
              // Legacy fields for backwards compatibility
              messageCount: syncInfo.summary.messageCount,
              memberCount: syncInfo.summary.memberCount,
            },
          }),
          configKeyParam
        );

        logger.log(`[SyncService] informSyncData: Queued sync-info response`);
        return [JSON.stringify({ type: 'sync', ...envelope })];
      });
    } catch (error) {
      console.error(`[SyncService] informSyncData error:`, error);
    }
  }

  /**
   * NEW PROTOCOL: Handles sync-initiate with manifest.
   * Responds with our manifest AND sync-delta (bidirectional sync).
   * Uses SharedSyncService for O(1) cached payload generation.
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
      await this.directSync(spaceId, message as any);
      return;
    }

    logger.log(`[SyncService] sync-initiate: Their manifest has ${message.manifest.digests.length} digests`);

    const space = await this.messageDB.getSpace(spaceId);
    const channelId = space?.defaultChannelId || spaceId;

    // Get peer entries for delta building
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

    // Build manifest using SharedSyncService
    const manifestPayload = await this.sharedSyncService.buildSyncManifest(
      spaceId,
      channelId,
      peerIds,
      (await this.messageDB.getSpaceKey(spaceId, 'inbox')).address!
    );

    logger.log(`[SyncService] sync-initiate: Our manifest has ${manifestPayload.manifest.digests.length} digests`);

    // Build delta using SharedSyncService
    const deltaPayloads = await this.sharedSyncService.buildSyncDelta(
      spaceId,
      channelId,
      message.manifest,
      message.memberDigests || [],
      message.peerIds || [],
      ourPeerEntries
    );

    logger.log(`[SyncService] sync-initiate: Built ${deltaPayloads.length} delta payload(s)`);

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
      const outbounds: string[] = [];

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
          message: manifestPayload,
        }),
        configKeyParam
      );
      outbounds.push(JSON.stringify({ type: 'sync', ...manifestEnvelope }));
      logger.log(`[SyncService] sync-initiate: Manifest envelope added to outbounds`);

      // Send delta payloads
      for (const deltaPayload of deltaPayloads) {
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

      // Send sync-peer-map with ratchet state for encryption key sync
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
   * Uses SharedSyncService for O(1) cached payload generation.
   */
  async handleSyncManifest(
    spaceId: string,
    targetInbox: string,
    payload: SyncManifestPayload
  ): Promise<void> {
    logger.log(`[SyncService] handleSyncManifest called for space ${spaceId.substring(0, 12)}`);
    logger.log(`[SyncService] sync-manifest: Target inbox: ${targetInbox.substring(0, 12)}`);
    logger.log(`[SyncService] sync-manifest: Their manifest has ${payload.manifest.digests.length} digests, ${payload.memberDigests.length} member digests, ${payload.peerIds.length} peer IDs`);

    const space = await this.messageDB.getSpace(spaceId);
    const channelId = payload.manifest.channelId || space?.defaultChannelId || spaceId;

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

    // Build delta using SharedSyncService
    const deltaPayloads = await this.sharedSyncService.buildSyncDelta(
      spaceId,
      channelId,
      payload.manifest,
      payload.memberDigests,
      payload.peerIds,
      ourPeerEntries
    );

    logger.log(`[SyncService] sync-manifest: Built ${deltaPayloads.length} delta payload(s)`);

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
      const outbounds: string[] = [];

      // Send delta payloads
      for (const deltaPayload of deltaPayloads) {
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

      // Send sync-peer-map with ratchet state for encryption key sync
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

  /**
   * Expose the shared sync service for cache updates
   */
  getSharedSyncService(): SharedSyncService {
    return this.sharedSyncService;
  }

  /**
   * Update sync cache with a new/updated message (O(1) operation)
   * Note: Method may not exist in older versions of quorum-shared
   */
  updateCacheWithMessage(spaceId: string, channelId: string, message: Message): void {
    (this.sharedSyncService as any).updateCacheWithMessage?.(spaceId, channelId, message);
  }

  /**
   * Update sync cache with a new/updated member (O(1) operation)
   * Note: Method may not exist in older versions of quorum-shared
   */
  updateCacheWithMember(spaceId: string, channelId: string, member: any): void {
    (this.sharedSyncService as any).updateCacheWithMember?.(spaceId, channelId, member);
  }

  /**
   * Remove a message from the sync cache (O(1) operation)
   * Note: Method may not exist in older versions of quorum-shared
   */
  removeCacheMessage(spaceId: string, channelId: string, messageId: string): void {
    (this.sharedSyncService as any).removeCacheMessage?.(spaceId, channelId, messageId);
  }
}
