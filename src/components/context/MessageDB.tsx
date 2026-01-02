import { logger } from '@quilibrium/quorum-shared';
import React, {
  createContext,
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  EncryptedMessage,
  MessageDB,
  UserConfig,
} from '../../db/messages';
import {
  MessageService,
  EncryptionService,
  SpaceService,
  SyncService,
  ConfigService,
  InvitationService,
  ActionQueueService,
  ActionQueueHandlers,
} from '../../services';
import { ActionQueueProvider } from './ActionQueueContext';
import {
  buildConversationsKey,
} from '../../hooks';
import {
  InfiniteData,
  QueryClient,
  useQueryClient,
} from '@tanstack/react-query';
import {
  channel_raw as ch,
  channel as secureChannel,
} from '@quilibrium/quilibrium-js-sdk-channels';
import {
  Conversation,
  EmbedMessage,
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
import { QuorumApiClient } from '../../api/baseTypes';
import { useWebSocket } from './WebsocketProvider';
import { useInvalidateConversation } from '../../hooks/queries/conversation/useInvalidateConversation';
import { useNavigate } from 'react-router';
// Use platform-specific crypto utilities
// Web: uses multiformats directly
// Native: uses React Native compatible implementations
import { sha256, base58btc } from '../../utils/crypto';
import { canonicalize } from '../../utils/canonicalize';
import { t } from '@lingui/core/macro';

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
    inReplyTo?: string,
    skipSigning?: boolean
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
    userDisplayName: string,
    description?: string
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
    skipSigning?: boolean,
    isSpaceOwner?: boolean,
    parentMessage?: Message
  ) => Promise<void>;
  retryMessage: (
    spaceId: string,
    channelId: string,
    failedMessage: Message,
    queryClient: QueryClient
  ) => Promise<void>;
  retryDirectMessage: (
    address: string,
    failedMessage: Message,
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
    }
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
  actionQueueService: ActionQueueService;
};

type MessageDBContextProps = {
  children: ReactNode;
};

