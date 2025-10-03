// SyncService.ts - Extracted from MessageDB.tsx with ZERO modifications
// This service handles space synchronization operations

import { MessageDB } from '../db/messages';
import { channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import { Message } from '../api/quorumApi';
import { hexToSpreadArray } from '../utils/crypto';

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
  }

  // EXACT COPY: synchronizeAll from MessageDB.tsx line 359-513
  async synchronizeAll(spaceId: string, inboxAddress: string): Promise<void> {
    try {
      const ownerKey = await this.messageDB.getSpaceKey(spaceId, 'owner');
      if (ownerKey) {
        this.enqueueOutbound(async () => {
          const memberSet = await this.messageDB.getSpaceMembers(spaceId);
          const messageSet = await this.messageDB.getAllSpaceMessages({ spaceId });
          const hubKey = await this.messageDB.getSpaceKey(spaceId, 'hub');
          let outbounds: string[] = [];
          const encryptionState = await this.messageDB.getEncryptionStates({
            conversationId: spaceId + '/' + spaceId,
          });
          const ratchet = JSON.parse(
            JSON.parse(encryptionState[0].state).state
          );
          const id_peer_map = ratchet.id_peer_map;
          const peer_id_map = ratchet.peer_id_map;
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
                },
              },
            })
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
              })
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
              })
            );
            outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));
          }
          return outbounds;
        });
      }
    } catch {}
  }

  // EXACT COPY: initiateSync from MessageDB.tsx line 515-577
  async initiateSync(spaceId: string): Promise<void> {
    if (
      !this.syncInfo.current[spaceId] ||
      !this.syncInfo.current[spaceId].candidates.length
    ) {
      return;
    }

    const memberSet = await this.messageDB.getSpaceMembers(spaceId);
    const messageSet = await this.messageDB.getAllSpaceMessages({ spaceId });

    let candidates = this.syncInfo.current[spaceId].candidates;

    candidates = candidates
      .filter((c) => c.messageCount > messageSet.length)
      .sort((a, b) => b.messageCount - a.messageCount);

    if (candidates.length == 0) {
      return;
    }

    this.enqueueOutbound(async () => {
      const hubKey = await this.messageDB.getSpaceKey(spaceId, 'hub');
      const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');

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
        })
      );
      return [JSON.stringify({ type: 'sync', ...envelope })];
    });
  }

  // EXACT COPY: directSync from MessageDB.tsx line 579-747
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
      let outbounds: string[] = [];
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
            },
          },
        })
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
          })
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
          })
        );
        outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));
      }
      return outbounds;
    });
  }

  // EXACT COPY: requestSync from MessageDB.tsx line 749-787
  async requestSync(spaceId: string): Promise<void> {
    try {
      this.enqueueOutbound(async () => {
        const hubKey = await this.messageDB.getSpaceKey(spaceId, 'hub');
        const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');
        const expiry = Date.now() + 30000;
        const memberSet = await this.messageDB.getSpaceMembers(spaceId);
        const messageSet = await this.messageDB.getAllSpaceMessages({ spaceId });
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
              memberCount: memberSet.length,
              messageCount: messageSet.length,
            },
          })
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

  // EXACT COPY: sendVerifyKickedStatuses from MessageDB.tsx line 789-827
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

  // EXACT COPY: informSyncData from MessageDB.tsx line 829-891
  async informSyncData(
    spaceId: string,
    inboxAddress: string,
    messageCount: number,
    memberCount: number
  ): Promise<void> {
    try {
      const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');
      if (inboxKey && inboxKey.address != inboxAddress) {
        const memberSet = await this.messageDB.getSpaceMembers(spaceId);
        const messageSet = await this.messageDB.getAllSpaceMessages({ spaceId });
        if (
          messageCount >= messageSet.length &&
          memberCount >= memberSet.length
        ) {
          return;
        }

        this.enqueueOutbound(async () => {
          const hubKey = await this.messageDB.getSpaceKey(spaceId, 'hub');
          let outbounds: string[] = [];

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
                messageCount: messageSet.length,
                memberCount: memberSet.length,
              },
            })
          );
          outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));

          return outbounds;
        });
      }
    } catch {}
  }
}
