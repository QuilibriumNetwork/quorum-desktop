import React, {
  createContext,
  FC,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  EncryptedMessage,
  EncryptionState,
  MessageDB,
  UserConfig,
} from '../../db/messages';
import { MessageService } from '../../services/MessageService';
import { EncryptionService } from '../../services/EncryptionService';
import { SpaceService } from '../../services/SpaceService';
import { SyncService } from '../../services/SyncService';
import { ConfigService } from '../../services/ConfigService';
import {
  buildConversationsKey,
  buildMessagesKey,
  buildSpaceKey,
  buildSpaceMembersKey,
  buildSpacesKey,
} from '../../hooks';
import { buildConversationKey } from '../../hooks/queries/conversation/buildConversationKey';
import {
  InfiniteData,
  QueryClient,
  useQueryClient,
} from '@tanstack/react-query';
import { getInviteUrlBase, parseInviteParams } from '@/utils/inviteDomain';
import {
  channel_raw as ch,
  channel as secureChannel,
} from '@quilibrium/quilibrium-js-sdk-channels';
import {
  Conversation,
  EmbedMessage,
  JoinMessage,
  KickMessage,
  LeaveMessage,
  Message,
  PostMessage,
  ReactionMessage,
  RemoveMessage,
  RemoveReactionMessage,
  Space,
  StickerMessage,
  UpdateProfileMessage,
} from '../../api/quorumApi';
import { useQuorumApiClient } from './QuorumApiContext';
import { QuorumApiClient, isQuorumApiError } from '../../api/baseTypes';
import { useWebSocket } from './WebsocketProvider';
import { useInvalidateConversation } from '../../hooks/queries/conversation/useInvalidateConversation';
import { useNavigate } from 'react-router';
// Use platform-specific crypto utilities
// Web: uses multiformats directly
// Native: uses React Native compatible implementations
import { sha256, base58btc } from '../../utils/crypto';
import { buildConfigKey } from '../../hooks/queries/config/buildConfigKey';
import { t } from '@lingui/core/macro';
import { Callout } from '../primitives';
import { DefaultImages, getDefaultUserConfig } from '../../utils';
import { canKickUser } from '../../utils/permissions';

type MessageDBContextValue = {
  messageDB: MessageDB;
  keyset: {
    userKeyset: secureChannel.UserKeyset;
    deviceKeyset: secureChannel.DeviceKeyset;
  };
  setKeyset: React.Dispatch<
    React.SetStateAction<{
      userKeyset: secureChannel.UserKeyset;
      deviceKeyset: secureChannel.DeviceKeyset;
    }>
  >;
  deleteEncryptionStates: (args: { conversationId: string }) => Promise<void>;
  submitMessage: (
    address: string,
    pendingMessage: string | object,
    self: secureChannel.UserRegistration,
    counterparty: secureChannel.UserRegistration,
    queryClient: QueryClient,
    currentPasskeyInfo: {
      credentialId: string;
      address: string;
      publicKey: string;
      displayName?: string;
      pfpUrl?: string;
      completedOnboarding: boolean;
    },
    keyset: {
      userKeyset: secureChannel.UserKeyset;
      deviceKeyset: secureChannel.DeviceKeyset;
    },
    inReplyTo?: string
  ) => Promise<void>;
  createSpace: (
    spaceName: string,
    spaceIcon: string,
    keyset: {
      userKeyset: secureChannel.UserKeyset;
      deviceKeyset: secureChannel.DeviceKeyset;
    },
    registration: secureChannel.UserRegistration,
    isRepudiable: boolean,
    isPublic: boolean,
    userIcon: string,
    userDisplayName: string
  ) => Promise<{ spaceId: string; channelId: string }>;
  updateSpace: (space: Space) => Promise<void>;
  createChannel: (spaceId: string) => Promise<string>;
  submitChannelMessage: (
    spaceId: string,
    channelId: string,
    pendingMessage: string | object,
    queryClient: QueryClient,
    currentPasskeyInfo: {
      credentialId: string;
      address: string;
      publicKey: string;
      displayName?: string;
      pfpUrl?: string;
      completedOnboarding: boolean;
    },
    inReplyTo?: string,
    skipSigning?: boolean
  ) => Promise<void>;
  getConfig: ({
    address,
    userKey,
  }: {
    address: string;
    userKey: secureChannel.UserKeyset;
  }) => Promise<UserConfig>;
  saveConfig: ({
    config,
    keyset,
  }: {
    config: UserConfig;
    keyset: {
      userKeyset: secureChannel.UserKeyset;
      deviceKeyset: secureChannel.DeviceKeyset;
    };
  }) => Promise<void>;
  setSelfAddress: React.Dispatch<React.SetStateAction<string>>;
  ensureKeyForSpace: (user_address: string, space: Space) => Promise<string>;
  sendInviteToUser: (
    address: string,
    spaceId: string,
    currentPasskeyInfo: {
      credentialId: string;
      address: string;
      publicKey: string;
      displayName?: string;
      pfpUrl?: string;
      completedOnboarding: boolean;
    }
  ) => Promise<void>;
  generateNewInviteLink: (
    spaceId: string,
    user_keyset: secureChannel.UserKeyset,
    device_keyset: secureChannel.DeviceKeyset,
    registration: secureChannel.UserRegistration
  ) => Promise<void>;
  processInviteLink: (inviteLink: string) => Promise<Space>;
  joinInviteLink: (
    inviteLink: string,
    keyset: {
      userKeyset: secureChannel.UserKeyset;
      deviceKeyset: secureChannel.DeviceKeyset;
    },
    currentPasskeyInfo: {
      credentialId: string;
      address: string;
      publicKey: string;
      displayName?: string;
      pfpUrl?: string;
      completedOnboarding: boolean;
    }
  ) => Promise<{ spaceId: string; channelId: string } | undefined>;
  deleteSpace: (spaceId: string) => Promise<void>;
  kickUser: (
    spaceId: string,
    userAddress: string,
    user_keyset: secureChannel.UserKeyset,
    device_keyset: secureChannel.DeviceKeyset,
    registration: secureChannel.UserRegistration
  ) => Promise<void>;
  updateUserProfile: (
    displayName: string,
    userIcon: string,
    currentPasskeyInfo: {
      credentialId: string;
      address: string;
      publicKey: string;
      displayName?: string;
      pfpUrl?: string;
      completedOnboarding: boolean;
    }
  ) => Promise<void>;
  requestSync: (spaceId: string) => Promise<void>;
  sendVerifyKickedStatuses: (spaceId: string) => Promise<number>;
  deleteConversation: (
    conversationId: string,
    currentPasskeyInfo: {
      credentialId: string;
      address: string;
      publicKey: string;
      displayName?: string;
      pfpUrl?: string;
      completedOnboarding: boolean;
    }
  ) => Promise<void>;
};

type MessageDBContextProps = {
  children: ReactNode;
};