const MessageDBProvider: FC<MessageDBContextProps> = ({ children }) => {
  const messageDB = useMemo(() => {
    const db = new MessageDB();
    // Expose for debugging bloated encryption states
    // Usage: await window.__messageDB.analyzeEncryptionStates()
    // Usage: await window.__messageDB.cleanBloatedEncryptionStates({ dryRun: false })
    (window as any).__messageDB = db;
    return db;
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

  const deleteInboxMessages = async (
    inboxKeyset: secureChannel.InboxKeyset,
    timestamps: number[],
    apiClient: QuorumApiClient
  ) => {
    const del = {
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

  const addOrUpdateConversation = async (
    queryClient: QueryClient,
    address: string,
    timestamp: number,
    lastReadTimestamp: number,
    updatedUserProfile?: Partial<secureChannel.UserProfile>
  ) => {
    const conversationId = address + '/' + address;

    // Persist profile updates to IndexedDB (not just React Query cache)
    // This ensures profile data survives page refresh
    if (updatedUserProfile?.display_name || updatedUserProfile?.user_icon) {
      try {
        const existing = await messageDB.getConversation({ conversationId });
        if (existing?.conversation) {
          await messageDB.saveConversation({
            ...existing.conversation,
            displayName:
              updatedUserProfile.display_name ?? existing.conversation.displayName,
            icon: updatedUserProfile.user_icon ?? existing.conversation.icon,
            timestamp: Math.max(timestamp, existing.conversation.timestamp),
          });
        }
      } catch (error) {
        logger.warn('[MessageDB] Failed to persist conversation profile update:', error);
      }
    }

    // Update React Query cache for immediate UI feedback
    queryClient.setQueryData(
      buildConversationsKey({ type: 'direct' }),
      (oldData: InfiniteData<any>) => {
        if (!oldData?.pages) {
          return oldData;
        }

        return {
          pageParams: oldData.pageParams,
          pages: oldData.pages.map((page, index) => {
            if (index === 0) {
              // Find existing conversation to preserve its data (especially isRepudiable)
              const existingConv = page.conversations.find(
                (c: Conversation) => c.conversationId === conversationId
              );
              const newDisplayName = updatedUserProfile?.display_name ?? existingConv?.displayName;
              const newIcon = updatedUserProfile?.user_icon ?? existingConv?.icon;

              return {
                ...page,
                conversations: [
                  ...page.conversations.filter(
                    (c: Conversation) => c.conversationId !== conversationId
                  ),
                  {
                    ...existingConv, // Preserve all existing fields including isRepudiable
                    conversationId,
                    address: address,
                    icon: newIcon,
                    displayName: newDisplayName,
                    type: 'direct' as const,
                    timestamp: timestamp,
                    lastReadTimestamp: lastReadTimestamp,
                    // Explicitly preserve isRepudiable to ensure it's not lost
                    isRepudiable: existingConv?.isRepudiable,
                  },
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
          currentPasskeyInfo,
          undefined, // inReplyTo
          undefined, // skipSigning
          undefined  // isSpaceOwner - not needed for profile updates
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

  const submitMessageRef = useRef<any>(null);
  const submitMessage = useCallback(
    async (
      address: string,
      pendingMessage: string | object,
      self: secureChannel.UserRegistration,
      counterparty: secureChannel.UserRegistration,
      queryClient: QueryClient,
      currentPasskeyInfo: any,
      keyset: any,
      inReplyTo?: string,
      skipSigning?: boolean
    ) => {
      if (!submitMessageRef.current) {
        throw new Error('submitMessage not yet initialized');
      }
      return submitMessageRef.current(address, pendingMessage, self, counterparty, queryClient, currentPasskeyInfo, keyset, inReplyTo, skipSigning);
    },
    []
  );

  // ConfigService (must be first - provides saveConfig dependency)
  const configService = useMemo(() => {
    return new ConfigService({
      messageDB,
      apiClient,
      spaceInfo,
      enqueueOutbound,
      sendHubMessage,
      queryClient,
    });
  }, [messageDB, apiClient, spaceInfo, enqueueOutbound, sendHubMessage, queryClient]);

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
      selfAddress,
    });
  }, [messageDB, apiClient, saveConfig, keyset, updateSpace, selfAddress]);

  // Create bound method for MessageService to use
  const deleteEncryptionStates = useCallback(
    async ({ conversationId }: { conversationId: string }) => {
      return encryptionService.deleteEncryptionStates({ conversationId });
    },
    [encryptionService]
  );

  // SyncService (must be before MessageService - provides sync dependencies)
  const syncService = useMemo(() => {
    return new SyncService({
      messageDB,
      enqueueOutbound,
      syncInfo,
      sendHubMessage,
    });
  }, [messageDB, enqueueOutbound, syncInfo, sendHubMessage]);

  const synchronizeAll = React.useCallback(
    async (spaceId: string, inboxAddress: string) => {
      return syncService.synchronizeAll(spaceId, inboxAddress);
    },
    [syncService]
  );

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

  const requestSync = React.useCallback(
    async (spaceId: string) => {
      return syncService.requestSync(spaceId);
    },
    [syncService]
  );

  const sendVerifyKickedStatuses = React.useCallback(
    async (spaceId: string) => {
      return syncService.sendVerifyKickedStatuses(spaceId);
    },
    [syncService]
  );

  const informSyncData = React.useCallback(
    async (
      spaceId: string,
      inboxAddress: string,
      messageCount: number,
      memberCount: number,
      theirSummary?: any // New protocol: SyncSummary
    ) => {
      return syncService.informSyncData(spaceId, inboxAddress, messageCount, memberCount, theirSummary);
    },
    [syncService]
  );

  // Note: This is needed by MessageService (called in handleNewMessage)
  const initiateSync = React.useCallback(
    async (spaceId: string) => {
      return syncService.initiateSync(spaceId);
    },
    [syncService]
  );

  // NEW PROTOCOL: Handle sync-initiate with manifest
  const handleSyncInitiateV2 = React.useCallback(
    async (spaceId: string, message: any) => {
      return syncService.handleSyncInitiateV2(spaceId, message);
    },
    [syncService]
  );

  // NEW PROTOCOL: Handle sync-manifest - compute and send delta
  const handleSyncManifest = React.useCallback(
    async (spaceId: string, targetInbox: string, payload: any) => {
      return syncService.handleSyncManifest(spaceId, targetInbox, payload);
    },
    [syncService]
  );

  // InvitationService (depends on requestSync, sendHubMessage)
  const invitationService = useMemo(() => {
    return new InvitationService({
      messageDB,
      apiClient,
      spaceInfo,
      selfAddress,
      enqueueOutbound,
      queryClient,
      getConfig,
      saveConfig,
      sendHubMessage,
      requestSync,
    });
  }, [messageDB, apiClient, spaceInfo, selfAddress, enqueueOutbound, queryClient, getConfig, saveConfig, sendHubMessage, requestSync]);

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
      return invitationService.sendInviteToUser(address, spaceId, currentPasskeyInfo, keyset, submitMessage);
    },
    [invitationService, keyset, submitMessage]
  );

  const generateNewInviteLink = React.useCallback(
    async (
      spaceId: string,
      user_keyset: secureChannel.UserKeyset,
      device_keyset: secureChannel.DeviceKeyset,
      registration: secureChannel.UserRegistration
    ) => {
      return invitationService.generateNewInviteLink(spaceId, user_keyset, device_keyset, registration);
    },
    [invitationService]
  );

  const processInviteLink = React.useCallback(
    async (inviteLink: string) => {
      return invitationService.processInviteLink(inviteLink);
    },
    [invitationService]
  );

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
      return invitationService.joinInviteLink(inviteLink, keyset, currentPasskeyInfo);
    },
    [invitationService]
  );

  // MessageService (requires most dependencies)
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
      sendHubMessage,
      // New protocol methods
      handleSyncInitiateV2,
      handleSyncManifest,
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
    sendHubMessage,
    handleSyncInitiateV2,
    handleSyncManifest,
  ]);

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

  // Assign MessageService.submitMessage to the forward reference
  submitMessageRef.current = (
    address: string,
    pendingMessage: string | object,
    self: secureChannel.UserRegistration,
    counterparty: secureChannel.UserRegistration,
    queryClient: QueryClient,
    currentPasskeyInfo: any,
    keyset: any,
    inReplyTo?: string,
    skipSigning?: boolean
  ) => messageService.submitMessage(
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

  // SpaceService (depends on saveMessage, addMessage)
  const spaceService = useMemo(() => {
    return new SpaceService({
      messageDB,
      apiClient,
      enqueueOutbound,
      saveConfig,
      selfAddress,
      keyset,
      spaceInfo,
      saveMessage,
      addMessage,
    });
  }, [messageDB, apiClient, enqueueOutbound, saveConfig, selfAddress, keyset, spaceInfo, saveMessage, addMessage]);

  // ActionQueueService (depends on all other services)
  const actionQueueService = useMemo(() => {
    const service = new ActionQueueService(messageDB);
    // Expose for debugging: window.__actionQueue
    (window as any).__actionQueue = service;
    return service;
  }, [messageDB]);

  // ActionQueueHandlers (wire handlers after services are ready)
  const actionQueueHandlers = useMemo(() => {
    return new ActionQueueHandlers({
      messageDB,
      messageService,
      configService,
      spaceService,
      queryClient,
      getUserKeyset: () => actionQueueService.getUserKeyset(),
    });
  }, [messageDB, messageService, configService, spaceService, queryClient, actionQueueService]);

  // Wire handlers and start queue processing
  useEffect(() => {
    actionQueueService.setHandlers(actionQueueHandlers);
    // Enable ActionQueue-based message sending in MessageService
    messageService.setActionQueueService(actionQueueService);
    actionQueueService.start();
    return () => {
      actionQueueService.stop();
    };
  }, [actionQueueService, actionQueueHandlers, messageService]);

  // Set keyset on ActionQueueService after passkey auth completes
  // This allows the queue to process tasks that require keys
  useEffect(() => {
    if (keyset?.userKeyset && keyset?.deviceKeyset) {
      actionQueueService.setUserKeyset(keyset);
    }
  }, [keyset, actionQueueService]);

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
      userDisplayName: string,
      description: string = ''
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
        queryClient,
        description
      );
    },
    [spaceService, queryClient]
  );

  // Assign SpaceService.updateSpace to the forward reference (with queryClient bound)
  updateSpaceRef.current = (space: Space) =>
    spaceService.updateSpace(space, queryClient);

  const deleteSpace = React.useCallback(
    async (spaceId: string) => {
      return spaceService.deleteSpace(spaceId, queryClient);
    },
    [spaceService, queryClient]
  );

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

  const createChannel = React.useCallback(
    async (spaceId: string) => {
      return spaceService.createChannel(spaceId);
    },
    [spaceService]
  );

  // Assign SpaceService.sendHubMessage to the forward reference
  sendHubMessageRef.current = (spaceId: string, message: string) =>
    spaceService.sendHubMessage(spaceId, message);

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
      skipSigning?: boolean,
      isSpaceOwner?: boolean,
      parentMessage?: Message
    ) => {
      return messageService.submitChannelMessage(
        spaceId,
        channelId,
        pendingMessage,
        queryClient,
        currentPasskeyInfo,
        inReplyTo,
        skipSigning,
        isSpaceOwner,
        parentMessage
      );
    },
    [messageService]
  );

  const retryMessage = React.useCallback(
    async (
      spaceId: string,
      channelId: string,
      failedMessage: Message,
      queryClient: QueryClient
    ) => {
      return messageService.retryMessage(
        spaceId,
        channelId,
        failedMessage,
        queryClient
      );
    },
    [messageService]
  );

  const retryDirectMessage = React.useCallback(
    async (
      address: string,
      failedMessage: Message,
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
      }
    ) => {
      return messageService.retryDirectMessage(
        address,
        failedMessage,
        self,
        counterparty,
        queryClient,
        currentPasskeyInfo,
        keyset
      );
    },
    [messageService]
  );

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

  const ensureKeyForSpace = React.useCallback(
    async (user_address: string, space: Space) => {
      return encryptionService.ensureKeyForSpace(user_address, space, queryClient);
    },
    [encryptionService, queryClient]
  );

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
        retryMessage,
        retryDirectMessage,
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
        actionQueueService,
      }}
    >
      <ActionQueueProvider actionQueueService={actionQueueService}>
        {children}
      </ActionQueueProvider>
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
  retryMessage: () => undefined as never,
  retryDirectMessage: () => undefined as never,
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
  actionQueueService: undefined as never,
});

export { MessageDBProvider, MessageDBContext };
