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
import { ReceiptService, TypingService } from '@quilibrium/quorum-shared';
import {
  advanceReadWatermark,
  isReadAckTimestampValid,
  resolveDeliveryAckPatch,
  resolveReadAckPatch,
} from '@quilibrium/quorum-shared';
import { ActionQueueProvider } from './ActionQueueContext';
import {
  buildConversationsKey,
} from '../../hooks';
import { buildMessagesKeyPrefix } from '../../hooks/queries/messages/buildMessagesKey';
import {
  InfiniteData,
  QueryClient,
  useQueryClient,
} from '@tanstack/react-query';
import {
  channel_raw as ch,
  channel as secureChannel,
} from '@quilibrium/quilibrium-js-sdk-channels';
import type {
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
  BroadcastSpaceTag,
} from '@quilibrium/quorum-shared';
import { useQuorumApiClient } from './QuorumApiContext';
import { QuorumApiClient } from '../../api/baseTypes';
import { useWebSocket } from './WebsocketProvider';
import { useInvalidateConversation } from '../../hooks/queries/conversation/useInvalidateConversation';
import { useNavigate } from 'react-router';
// Use platform-specific crypto utilities
// Web: uses multiformats directly
// Native: uses React Native compatible implementations
import { sha256, base58btc } from '../../utils/crypto';
import {
  hasProfileContent,
  preferIncomingProfileField,
} from '../../utils/conversationProfile';
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
    parentMessage?: Message,
    threadId?: string
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
    },
    mode?: 'one-time' | 'public' | 'reuse',
    presetLink?: string
  ) => Promise<void>;
  generateNewInviteLink: (
    spaceId: string,
    user_keyset: secureChannel.UserKeyset,
    device_keyset: secureChannel.DeviceKeyset,
    registration: secureChannel.UserRegistration
  ) => Promise<void>;
  constructInviteLink: (spaceId: string) => Promise<string>;
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
    },
    spaceTag?: BroadcastSpaceTag,
    bio?: string
  ) => Promise<void>;
  requestSync: (spaceId: string) => Promise<void>;
  sendVerifyKickedStatuses: (spaceId: string) => Promise<number>;
  broadcastDeviceRevocations: (deviceInboxAddresses: string[]) => Promise<void>;
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
  receiptService: ReceiptService | null;
  typingService: TypingService | null;
  /**
   * Imperative update for the typing-indicator privacy flags. Called by
   * useUserSettings.saveChanges so the gate reflects new state immediately
   * (no polling). Detects ON→OFF transitions and triggers immediate clearing
   * of outbound and received typing state.
   */
  setTypingConfig: (dm: boolean, spaces: boolean) => void;
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
  // Pending on-reconnect identity push, so a flapping socket replaces the
  // pending broadcast instead of stacking another one behind it.
  const dmProfilePushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    try {
      await apiClient.deleteInbox(del);
    } catch (err) {
      // A failed delete leaves the frame on the server, where it will be
      // REDELIVERED on the next re-listen. For init envelopes this is how a
      // stale envelope can come back and silently replace a healthy session
      // (502s on /inbox/delete observed live 2026-07-17). Make every failure
      // loud, then rethrow so caller behavior is unchanged.
      logger.warn('[MessageDB] ⚠️ inbox delete FAILED — frame stays on server and will be redelivered', {
        inbox: inboxKeyset.inbox_address?.slice(0, 12),
        timestamps,
        err: (err as Error)?.message,
      });
      throw err;
    }
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
    if (hasProfileContent(updatedUserProfile)) {
      try {
        const existing = await messageDB.getConversation({ conversationId });
        if (existing?.conversation) {
          await messageDB.saveConversation({
            ...existing.conversation,
            // Empty incoming field = absent, never "clear". See conversationProfile.ts.
            displayName: preferIncomingProfileField(
              updatedUserProfile?.display_name,
              existing.conversation.displayName
            ),
            icon: preferIncomingProfileField(
              updatedUserProfile?.user_icon,
              existing.conversation.icon
            ),
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
              // Same rule as the IndexedDB merge above: an empty incoming
              // field must not blank the cached value.
              const newDisplayName = preferIncomingProfileField(
                updatedUserProfile?.display_name,
                existingConv?.displayName
              );
              const newIcon = preferIncomingProfileField(
                updatedUserProfile?.user_icon,
                existingConv?.icon
              );

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
      },
      spaceTag?: BroadcastSpaceTag,
      bio?: string
    ) => {
      const spaces = await messageDB.getSpaces();
      for (const space of spaces) {
        // Two-slot design (see identity-resolution doc): the global editor
        // broadcasts the user's GLOBAL identity via the global* slots, NOT the
        // per-space override fields. Sending the override fields here is what
        // used to freeze every space to the global value and fake per-space
        // overrides. Receivers store global* separately and render
        // override-else-global. Empty string = deliberate global clear.
        submitChannelMessage(
          space.spaceId,
          space.defaultChannelId,
          {
            type: 'update-profile',
            senderId: currentPasskeyInfo.address,
            globalDisplayName: displayName,
            globalUserIcon: userIcon,
            ...(bio !== undefined ? { globalBio: bio } : {}),
            ...(spaceTag ? { spaceTag } : {}),
            // Global-only broadcast: the override fields (incl. the required
            // `userIcon`) are intentionally absent. Single cast to satisfy that
            // one required field, matching the tag-rotation rebroadcast site.
          } as UpdateProfileMessage,
          queryClient,
          currentPasskeyInfo,
          undefined, // inReplyTo
          undefined, // skipSigning
          undefined  // isSpaceOwner - not needed for profile updates
        );
      }

      // DM equivalent: push the new profile to every existing DM partner.
      // Fire-and-forget; per-partner failures are logged inside the service.
      const ks = actionQueueServiceRef.current?.getUserKeyset();
      if (ks) {
        messageServiceRef.current
          ?.broadcastProfileToAllDMs(displayName, userIcon, bio, currentPasskeyInfo.address, ks)
          .catch((err) => {
            logger.warn('[DMProfile] broadcastProfileToAllDMs failed', { err });
          });
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
      } catch { /* ignore */ }
    })();
  }, [selfAddress, keyset]);


  useEffect(() => {
    if (keyset?.deviceKeyset?.identity_key && selfAddress) {
      setMessageHandler((message) =>
        handleNewMessage(selfAddress, keyset, message)
      );
      // Push our identity to every DM partner. An established DM session
      // carries no sender profile, so a partner whose row is still a
      // placeholder cannot learn who we are from ordinary traffic — this is
      // their only recovery path when they have no public profile to fall back
      // on. The per-partner dedup gate makes an unchanged identity a wire
      // no-op, so repeated calls cost nothing. Mirrors mobile.
      //
      // Deliberately NOT wired only into setResubscribe: on a fresh page load
      // the socket opens before this effect registers that callback, so
      // resubscribe fires on later RE-connects but never on startup. The
      // listen-frame block below has the same race and works around it the
      // same way (a startup timer that duplicates the resubscribe work).
      const fireDmProfileRebroadcast = () => {
        const ks = actionQueueServiceRef.current?.getUserKeyset();
        // Either ref being unset means we ran before init finished; the other
        // scheduled call (startup vs reconnect) covers it.
        if (!ks || !messageServiceRef.current) return;
        messageServiceRef.current
          .rebroadcastProfileToAllDMsOnConnect(selfAddress, ks)
          .catch((err) =>
            logger.warn('[DMProfile] identity push failed', { err })
          );
      };

      setResubscribe(async () => {
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
        // Staggered so it never competes with the listen frame above. Reconnects
        // fire on a flat 1s retry, so without clearing the previous timer a
        // flapping socket stacks up independent pending broadcasts.
        if (dmProfilePushTimerRef.current !== null) {
          clearTimeout(dmProfilePushTimerRef.current);
        }
        dmProfilePushTimerRef.current = setTimeout(
          fireDmProfileRebroadcast,
          4000
        );
      });

      // Startup path — see the race note above. Runs alongside the existing
      // 10s space-sync block so a cold load also pushes identity.
      setTimeout(fireDmProfileRebroadcast, 10000);
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
          // Re-announce this device's per-space signing key on connect so
          // receivers that missed a prior announce self-heal. Idempotent,
          // fire-and-forget; behaviour-neutral until the send-side flip is
          // live on both platforms (per-device-signing task, Option A).
          messageServiceRef.current
            ?.announceDeviceKeys(space.spaceId, keyset)
            .catch((err) =>
              logger.warn('[DeviceKeys] announce on connect failed', {
                err,
                spaceId: space.spaceId,
              })
            );
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

  // Broadcast master-signed revoke-device tombstones for removed devices across
  // every space (Security-modal device removal). Uses the context keyset so
  // callers only supply the removed devices' DM inbox addresses.
  const broadcastDeviceRevocations = React.useCallback(
    async (deviceInboxAddresses: string[]) => {
      if (!keyset?.userKeyset || !keyset?.deviceKeyset) return;
      await messageServiceRef.current?.broadcastDeviceRevocations(
        deviceInboxAddresses,
        keyset
      );
    },
    [keyset]
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

  // Sync cache update callbacks for O(1) incremental updates
  const updateSyncCacheWithMessage = React.useCallback(
    (spaceId: string, channelId: string, message: any) => {
      syncService.updateCacheWithMessage(spaceId, channelId, message);
    },
    [syncService]
  );

  const updateSyncCacheWithMember = React.useCallback(
    (spaceId: string, channelId: string, member: any) => {
      syncService.updateCacheWithMember(spaceId, channelId, member);
    },
    [syncService]
  );

  const removeSyncCacheMessage = React.useCallback(
    (spaceId: string, channelId: string, messageId: string) => {
      syncService.removeCacheMessage(spaceId, channelId, messageId);
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
      },
      mode: 'one-time' | 'public' | 'reuse' = 'one-time',
      presetLink?: string
    ) => {
      return invitationService.sendInviteToUser(address, spaceId, currentPasskeyInfo, keyset, submitMessage, mode, presetLink);
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

  const constructInviteLink = React.useCallback(
    async (spaceId: string) => {
      return invitationService.constructInviteLink(spaceId);
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
    const result = await messageService.saveMessage(
      decryptedContent,
      messageDB,
      spaceId,
      channelId,
      conversationType,
      updatedUserProfile
    );

    // Update sync cache for O(1) incremental hash updates
    updateSyncCacheWithMessage(spaceId, channelId, decryptedContent);

    return result;
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

  // Live ref to the typing-relevant UserConfig flags. Read by TypingService's
  // isEnabledForScope callback. Updated in two places:
  //   1. Once on mount, from IndexedDB, so the gate is correct before any
  //      user interaction.
  //   2. Imperatively via setTypingConfig() exposed to consumers (useUserSettings
  //      calls it when the user saves the privacy toggles). This guarantees
  //      the gate reflects the new state immediately, no polling involved.
  const typingConfigRef = useRef<{ dm: boolean; spaces: boolean }>({ dm: false, spaces: false });
  useEffect(() => {
    if (!selfAddress) return;
    let cancelled = false;
    (async () => {
      try {
        const cfg = await messageDB.getUserConfig({ address: selfAddress });
        if (cancelled) return;
        typingConfigRef.current = {
          dm: !!cfg?.typingIndicatorsDM,
          spaces: !!cfg?.typingIndicatorsSpaces,
        };
      } catch (err) {
        logger.warn('[Typing] failed to load initial typing config', err);
      }
    })();
    return () => { cancelled = true; };
  }, [selfAddress, messageDB]);

  // Imperative update from useUserSettings when the user saves new toggle state.
  // Detects ON→OFF transitions and tells TypingService to clear immediately.
  const setTypingConfig = useCallback((dm: boolean, spaces: boolean) => {
    const prev = typingConfigRef.current;
    typingConfigRef.current = { dm, spaces };
    if (prev.dm && !dm) typingServiceRef.current?.onSettingDisabled('dm');
    if (prev.spaces && !spaces) typingServiceRef.current?.onSettingDisabled('space');
  }, []);

  // How far the peer has read, per DM conversation. In-memory only: it exists to
  // bridge the ~5s gap between a read ack and the delivery acks it outran, so a
  // restart mid-window costs at most a few ✓✓ that the next read ack restores.
  const readWatermarksRef = useRef<Map<string, number>>(new Map());

  // ReceiptService — batched ack buffer with piggyback + standalone flush
  const receiptService = useMemo(() => {
    if (!selfAddress) return null;

    const service = new ReceiptService({
      onFlush: (address: string, messageIds: string[]) => {
        // Queue standalone ack via Action Queue
        actionQueueService.enqueue(
          'send-delivery-ack',
          {
            address,
            messageIds,
            selfUserAddress: selfAddress,
          },
          `delivery-ack:${address}` // dedup key: one pending ack per address
        );
      },
      onAckProcessed: (messageIds: string[]) => {
        // Delivery acks are the source of truth for "it arrived". If a read ack
        // already covered the message, this also completes the ✓✓ upgrade.
        const now = Date.now();
        const ids = new Set(messageIds);

        // Walk each cached conversation once rather than once per messageId — the
        // query key carries the conversation, which the ack itself does not.
        const cached = queryClient.getQueriesData<
          InfiniteData<{ messages: Message[]; nextCursor?: number; prevCursor?: number }>
        >({ queryKey: ['Messages'] });

        for (const [queryKey, oldData] of cached) {
          if (!oldData?.pages) continue;

          // ['Messages', spaceId, channelId] — for DMs both are the partner address
          const readWatermark = readWatermarksRef.current.get(String(queryKey[1] ?? '')) ?? 0;

          let changed = false;
          const newPages = oldData.pages.map((page) => {
            let pageChanged = false;
            const newMessages = page.messages.map((msg) => {
              if (!ids.has(msg.messageId)) return msg;
              const patch = resolveDeliveryAckPatch(msg, { readWatermark, now });
              if (!patch) return msg;
              changed = true;
              pageChanged = true;
              return { ...msg, ...patch } as Message;
            });
            return pageChanged ? { ...page, messages: newMessages } : page;
          });

          if (changed) queryClient.setQueryData(queryKey, { ...oldData, pages: newPages });
        }

        for (const messageId of messageIds) {
          messageDB.updateMessageDeliveredAt(messageId, now, readWatermarksRef.current).catch(() => {
            // Best effort — React Query cache is already updated
          });
        }
      },
      onReadFlush: (
        address: string,
        payload: { messageId: string; timestamp: number; messageIds: string[] }
      ) => {
        // Queue standalone read ack via Action Queue
        actionQueueService.enqueue(
          'send-read-ack',
          {
            address,
            upToMessageId: payload.messageId,
            upToTimestamp: payload.timestamp,
            // Naming what was read lets the peer settle ✓✓ for messages whose
            // delivery ack was lost. The mark still rides along and still heals
            // a dropped read ack, so both failure modes stay covered.
            messageIds: payload.messageIds,
            selfUserAddress: selfAddress,
          },
          `read-ack:${address}` // dedup key: one pending read ack per address
        );
      },
      onReadAckProcessed: (
        upToMessageId: string,
        upToTimestamp: number,
        conversationAddress: string,
        messageIds?: string[]
      ) => {
        const now = Date.now();

        // A peer sending an unbounded timestamp would otherwise mark our entire
        // outbound history read.
        if (!isReadAckTimestampValid(upToTimestamp, now)) return;

        // Remember how far they have read, so delivery acks still in flight can
        // finish the upgrade when they land (see onAckProcessed). Kept even now
        // that acks name messages: naming dies with a dropped ack, the watermark
        // is restated by every later one and so repairs it.
        readWatermarksRef.current.set(
          conversationAddress,
          advanceReadWatermark(readWatermarksRef.current.get(conversationAddress) ?? 0, upToTimestamp)
        );

        // Named ids are self-proving, so they settle ✓✓ even when the delivery
        // ack was lost. Absent for peers on older builds.
        const readMessageIds = messageIds?.length ? new Set(messageIds) : undefined;
        const ctx = { upToMessageId, upToTimestamp, now, readMessageIds };

        // Update React Query cache — scope to this conversation only (not all conversations)
        const conversationKey = buildMessagesKeyPrefix({ spaceId: conversationAddress, channelId: conversationAddress });
        queryClient.setQueriesData(
          { queryKey: conversationKey },
          (oldData: InfiniteData<{ messages: Message[]; nextCursor?: number; prevCursor?: number }> | undefined) => {
            if (!oldData?.pages) return oldData;

            let changed = false;
            const newPages = oldData.pages.map((page) => {
              let pageChanged = false;
              const newMessages = page.messages.map((msg) => {
                if (msg.content?.senderId !== selfAddress) return msg;
                const patch = resolveReadAckPatch(msg, ctx);
                if (!patch) return msg;
                changed = true;
                pageChanged = true;
                return { ...msg, ...patch } as Message;
              });
              return pageChanged ? { ...page, messages: newMessages } : page;
            });

            return changed ? { ...oldData, pages: newPages } : oldData;
          }
        );

        // Persist to IndexedDB — DM spaceId and channelId are both the address
        messageDB
          .updateMessagesReadAt(
            conversationAddress,
            conversationAddress,
            selfAddress,
            upToMessageId,
            upToTimestamp,
            now,
            readMessageIds
          )
          .catch(() => {
            // Best effort — React Query cache is already updated
          });
      },
    });

    return service;
  }, [selfAddress, actionQueueService, queryClient, messageDB]);

  // Wire ReceiptService to MessageService
  useEffect(() => {
    if (receiptService) {
      messageService.setReceiptService(receiptService);
    }
    return () => {
      receiptService?.destroy();
    };
  }, [receiptService, messageService]);

  // TypingService — ephemeral typing-indicator signaling (DMs + spaces)
  //
  // Built ONCE per selfAddress. messageService and actionQueueService are
  // accessed via refs inside the callbacks so that even though they may be
  // re-memoized many times during a session (large dep lists in their own
  // useMemos), the TypingService instance stays stable. Destroying and
  // recreating the service on every messageService rebuild causes existing
  // hook subscribers to silently end up on a destroyed-then-replaced instance
  // (subscribe to old, but messages dispatch to new with empty listeners).
  const messageServiceRef = useRef(messageService);
  const actionQueueServiceRef = useRef(actionQueueService);
  useEffect(() => {
    messageServiceRef.current = messageService;
  }, [messageService]);
  useEffect(() => {
    actionQueueServiceRef.current = actionQueueService;
  }, [actionQueueService]);

  const typingService = useMemo(() => {
    if (!selfAddress) return null;
    return new TypingService({
      selfAddress,
      sendDM: async (address, msg) => {
        const ks = actionQueueServiceRef.current.getUserKeyset();
        if (!ks) return; // not logged in / not initialized
        await messageServiceRef.current.sendEphemeralDMControl(address, msg, selfAddress, ks);
      },
      sendSpace: async (spaceId, msg) => {
        await messageServiceRef.current.sendEphemeralSpaceControl(spaceId, msg);
      },
      isEnabledForScope: (scope) => {
        const cfg = typingConfigRef.current;
        if (scope.kind === 'dm') return cfg.dm;
        return cfg.spaces;
      },
    });
    // Intentionally only depends on selfAddress — see note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfAddress]);

  // Stable ref to the current TypingService so the setTypingConfig callback
  // (defined above) can reach the instance without re-creating itself.
  const typingServiceRef = useRef<TypingService | null>(null);
  useEffect(() => {
    typingServiceRef.current = typingService;
  }, [typingService]);

  // Wire TypingService to MessageService. Also re-wires whenever messageService
  // changes identity, so the latest messageService always knows about the
  // (stable) typingService. No destroy on cleanup of this effect — the
  // typingService outlives messageService re-memoizations on purpose.
  useEffect(() => {
    if (typingService) {
      messageService.setTypingService(typingService);
    }
  }, [typingService, messageService]);

  // Destroy the typingService only when its memo invalidates (i.e., on
  // selfAddress change / sign-out / provider unmount), not on every
  // messageService rebuild.
  useEffect(() => {
    return () => {
      typingService?.destroy();
    };
  }, [typingService]);

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
      parentMessage?: Message,
      threadId?: string
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
        parentMessage,
        threadId
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
        constructInviteLink,
        processInviteLink,
        joinInviteLink,
        deleteSpace,
        kickUser,
        updateUserProfile,
        requestSync,
        sendVerifyKickedStatuses,
        broadcastDeviceRevocations,
        deleteConversation,
        actionQueueService,
        receiptService,
        typingService,
        setTypingConfig,
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
  constructInviteLink: () => undefined as never,
  processInviteLink: () => undefined as never,
  joinInviteLink: () => undefined as never,
  deleteSpace: () => undefined as never,
  kickUser: () => undefined as never,
  updateUserProfile: () => undefined as never,
  requestSync: () => undefined as never,
  sendVerifyKickedStatuses: () => undefined as never,
  broadcastDeviceRevocations: () => undefined as never,
  deleteConversation: () => undefined as never,
  actionQueueService: undefined as never,
  receiptService: null,
  typingService: null,
  setTypingConfig: () => undefined,
});

export { MessageDBProvider, MessageDBContext };