const MessageDBProvider: FC<MessageDBContextProps> = ({ children }) => {
  const messageDB = useMemo(() => {
    return new MessageDB();
  }, []);
  const queryClient = useQueryClient();
  const { apiClient } = useQuorumApiClient();
  const { setMessageHandler, enqueueOutbound, setResubscribe } = useWebSocket();
  const invalidateConversation = useInvalidateConversation();
  const navigate = useNavigate();

  const [selfAddress, setSelfAddress] = useState<string>(
    null as unknown as string
  );
  const [keyset, setKeyset] = useState<{
    userKeyset: secureChannel.UserKeyset;
    deviceKeyset: secureChannel.DeviceKeyset;
  }>(
    {} as unknown as {
      userKeyset: secureChannel.UserKeyset;
      deviceKeyset: secureChannel.DeviceKeyset;
    }
  );
  const spaceInfo = useRef<{
    [spaceId: string]: secureChannel.SpaceRegistration;
  }>({});
  const syncInfo = useRef<{
    [spaceId: string]: {
      expiry: number;
      candidates: any[];
      invokable: NodeJS.Timeout | undefined;
    };
  }>({});

  // saveMessage will be defined after messageService instantiation
  // deleteEncryptionStates will be defined after encryptionService instantiation
  // addMessage will be defined after messageService instantiation

  const deleteInboxMessages = async (
    inboxKeyset: secureChannel.InboxKeyset,
    timestamps: number[],
    apiClient: QuorumApiClient
  ) => {
    let del = {
      inbox_address: inboxKeyset.inbox_address,
      timestamps: timestamps,
      inbox_public_key: Buffer.from(
        new Uint8Array(inboxKeyset.inbox_key.public_key)
      ).toString('hex'),
      inbox_signature: Buffer.from(
        JSON.parse(
          ch.js_sign_ed448(
            Buffer.from(
              new Uint8Array(inboxKeyset.inbox_key.private_key)
            ).toString('base64'),
            Buffer.from(
              inboxKeyset.inbox_address + timestamps.map((t) => `${t}`).join('')
            ).toString('base64')
          )
        ),
        'base64'
      ).toString('hex'),
    } as secureChannel.DeleteMessages;
    await apiClient.deleteInbox(del);
  };

  const addOrUpdateConversation = (
    queryClient: QueryClient,
    address: string,
    timestamp: number,
    lastReadTimestamp: number,
    updatedUserProfile?: Partial<secureChannel.UserProfile>
  ) => {
    const conversationId = address + '/' + address;
    queryClient.setQueryData(
      buildConversationsKey({ type: 'direct' }),
      (oldData: InfiniteData<any>) => {
        if (!oldData?.pages) return oldData;

        return {
          pageParams: oldData.pageParams,
          pages: oldData.pages.map((page, index) => {
            if (index === 0) {
              return {
                ...page,
                conversations: [
                  ...page.conversations.filter(
                    (c: Conversation) => c.conversationId !== conversationId
                  ),
                  (() => {
                    // Find existing conversation to preserve its data (especially isRepudiable)
                    const existingConv = page.conversations.find(
                      (c: Conversation) => c.conversationId === conversationId
                    );
                    return {
                      ...existingConv, // Preserve all existing fields including isRepudiable
                      conversationId,
                      address: address,
                      icon: updatedUserProfile?.user_icon ?? existingConv?.icon,
                      displayName:
                        updatedUserProfile?.display_name ??
                        existingConv?.displayName,
                      type: 'direct' as const,
                      timestamp: timestamp,
                      lastReadTimestamp: lastReadTimestamp,
                      // Explicitly preserve isRepudiable to ensure it's not lost
                      isRepudiable: existingConv?.isRepudiable,
                    };
                  })(),
                ],
                nextCursor: page.nextCursor,
                prevCursor: page.prevCursor,
              };
            } else {
              return {
                ...page,
                conversations: [
                  ...page.conversations.filter(
                    (c: Conversation) => c.conversationId !== conversationId
                  ),
                ],
                nextCursor: page.nextCursor,
                prevCursor: page.prevCursor,
              };
            }
          }),
        };
      }
    );
    invalidateConversation({ conversationId });
  };

  // MessageService will be instantiated after all dependencies are declared
  // handleNewMessage will be defined after messageService instantiation
  // OLD SYNC FUNCTIONS REMOVED - Now handled by SyncService
  // synchronizeAll, initiateSync, directSync, requestSync, sendVerifyKickedStatuses, informSyncData
  // All moved to SyncService.ts and delegated below (after service instantiation)

  const updateUserProfile = React.useCallback(
    async (
      displayName: string,
      userIcon: string,
      currentPasskeyInfo: {
        credentialId: string;
        address: string;
        publicKey: string;
        displayName?: string;
        pfpUrl?: string;
        completedOnboarding: boolean;
      }
    ) => {
      const spaces = await messageDB.getSpaces();
      for (const space of spaces) {
        submitChannelMessage(
          space.spaceId,
          space.defaultChannelId,
          {
            type: 'update-profile',
            displayName,
            userIcon,
            senderId: currentPasskeyInfo.address,
          } as UpdateProfileMessage,
          queryClient,
          currentPasskeyInfo
        );
      }
    },
    []
  );

  // Ensure selfAddress is derived when key material is available
  useEffect(() => {
    (async () => {
      try {
        if (
          !selfAddress &&
          keyset?.userKeyset?.user_key?.public_key &&
          (keyset as any) // guard access
        ) {
          const sh = await sha256.digest(
            Buffer.from(new Uint8Array(keyset.userKeyset.user_key.public_key))
          );
          setSelfAddress(base58btc.baseEncode(sh.bytes));
        }
      } catch {}
    })();
  }, [selfAddress, keyset]);

  // submitMessage will be defined after messageService instantiation

  const int64ToBytes = (num: number) => {
    const arr = new Uint8Array(8);
    const view = new DataView(arr.buffer);
    view.setBigInt64(0, BigInt(num), false);
    return arr;
  };





  // ensureKeyForSpace moved to after EncryptionService instantiation

  const constructInviteLink = React.useCallback(async (spaceId: string) => {
    const space = await messageDB.getSpace(spaceId);
    if (space?.inviteUrl) {
      return space.inviteUrl;
    }

    const config_key = await messageDB.getSpaceKey(spaceId, 'config');
    const hub_key = await messageDB.getSpaceKey(spaceId, 'hub');
    let response = await messageDB.getEncryptionStates({
      conversationId: spaceId + '/' + spaceId,
    });
    const sets = response.map((e) => JSON.parse(e.state));
    const state = sets[0].template;
    const ratchet = JSON.parse(state.dkg_ratchet);
    ratchet.id = 10001 - sets[0].evals.length;
    state.root_key = JSON.parse(sets[0].state).root_key;
    state.dkg_ratchet = JSON.stringify(ratchet);
    const template = Buffer.from(JSON.stringify(state), 'utf-8').toString(
      'hex'
    );
    const index_secret_raw = sets[0].evals.shift();
    const secret = Buffer.from(new Uint8Array(index_secret_raw)).toString(
      'hex'
    );
    await messageDB.saveEncryptionState(
      { ...response[0], state: JSON.stringify(sets[0]) },
      true
    );
    const link = `${getInviteUrlBase(false)}#spaceId=${spaceId}&configKey=${config_key.privateKey}&template=${template}&secret=${secret}&hubKey=${hub_key.privateKey}`;
    return link;
  }, []);

  const sendInviteToUser = React.useCallback(
    async (
      address: string,
      spaceId: string,
      currentPasskeyInfo: {
        credentialId: string;
        address: string;
        publicKey: string;
        displayName?: string;
        pfpUrl?: string;
        completedOnboarding: boolean;
      }
    ) => {
      const link = await constructInviteLink(spaceId);
      const self = await apiClient.getUser(currentPasskeyInfo.address);
      const recipient = await apiClient.getUser(address);
      await submitMessage(
        address,
        link,
        self.data,
        recipient.data,
        queryClient,
        currentPasskeyInfo,
        keyset
      );
    },
    [keyset]
  );

  const generateNewInviteLink = React.useCallback(
    async (
      spaceId: string,
      user_keyset: secureChannel.UserKeyset,
      device_keyset: secureChannel.DeviceKeyset,
      registration: secureChannel.UserRegistration
    ) => {
      try {
        const space = await messageDB.getSpace(spaceId);
        const spaceKey = await messageDB.getSpaceKey(spaceId, spaceId);
        const ownerKey = await messageDB.getSpaceKey(spaceId, 'owner');
        const hubKey = await messageDB.getSpaceKey(spaceId, 'hub');
        const cp = ch.js_generate_x448();
        const configPair = JSON.parse(cp);

        await messageDB.saveSpaceKey({
          spaceId: spaceId,
          keyId: 'config',
          publicKey: Buffer.from(
            new Uint8Array(configPair.public_key)
          ).toString('hex'),
          privateKey: Buffer.from(
            new Uint8Array(configPair.private_key)
          ).toString('hex'),
        });

        const ts = Date.now();
        const ownerPayload = Buffer.from(
          new Uint8Array([
            ...new Uint8Array(Buffer.from(spaceKey.publicKey, 'hex')),
            ...configPair.public_key,
            ...new Uint8Array(Buffer.from(ownerKey.publicKey, 'hex')),
            ...int64ToBytes(ts),
          ])
        ).toString('base64');
        const spacePayload = Buffer.from(
          new Uint8Array([
            ...new Uint8Array(Buffer.from(spaceKey.publicKey, 'hex')),
            ...configPair.public_key,
            ...new Uint8Array(Buffer.from(ownerKey.publicKey, 'hex')),
            ...int64ToBytes(ts),
          ])
        ).toString('base64');
        const spaceSignature = JSON.parse(
          ch.js_sign_ed448(
            Buffer.from(spaceKey.privateKey, 'hex').toString('base64'),
            spacePayload
          )
        );
        const ownerSignature = JSON.parse(
          ch.js_sign_ed448(
            Buffer.from(ownerKey.privateKey, 'hex').toString('base64'),
            ownerPayload
          )
        );
        spaceInfo.current[spaceId] = {
          space_address: spaceId,
          space_public_key: spaceKey.publicKey,
          space_signature: Buffer.from(spaceSignature, 'base64').toString(
            'hex'
          ),
          config_public_key: Buffer.from(
            new Uint8Array(configPair.public_key)
          ).toString('hex'),
          owner_public_keys: [ownerKey.publicKey],
          owner_signatures: [
            Buffer.from(ownerSignature, 'base64').toString('hex'),
          ],
          timestamp: ts,
        } as secureChannel.SpaceRegistration;
        const ephemeral_key = JSON.parse(
          ch.js_generate_x448()
        ) as secureChannel.X448Keypair;
        let members = await messageDB.getSpaceMembers(spaceId);
        let filteredMembers = members.filter(
          (m) => m.inbox_address !== '' && m.user_address != selfAddress
        );
        const encryptionStates = await messageDB.getEncryptionStates({
          conversationId: spaceId + '/' + spaceId,
        });
        const state = encryptionStates[0];
        const trState = JSON.parse(JSON.parse(state.state).state);
        const session =
          await secureChannel.EstablishTripleRatchetSessionForSpace(
            user_keyset,
            device_keyset,
            registration,
            filteredMembers.length + 200
          );

        console.log('new link session', session);
        let outbounds: string[] = [];
        let newPeerIdSet = {
          [trState.id_peer_map[1].public_key]: 1,
        };
        let newIdPeerSet = {
          [1]: trState.id_peer_map[1],
        } as { [key: number]: any };
        let idCounter = 2;
        for (const member of filteredMembers) {
          const user = await apiClient.getUser(member.user_address);
          const device = user.data.device_registrations.find(
            (d: any) =>
              trState.peer_id_map[
                Buffer.from(
                  d.inbox_registration.inbox_encryption_public_key,
                  'hex'
                ).toString('base64')
              ]
          );
          if (!device) {
            idCounter++;
            continue;
          }
          const inboxKey = Buffer.from(
            device!.inbox_registration.inbox_encryption_public_key,
            'hex'
          ).toString('base64');
          newPeerIdSet = {
            ...newPeerIdSet,
            [inboxKey]: idCounter,
          };
          newIdPeerSet = {
            ...newIdPeerSet,
            [idCounter]: trState.id_peer_map[trState.peer_id_map[inboxKey]],
          };
          idCounter++;
        }
        let ownRatchet = JSON.parse(session.state);
        ownRatchet.peer_id_map = newPeerIdSet;
        ownRatchet.id_peer_map = newIdPeerSet;
        session.state = JSON.stringify(ownRatchet);

        idCounter = 2;
        for (const member of filteredMembers) {
          if (!newIdPeerSet[idCounter]) {
            continue;
          }
          const sendState = session.template;
          const ratchet = JSON.parse(sendState.dkg_ratchet);
          sendState.peer_id_map = newPeerIdSet;
          sendState.id_peer_map = newIdPeerSet;
          ratchet.id = filteredMembers.length + 201 - session.evals.length;
          sendState.root_key = JSON.parse(session.state).root_key;
          const index_secret_raw = session.evals.shift();
          const secret_pair = JSON.parse(ch.js_generate_x448());
          const eph_pair = JSON.parse(ch.js_generate_x448());
          ratchet.total = Object.keys(ownRatchet.peer_id_map).length;
          ratchet.secret = Buffer.from(
            new Uint8Array(secret_pair.private_key)
          ).toString('base64');
          ratchet.scalar = Buffer.from(
            new Uint8Array(index_secret_raw!)
          ).toString('base64');
          ratchet.point = JSON.parse(
            ch.js_get_pubkey_x448(
              Buffer.from(new Uint8Array(index_secret_raw!)).toString('base64')
            )
          );
          ratchet.random_commitment_point = JSON.parse(
            ch.js_get_pubkey_x448(
              Buffer.from(new Uint8Array(index_secret_raw!)).toString('base64')
            )
          );
          sendState.dkg_ratchet = JSON.stringify(ratchet);
          sendState.next_dkg_ratchet = JSON.stringify(ratchet);
          sendState.ephemeral_private_key = Buffer.from(
            new Uint8Array(eph_pair.private_key)
          ).toString('base64');
          const template = JSON.stringify(sendState);

          const innerEnvelope = await secureChannel.SealInboxEnvelope(
            newIdPeerSet[idCounter].public_key,
            JSON.stringify({
              configKey: Buffer.from(
                new Uint8Array(configPair.private_key)
              ).toString('hex'),
              state: template,
            })
          );
          const envelope = await secureChannel.SealSyncEnvelope(
            member.inbox_address,
            hubKey.address!,
            {
              type: 'ed448',
              private_key: [
                ...new Uint8Array(Buffer.from(hubKey.privateKey, 'hex')),
              ],
              public_key: [
                ...new Uint8Array(Buffer.from(hubKey.publicKey, 'hex')),
              ],
            },
            {
              type: 'ed448',
              private_key: [
                ...new Uint8Array(Buffer.from(ownerKey.privateKey, 'hex')),
              ],
              public_key: [
                ...new Uint8Array(Buffer.from(ownerKey.publicKey, 'hex')),
              ],
            },
            JSON.stringify({
              type: 'control',
              message: {
                type: 'rekey',
                info: JSON.stringify(innerEnvelope),
              },
            })
          );
          outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));
          idCounter++;
        }

        const space_evals = [] as string[];
        for (
          let e = session.evals.shift();
          e != undefined;
          e = session.evals.shift()
        ) {
          const sendState = session.template;
          const ratchet = JSON.parse(sendState.dkg_ratchet);
          sendState.peer_id_map = newPeerIdSet;
          sendState.id_peer_map = newIdPeerSet;
          ratchet.id = idCounter;
          sendState.root_key = JSON.parse(session.state).root_key;
          const index_secret_raw = e;
          const secret_pair = JSON.parse(ch.js_generate_x448());
          const eph_pair = JSON.parse(ch.js_generate_x448());
          ratchet.total = Object.keys(ownRatchet.peer_id_map).length;
          ratchet.secret = Buffer.from(
            new Uint8Array(secret_pair.private_key)
          ).toString('base64');
          ratchet.scalar = Buffer.from(
            new Uint8Array(index_secret_raw!)
          ).toString('base64');
          ratchet.point = JSON.parse(
            ch.js_get_pubkey_x448(
              Buffer.from(new Uint8Array(index_secret_raw!)).toString('base64')
            )
          );
          ratchet.random_commitment_point = JSON.parse(
            ch.js_get_pubkey_x448(
              Buffer.from(new Uint8Array(index_secret_raw!)).toString('base64')
            )
          );
          sendState.dkg_ratchet = JSON.stringify(ratchet);
          sendState.next_dkg_ratchet = JSON.stringify(ratchet);
          sendState.ephemeral_private_key = Buffer.from(
            new Uint8Array(eph_pair.private_key)
          ).toString('base64');
          const template = JSON.stringify(sendState);
          const ciphertext = ch.js_encrypt_inbox_message(
            JSON.stringify({
              inbox_public_key: [...new Uint8Array(configPair.public_key)],
              ephemeral_private_key: ephemeral_key.private_key,
              plaintext: [
                ...new Uint8Array(
                  Buffer.from(
                    JSON.stringify({
                      id: idCounter,
                      template: template,
                      secret: Buffer.from(new Uint8Array(e)).toString('hex'),
                      hubKey: hubKey.privateKey,
                    }),
                    'utf-8'
                  )
                ),
              ],
            } as secureChannel.SealedInboxMessageEncryptRequest)
          );

          space_evals.push(ciphertext);
          idCounter++;
        }

        const out = {
          config_public_key: Buffer.from(
            new Uint8Array(configPair.public_key)
          ).toString('hex'),
          space_address: space!.spaceId,
          space_evals: space_evals,
          ephemeral_public_key: Buffer.from(
            new Uint8Array(ephemeral_key.public_key)
          ).toString('hex'),
          owner_public_key: ownerKey.publicKey,
          owner_signature: Buffer.from(
            JSON.parse(
              ch.js_sign_ed448(
                Buffer.from(ownerKey.privateKey, 'hex').toString('base64'),
                Buffer.from(
                  new Uint8Array([
                    ...space_evals.flatMap((s) => [
                      ...new Uint8Array(Buffer.from(s, 'utf-8')),
                    ]),
                  ])
                ).toString('base64')
              )
            ),
            'base64'
          ).toString('hex'),
        };

        space!.inviteUrl = `${getInviteUrlBase(true)}#spaceId=${space!.spaceId}&configKey=${Buffer.from(new Uint8Array(configPair.private_key)).toString('hex')}`;
        const ciphertext = ch.js_encrypt_inbox_message(
          JSON.stringify({
            inbox_public_key: [...new Uint8Array(configPair.public_key)],
            ephemeral_private_key: ephemeral_key.private_key,
            plaintext: [
              ...new Uint8Array(Buffer.from(JSON.stringify(space), 'utf-8')),
            ],
          } as secureChannel.SealedInboxMessageEncryptRequest)
        );

        const manifest = {
          space_address: spaceId,
          space_manifest: ciphertext,
          ephemeral_public_key: Buffer.from(
            new Uint8Array(ephemeral_key.public_key)
          ).toString('hex'),
          timestamp: ts,
          owner_public_key: ownerKey.publicKey,
          owner_signature: Buffer.from(
            JSON.parse(
              ch.js_sign_ed448(
                Buffer.from(ownerKey.privateKey, 'hex').toString('base64'),
                Buffer.from(
                  new Uint8Array([
                    ...new Uint8Array(Buffer.from(ciphertext, 'utf-8')),
                    ...int64ToBytes(ts),
                  ])
                ).toString('base64')
              )
            ),
            'base64'
          ).toString('hex'),
        };

        await apiClient.postSpace(spaceId, {
          space_address: spaceId,
          space_public_key: spaceKey.publicKey,
          space_signature: Buffer.from(spaceSignature, 'base64').toString(
            'hex'
          ),
          config_public_key: Buffer.from(
            new Uint8Array(configPair.public_key)
          ).toString('hex'),
          owner_public_keys: [ownerKey.publicKey],
          owner_signatures: [
            Buffer.from(ownerSignature, 'base64').toString('hex'),
          ],
          timestamp: ts,
        } as secureChannel.SpaceRegistration);
        await apiClient.postSpaceInviteEvals(out);
        await apiClient.postSpaceManifest(spaceId, manifest);
        await messageDB.saveSpace(space!);
        await queryClient.setQueryData(
          buildSpaceKey({ spaceId: space?.spaceId! }),
          space
        );

        await messageDB.saveEncryptionState(
          { ...state, state: JSON.stringify(session) },
          true
        );
        enqueueOutbound(async () => {
          return outbounds;
        });
      } catch (e) {
        console.error(e);
        throw e;
      }
    },
    []
  );

  const processInviteLink = React.useCallback(async (inviteLink: string) => {
    const params = parseInviteParams(inviteLink);
    if (!params) throw new Error(t`invalid link`);

    const info = params as {
      spaceId?: string;
      configKey?: string;
      secret?: string;
      template?: string;
      hubKey?: string;
    };

    if (!info.spaceId || !info.configKey) {
      throw new Error(t`invalid link`);
    }

    const manifest = await apiClient.getSpaceManifest(info.spaceId);
    if (!manifest) {
      throw new Error(t`invalid response`);
    }

    const ciphertext = JSON.parse(manifest.data.space_manifest) as {
      ciphertext: string;
      initialization_vector: string;
      associated_data: string;
    };
    const space = JSON.parse(
      Buffer.from(
        JSON.parse(
          ch.js_decrypt_inbox_message(
            JSON.stringify({
              inbox_private_key: [
                ...new Uint8Array(Buffer.from(info.configKey, 'hex')),
              ],
              ephemeral_public_key: [
                ...new Uint8Array(
                  Buffer.from(manifest.data.ephemeral_public_key, 'hex')
                ),
              ],
              ciphertext: ciphertext,
            })
          )
        )
      ).toString('utf-8')
    ) as Space;

    if (
      (space.inviteUrl == '' || !space.inviteUrl) &&
      (!info.secret || !info.template || !info.hubKey)
    ) {
      throw new Error(t`invalid link`);
    }

    return space;
  }, []);

  const joinInviteLink = React.useCallback(
    async (
      inviteLink: string,
      keyset: {
        userKeyset: secureChannel.UserKeyset;
        deviceKeyset: secureChannel.DeviceKeyset;
      },
      currentPasskeyInfo: {
        credentialId: string;
        address: string;
        publicKey: string;
        displayName?: string;
        pfpUrl?: string;
        completedOnboarding: boolean;
      }
    ) => {
      const params = parseInviteParams(inviteLink);
      if (params) {
        const info = params as {
          spaceId: string;
          configKey: string;
          secret?: string;
          template?: string;
          hubKey?: string;
        };

        const manifest = await apiClient.getSpaceManifest(info.spaceId);
        if (!manifest) {
          throw new Error(t`invalid response`);
        }

        const ciphertext = JSON.parse(manifest.data.space_manifest) as {
          ciphertext: string;
          initialization_vector: string;
          associated_data: string;
        };
        const space = JSON.parse(
          Buffer.from(
            JSON.parse(
              ch.js_decrypt_inbox_message(
                JSON.stringify({
                  inbox_private_key: [
                    ...new Uint8Array(Buffer.from(info.configKey, 'hex')),
                  ],
                  ephemeral_public_key: [
                    ...new Uint8Array(
                      Buffer.from(manifest.data.ephemeral_public_key, 'hex')
                    ),
                  ],
                  ciphertext: ciphertext,
                })
              )
            )
          ).toString('utf-8')
        ) as Space;

        const configPub = Buffer.from(
          ch.js_get_pubkey_x448(
            Buffer.from(info.configKey, 'hex').toString('base64')
          ),
          'base64'
        );
        let template: any;
        if (!info.secret && !info.template && !info.hubKey) {
          if (!space.inviteUrl || space.inviteUrl == '') {
            throw new Error(t`invalid link`);
          }

          let inviteEval;
          try {
            inviteEval = await apiClient.getSpaceInviteEval(
              configPub.toString('hex')
            );
          } catch (e: any) {
            if (isQuorumApiError(e) && e.status === 404) {
              throw new Error(t`This public invite link is no longer valid.`);
            }
            throw e;
          }
          const invite = JSON.parse(
            Buffer.from(
              JSON.parse(
                ch.js_decrypt_inbox_message(
                  JSON.stringify({
                    inbox_private_key: [
                      ...new Uint8Array(Buffer.from(info.configKey, 'hex')),
                    ],
                    ephemeral_public_key: [
                      ...new Uint8Array(
                        Buffer.from(manifest.data.ephemeral_public_key, 'hex')
                      ),
                    ],
                    ciphertext: JSON.parse(inviteEval.data),
                  })
                )
              )
            ).toString('utf-8')
          ) as {
            id: number;
            secret: string;
            template: string;
            hubKey: string;
          };
          info.secret = invite.secret;
          info.template = invite.template;
          info.hubKey = invite.hubKey;
          template = JSON.parse(info.template);
        } else {
          template = JSON.parse(
            Buffer.from(info.template!, 'hex').toString('utf-8')
          );
        }

        const ip = ch.js_generate_ed448();
        const inboxPair = JSON.parse(ip);
        const ih = await sha256.digest(
          Buffer.from(new Uint8Array(inboxPair.public_key))
        );
        const inboxAddress = base58btc.baseEncode(ih.bytes);
        const hubPub = Buffer.from(
          ch.js_get_pubkey_ed448(
            Buffer.from(info.hubKey!, 'hex').toString('base64')
          ),
          'base64'
        );
        const hh = await sha256.digest(hubPub);
        const hubAddress = base58btc.baseEncode(hh.bytes);
        const secret_pair = JSON.parse(ch.js_generate_x448());
        const eph_pair = JSON.parse(ch.js_generate_x448());
        const ratchet = JSON.parse(template.dkg_ratchet);
        ratchet.total++;
        ratchet.secret = Buffer.from(
          new Uint8Array(secret_pair.private_key)
        ).toString('base64');
        ratchet.scalar = Buffer.from(info.secret!, 'hex').toString('base64');
        ratchet.point = JSON.parse(
          ch.js_get_pubkey_x448(
            Buffer.from(info.secret!, 'hex').toString('base64')
          )
        );
        ratchet.random_commitment_point = JSON.parse(
          ch.js_get_pubkey_x448(
            Buffer.from(info.secret!, 'hex').toString('base64')
          )
        );
        template.dkg_ratchet = JSON.stringify(ratchet);
        template.next_dkg_ratchet = JSON.stringify(ratchet);
        template.peer_key = Buffer.from(
          new Uint8Array(
            keyset.deviceKeyset.inbox_keyset.inbox_encryption_key.private_key
          )
        ).toString('base64');
        template.ephemeral_private_key = Buffer.from(
          new Uint8Array(eph_pair.private_key)
        ).toString('base64');
        const session = {
          state: JSON.stringify(template),
        };
        await messageDB.saveEncryptionState(
          {
            state: JSON.stringify(session),
            timestamp: Date.now(),
            conversationId: space.spaceId + '/' + space.spaceId,
            inboxId: inboxAddress,
          },
          true
        );

        await apiClient.postHubAdd({
          hub_address: hubAddress,
          hub_public_key: hubPub.toString('hex'),
          hub_signature: Buffer.from(
            JSON.parse(
              ch.js_sign_ed448(
                Buffer.from(info.hubKey!, 'hex').toString('base64'),
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
                      Buffer.from('add' + hubPub.toString('hex'), 'utf-8')
                    ),
                  ])
                ).toString('base64')
              )
            ),
            'base64'
          ).toString('hex'),
        });
        await messageDB.saveSpaceKey({
          spaceId: space.spaceId,
          keyId: 'hub',
          address: hubAddress,
          publicKey: hubPub.toString('hex'),
          privateKey: info.hubKey || '',
        });
        await messageDB.saveSpaceKey({
          spaceId: space.spaceId,
          keyId: 'config',
          publicKey: configPub.toString('hex'),
          privateKey: info.configKey,
        });

        await messageDB.saveSpaceKey({
          spaceId: space.spaceId,
          keyId: 'inbox',
          address: inboxAddress,
          publicKey: Buffer.from(new Uint8Array(inboxPair.public_key)).toString(
            'hex'
          ),
          privateKey: Buffer.from(
            new Uint8Array(inboxPair.private_key)
          ).toString('hex'),
        });
        await messageDB.saveSpace(space);
        await messageDB.saveSpaceMember(space.spaceId, {
          user_address: currentPasskeyInfo.address,
          user_icon: currentPasskeyInfo.pfpUrl,
          display_name: currentPasskeyInfo.displayName,
          inbox_address: inboxAddress,
        });
        let config = await getConfig({
          address: currentPasskeyInfo.address,
          userKey: keyset.userKeyset,
        });
        if (config) {
          config.spaceIds = [...(config.spaceIds ?? []), space.spaceId];
        } else {
          config = {
            address: currentPasskeyInfo.address,
            spaceIds: [space.spaceId],
          };
        }
        await saveConfig({ config, keyset });
        await queryClient.invalidateQueries({ queryKey: buildSpacesKey({}) });
        await queryClient.invalidateQueries({
          queryKey: buildConfigKey({
            userAddress: currentPasskeyInfo.address,
          }),
        });
        enqueueOutbound(async () => {
          return [
            JSON.stringify({
              type: 'listen',
              inbox_addresses: [inboxAddress],
            }),
          ];
        });
        let participant = {
          address: currentPasskeyInfo!.address,
          id: ratchet.id,
          inboxAddress: inboxAddress,
          inboxPubKey: Buffer.from(
            new Uint8Array(
              keyset.deviceKeyset.inbox_keyset.inbox_key.public_key
            )
          ).toString('hex'),
          pubKey: Buffer.from(
            JSON.parse(
              ch.js_get_pubkey_x448(
                Buffer.from(info.secret!, 'hex').toString('base64')
              )
            ),
            'base64'
          ).toString('hex'),
          inboxKey: Buffer.from(
            new Uint8Array(
              keyset.deviceKeyset.inbox_keyset.inbox_encryption_key.public_key
            )
          ).toString('hex'),
          identityKey: Buffer.from(
            new Uint8Array(keyset.deviceKeyset.identity_key.public_key)
          ).toString('hex'),
          preKey: Buffer.from(
            new Uint8Array(keyset.deviceKeyset.pre_key.public_key)
          ).toString('hex'),
          userIcon: currentPasskeyInfo!.pfpUrl,
          displayName: currentPasskeyInfo!.displayName,
          signature: '',
        };
        const msg = Buffer.from(
          currentPasskeyInfo.address +
            ratchet.id +
            participant.inboxAddress +
            participant.pubKey +
            participant.inboxKey +
            participant.identityKey +
            participant.preKey +
            participant.userIcon +
            participant.displayName,
          'utf-8'
        ).toString('base64');
        const sig = ch.js_sign_ed448(
          Buffer.from(
            new Uint8Array(
              keyset.deviceKeyset.inbox_keyset.inbox_key.private_key
            )
          ).toString('base64'),
          msg
        );
        participant.signature = JSON.parse(sig);
        enqueueOutbound(async () => [
          await sendHubMessage(
            space.spaceId,
            JSON.stringify({
              type: 'control',
              message: {
                type: 'join',
                participant,
              },
            })
          ),
        ]);
        await requestSync(space.spaceId);
        return { spaceId: space.spaceId, channelId: space.defaultChannelId };
      }
    },
    []
  );

  // createChannel moved to after SpaceService instantiation

  const canonicalize = React.useCallback(
    (
      pendingMessage:
        | string
        | PostMessage
        | EmbedMessage
        | ReactionMessage
        | RemoveReactionMessage
        | RemoveMessage
        | UpdateProfileMessage
        | StickerMessage
    ) => {
      if (typeof pendingMessage === 'string') {
        return pendingMessage;
      }

      if (pendingMessage.type === 'post') {
        if (Array.isArray(pendingMessage.text)) {
          return pendingMessage.text.join('');
        }

        return pendingMessage.text;
      }

      if (pendingMessage.type === 'update-profile') {
        return (
          pendingMessage.type +
          pendingMessage.displayName +
          pendingMessage.userIcon
        );
      }

      if (pendingMessage.type === 'embed') {
        return (
          pendingMessage.type +
          (pendingMessage.width ?? '') +
          (pendingMessage.height ?? '') +
          (pendingMessage.imageUrl ?? '') +
          (pendingMessage.repliesToMessageId ?? '') +
          (pendingMessage.videoUrl ?? '')
        );
      }

      if (pendingMessage.type === 'reaction') {
        return (
          pendingMessage.type +
          pendingMessage.messageId +
          pendingMessage.reaction
        );
      }

      if (pendingMessage.type === 'remove-message') {
        return pendingMessage.type + pendingMessage.removeMessageId;
      }

      if (pendingMessage.type === 'remove-reaction') {
        return (
          pendingMessage.type +
          pendingMessage.messageId +
          pendingMessage.reaction
        );
      }

      if (pendingMessage.type === 'sticker') {
        return (
          pendingMessage.type +
          pendingMessage.stickerId +
          (pendingMessage.repliesToMessageId ?? '')
        );
      }

      throw new Error(t`invalid message type`);
    },
    []
  );

  // OLD CONFIG FUNCTIONS REMOVED - Now handled by ConfigService
  // getConfig and saveConfig moved to ConfigService.ts and delegated below (after ConfigService instantiation)

  useEffect(() => {
    if (keyset?.deviceKeyset?.identity_key && selfAddress) {
      setMessageHandler((message) =>
        handleNewMessage(selfAddress, keyset, message)
      );
      setResubscribe(async () =>
        enqueueOutbound(async () => {
          const conversations = await messageDB.getAllEncryptionStates();
          return [
            JSON.stringify({
              type: 'listen',
              inbox_addresses: conversations
                .map((c) => c.inboxId)
                .concat(keyset.deviceKeyset.inbox_keyset.inbox_address),
            }),
          ];
        })
      );
      setTimeout(async () => {
        enqueueOutbound(async () => {
          const conversations = await messageDB.getAllEncryptionStates();
          return [
            JSON.stringify({
              type: 'listen',
              inbox_addresses: conversations
                .map((c) => c.inboxId)
                .concat(keyset.deviceKeyset.inbox_keyset.inbox_address),
            }),
          ];
        });
      }, 1000);

      setTimeout(async () => {
        const spaces = await messageDB.getSpaces();
        const config = await messageDB.getUserConfig({ address: selfAddress });
        for (const space of spaces.filter((s) =>
          config.spaceIds.includes(s.spaceId)
        )) {
          requestSync(space.spaceId);
        }
      }, 10000);
    }
  }, [keyset, selfAddress]);

  // Forward declare SpaceService functions for circular dependency resolution
  // These will be defined after SpaceService instantiation
  const updateSpaceRef = useRef<((space: Space) => Promise<void>) | null>(null);
  const updateSpace = useCallback(
    async (space: Space) => {
      if (!updateSpaceRef.current) {
        throw new Error('updateSpace not yet initialized');
      }
      return updateSpaceRef.current(space);
    },
    []
  );

  const sendHubMessageRef = useRef<((spaceId: string, message: string) => Promise<string>) | null>(null);
  const sendHubMessage = useCallback(
    async (spaceId: string, message: string) => {
      if (!sendHubMessageRef.current) {
        throw new Error('sendHubMessage not yet initialized');
      }
      return sendHubMessageRef.current(spaceId, message);
    },
    []
  );

  // ConfigService instantiation (MUST be first - other services depend on saveConfig)
  const configService = useMemo(() => {
    return new ConfigService({
      messageDB,
      apiClient,
      int64ToBytes,
      spaceInfo,
      enqueueOutbound,
      sendHubMessage,
      queryClient,
    });
  }, [messageDB, apiClient, int64ToBytes, spaceInfo, enqueueOutbound, sendHubMessage, queryClient]);

  // ConfigService delegation functions
  // USING ConfigService: getConfig now delegates to the extracted service
  const getConfig = React.useCallback(
    async ({
      address,
      userKey,
    }: {
      address: string;
      userKey: secureChannel.UserKeyset;
    }) => {
      return configService.getConfig({ address, userKey });
    },
    [configService]
  );

  // USING ConfigService: saveConfig now delegates to the extracted service
  const saveConfig = React.useCallback(
    async ({
      config,
      keyset,
    }: {
      config: UserConfig;
      keyset: {
        userKeyset: secureChannel.UserKeyset;
        deviceKeyset: secureChannel.DeviceKeyset;
      };
    }) => {
      return configService.saveConfig({ config, keyset });
    },
    [configService]
  );

  // Create EncryptionService instance (uses updateSpace forward reference)
  const encryptionService = useMemo(() => {
    return new EncryptionService({
      messageDB,
      apiClient,
      saveConfig,
      keyset,
      updateSpace,
      int64ToBytes,
      selfAddress,
    });
  }, [messageDB, apiClient, saveConfig, keyset, updateSpace, int64ToBytes, selfAddress]);

  // Create bound method for MessageService to use
  const deleteEncryptionStates = useCallback(
    async ({ conversationId }: { conversationId: string }) => {
      return encryptionService.deleteEncryptionStates({ conversationId });
    },
    [encryptionService]
  );

  // SyncService instantiation (MUST be before MessageService since MessageService depends on sync functions)
  const syncService = useMemo(() => {
    return new SyncService({
      messageDB,
      enqueueOutbound,
      syncInfo,
      sendHubMessage,
    });
  }, [messageDB, enqueueOutbound, syncInfo, sendHubMessage]);

  // SyncService delegation functions
  // USING SyncService: synchronizeAll now delegates to the extracted service
  const synchronizeAll = React.useCallback(
    async (spaceId: string, inboxAddress: string) => {
      return syncService.synchronizeAll(spaceId, inboxAddress);
    },
    [syncService]
  );

  // USING SyncService: directSync now delegates to the extracted service
  const directSync = React.useCallback(
    async (
      spaceId: string,
      message: {
        inboxAddress: string;
        memberCount: number;
        messageCount: number;
        latestMessageTimestamp: number;
        oldestMessageTimestamp: number;
      }
    ) => {
      return syncService.directSync(spaceId, message);
    },
    [syncService]
  );

  // USING SyncService: requestSync now delegates to the extracted service
  const requestSync = React.useCallback(
    async (spaceId: string) => {
      return syncService.requestSync(spaceId);
    },
    [syncService]
  );

  // USING SyncService: sendVerifyKickedStatuses now delegates to the extracted service
  const sendVerifyKickedStatuses = React.useCallback(
    async (spaceId: string) => {
      return syncService.sendVerifyKickedStatuses(spaceId);
    },
    [syncService]
  );

  // USING SyncService: informSyncData now delegates to the extracted service
  const informSyncData = React.useCallback(
    async (
      spaceId: string,
      inboxAddress: string,
      messageCount: number,
      memberCount: number
    ) => {
      return syncService.informSyncData(spaceId, inboxAddress, messageCount, memberCount);
    },
    [syncService]
  );

  // USING SyncService: initiateSync now delegates to the extracted service
  // Note: This is needed by MessageService (called in handleNewMessage)
  const initiateSync = React.useCallback(
    async (spaceId: string) => {
      return syncService.initiateSync(spaceId);
    },
    [syncService]
  );

  // Create MessageService instance (after all dependencies are declared)
  const messageService = useMemo(() => {
    return new MessageService({
      messageDB,
      enqueueOutbound,
      addOrUpdateConversation,
      apiClient,
      deleteEncryptionStates,
      deleteInboxMessages,
      navigate,
      spaceInfo,
      syncInfo,
      synchronizeAll,
      informSyncData,
      initiateSync,
      directSync,
      saveConfig,
      int64ToBytes,
      canonicalize,
      sendHubMessage,
    });
  }, [
    messageDB,
    enqueueOutbound,
    apiClient,
    deleteEncryptionStates,
    deleteInboxMessages,
    navigate,
    spaceInfo,
    syncInfo,
    synchronizeAll,
    informSyncData,
    initiateSync,
    directSync,
    saveConfig,
    canonicalize,
    sendHubMessage,
  ]);

  // START_HANDLE_NEW_MESSAGE_FUNCTION
  // USING MessageService: handleNewMessage now delegates to the extracted service
  const handleNewMessage = useCallback(
    async (
      self_address: string,
      keyset: {
        userKeyset: secureChannel.UserKeyset;
        deviceKeyset: secureChannel.DeviceKeyset;
      },
      message: EncryptedMessage
    ) => {
      return messageService.handleNewMessage(
        self_address,
        keyset,
        message,
        queryClient
      );
    },
    [messageService, queryClient]
  );
  // END_HANDLE_NEW_MESSAGE_FUNCTION

  // START_SUBMIT_MESSAGE_FUNCTION
  // USING MessageService: submitMessage now delegates to the extracted service
  const submitMessage = React.useCallback(
    async (
      address: string,
      pendingMessage: string | object,
      self: secureChannel.UserRegistration,
      counterparty: secureChannel.UserRegistration,
      queryClient: QueryClient,
      currentPasskeyInfo: {
        credentialId: string;
        address: string;
        publicKey: string;
        displayName?: string;
        pfpUrl?: string;
        completedOnboarding: boolean;
      },
      keyset: {
        deviceKeyset: secureChannel.DeviceKeyset;
        userKeyset: secureChannel.UserKeyset;
      },
      inReplyTo?: string,
      skipSigning?: boolean
    ) => {
      return messageService.submitMessage(
        address,
        pendingMessage,
        self,
        counterparty,
        queryClient,
        currentPasskeyInfo,
        keyset,
        inReplyTo,
        skipSigning
      );
    },
    [messageService]
  );
  // END_SUBMIT_MESSAGE_FUNCTION

  // START_SAVE_MESSAGE_FUNCTION
  // USING MessageService: saveMessage now delegates to the extracted service
  const saveMessage = async (
    decryptedContent: Message,
    messageDB: MessageDB,
    spaceId: string,
    channelId: string,
    conversationType: string,
    updatedUserProfile: { user_icon?: string; display_name?: string }
  ) => {
    return messageService.saveMessage(
      decryptedContent,
      messageDB,
      spaceId,
      channelId,
      conversationType,
      updatedUserProfile
    );
  };
  // END_SAVE_MESSAGE_FUNCTION

  // START_ADD_MESSAGE_FUNCTION
  // USING MessageService: addMessage now delegates to the extracted service
  const addMessage = async (
    queryClient: QueryClient,
    spaceId: string,
    channelId: string,
    decryptedContent: Message
  ) => {
    return messageService.addMessage(
      queryClient,
      spaceId,
      channelId,
      decryptedContent
    );
  };
  // END_ADD_MESSAGE_FUNCTION

  // Create SpaceService instance (now that saveMessage and addMessage are available)
  const spaceService = useMemo(() => {
    return new SpaceService({
      messageDB,
      apiClient,
      enqueueOutbound,
      saveConfig,
      int64ToBytes,
      selfAddress,
      keyset,
      spaceInfo,
      canKickUser,
      saveMessage,
      addMessage,
    });
  }, [messageDB, apiClient, enqueueOutbound, saveConfig, int64ToBytes, selfAddress, keyset, spaceInfo, canKickUser, saveMessage, addMessage]);

  // SpaceService delegation functions
  // START_SUBMIT_UPDATE_SPACE_FUNCTION
  // USING SpaceService: submitUpdateSpace now delegates to the extracted service
  const submitUpdateSpace = React.useCallback(
    async (manifest: secureChannel.SpaceManifest) => {
      return spaceService.submitUpdateSpace(manifest);
    },
    [spaceService]
  );
  // END_SUBMIT_UPDATE_SPACE_FUNCTION

  // START_CREATE_SPACE_FUNCTION
  // USING SpaceService: createSpace now delegates to the extracted service
  const createSpace = React.useCallback(
    async (
      spaceName: string,
      spaceIcon: string,
      keyset: {
        userKeyset: secureChannel.UserKeyset;
        deviceKeyset: secureChannel.DeviceKeyset;
      },
      registration: secureChannel.UserRegistration,
      isRepudiable: boolean,
      isPublic: boolean,
      userIcon: string,
      userDisplayName: string
    ) => {
      return spaceService.createSpace(
        spaceName,
        spaceIcon,
        keyset,
        registration,
        isRepudiable,
        isPublic,
        userIcon,
        userDisplayName,
        queryClient
      );
    },
    [spaceService, queryClient]
  );
  // END_CREATE_SPACE_FUNCTION

  // START_UPDATE_SPACE_FUNCTION
  // Assign SpaceService.updateSpace to the forward reference (with queryClient bound)
  updateSpaceRef.current = (space: Space) =>
    spaceService.updateSpace(space, queryClient);
  // END_UPDATE_SPACE_FUNCTION

  // START_DELETE_SPACE_FUNCTION
  // USING SpaceService: deleteSpace now delegates to the extracted service
  const deleteSpace = React.useCallback(
    async (spaceId: string) => {
      return spaceService.deleteSpace(spaceId, queryClient);
    },
    [spaceService, queryClient]
  );
  // END_DELETE_SPACE_FUNCTION

  // START_KICK_USER_FUNCTION
  // USING SpaceService: kickUser now delegates to the extracted service
  const kickUser = React.useCallback(
    async (
      spaceId: string,
      userAddress: string,
      user_keyset: secureChannel.UserKeyset,
      device_keyset: secureChannel.DeviceKeyset,
      registration: secureChannel.UserRegistration
    ) => {
      return spaceService.kickUser(
        spaceId,
        userAddress,
        user_keyset,
        device_keyset,
        registration,
        queryClient
      );
    },
    [spaceService, queryClient]
  );
  // END_KICK_USER_FUNCTION

  // START_CREATE_CHANNEL_FUNCTION
  // USING SpaceService: createChannel now delegates to the extracted service
  const createChannel = React.useCallback(
    async (spaceId: string) => {
      return spaceService.createChannel(spaceId);
    },
    [spaceService]
  );
  // END_CREATE_CHANNEL_FUNCTION

  // START_SEND_HUB_MESSAGE_FUNCTION
  // Assign SpaceService.sendHubMessage to the forward reference
  sendHubMessageRef.current = (spaceId: string, message: string) =>
    spaceService.sendHubMessage(spaceId, message);
  // END_SEND_HUB_MESSAGE_FUNCTION

  // START_SUBMIT_CHANNEL_MESSAGE_FUNCTION
  // USING MessageService: submitMessage now delegates to the extracted service
  const submitChannelMessage = React.useCallback(
    async (
      spaceId: string,
      channelId: string,
      pendingMessage: string | object,
      queryClient: QueryClient,
      currentPasskeyInfo: {
        credentialId: string;
        address: string;
        publicKey: string;
        displayName?: string;
        pfpUrl?: string;
        completedOnboarding: boolean;
      },
      inReplyTo?: string,
      skipSigning?: boolean
    ) => {
      return messageService.submitChannelMessage(
        spaceId,
        channelId,
        pendingMessage,
        queryClient,
        currentPasskeyInfo,
        inReplyTo,
        skipSigning
      );
    },
    [messageService]
  );
  // END_SUBMIT_CHANNEL_MESSAGE_FUNCTION

  // START_DELETE_CONVERSATION_FUNCTION
  // USING MessageService: deleteConversation now delegates to the extracted service
  const deleteConversation = React.useCallback(
    async (
      conversationId: string,
      currentPasskeyInfo: {
        credentialId: string;
        address: string;
        publicKey: string;
        displayName?: string;
        pfpUrl?: string;
        completedOnboarding: boolean;
      }
    ) => {
      return messageService.deleteConversation(
        conversationId,
        currentPasskeyInfo,
        queryClient,
        keyset,
        submitMessage
      );
    },
    [messageService, queryClient, keyset, submitMessage]
  );
  // END_DELETE_CONVERSATION_FUNCTION

  // START_ENSURE_KEY_FOR_SPACE_FUNCTION
  // USING EncryptionService: ensureKeyForSpace now delegates to the extracted service
  const ensureKeyForSpace = React.useCallback(
    async (user_address: string, space: Space) => {
      return encryptionService.ensureKeyForSpace(user_address, space, queryClient);
    },
    [encryptionService, queryClient]
  );
  // END_ENSURE_KEY_FOR_SPACE_FUNCTION

  return (
    <MessageDBContext.Provider
      value={{
        messageDB,
        keyset,
        setKeyset,
        deleteEncryptionStates,
        submitMessage,
        createSpace,
        updateSpace,
        createChannel,
        submitChannelMessage,
        getConfig,
        saveConfig,
        setSelfAddress,
        ensureKeyForSpace,
        sendInviteToUser,
        generateNewInviteLink,
        processInviteLink,
        joinInviteLink,
        deleteSpace,
        kickUser,
        updateUserProfile,
        requestSync,
        sendVerifyKickedStatuses,
        deleteConversation,
      }}
    >
      {children}
    </MessageDBContext.Provider>
  );
};

const MessageDBContext = createContext<MessageDBContextValue>({
  messageDB: undefined as never,
  keyset: undefined as never,
  setKeyset: (_) => {},
  deleteEncryptionStates: () => undefined as never,
  submitMessage: () => undefined as never,
  createSpace: () => undefined as never,
  updateSpace: () => undefined as never,
  createChannel: () => undefined as never,
  submitChannelMessage: () => undefined as never,
  getConfig: () => undefined as never,
  saveConfig: () => undefined as never,
  setSelfAddress: (_) => {},
  ensureKeyForSpace: () => undefined as never,
  sendInviteToUser: () => undefined as never,
  generateNewInviteLink: () => undefined as never,
  processInviteLink: () => undefined as never,
  joinInviteLink: () => undefined as never,
  deleteSpace: () => undefined as never,
  kickUser: () => undefined as never,
  updateUserProfile: () => undefined as never,
  requestSync: () => undefined as never,
  sendVerifyKickedStatuses: () => undefined as never,
  deleteConversation: () => undefined as never,
});

export { MessageDBProvider, MessageDBContext };
