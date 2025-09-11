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
import { QuorumApiClient } from '../../api/baseTypes';
import { useWebSocket } from './WebsocketProvider';
import { useInvalidateConversation } from '../../hooks/queries/conversation/useInvalidateConversation';
// Use platform-specific crypto utilities
// Web: uses multiformats directly
// Native: uses React Native compatible implementations
import { sha256, base58btc } from '../../utils/crypto';
import { buildConfigKey } from '../../hooks/queries/config/buildConfigKey';
import { t } from '@lingui/core/macro';
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
  deleteConversation: (conversationId: string) => Promise<void>;
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

  const saveMessage = async (
    decryptedContent: Message,
    messageDB: MessageDB,
    spaceId: string,
    channelId: string,
    conversationType: string,
    updatedUserProfile: { user_icon?: string; display_name?: string }
  ) => {
    if (decryptedContent.content.type === 'reaction') {
      const reaction = decryptedContent.content as ReactionMessage;
      const target = await messageDB.getMessage({
        spaceId: spaceId,
        channelId: channelId,
        messageId: decryptedContent.content.messageId,
      });
      if (target) {
        const existing = target.reactions?.find(
          (r) => r.emojiId === reaction.reaction
        );
        const modifiedSet = [
          ...(existing?.memberIds ?? []).filter((e) => e !== reaction.senderId),
          reaction.senderId,
        ];
        await messageDB.saveMessage(
          {
            ...target,
            reactions: [
              ...(target.reactions?.filter(
                (r) => r.emojiId !== reaction.reaction
              ) ?? []),
              {
                emojiId: reaction.reaction,
                emojiName: reaction.reaction,
                spaceId: spaceId != channelId ? spaceId : '',
                count: modifiedSet.length,
                memberIds: modifiedSet,
              },
            ],
          },
          0,
          spaceId,
          conversationType,
          updatedUserProfile.user_icon!,
          updatedUserProfile.display_name!
        );
      } else {
        return;
      }
    } else if (decryptedContent.content.type === 'remove-reaction') {
      const reaction = decryptedContent.content as RemoveReactionMessage;
      const target = await messageDB.getMessage({
        spaceId: spaceId,
        channelId: channelId,
        messageId: decryptedContent.content.messageId,
      });
      if (target) {
        const existing = target.reactions?.find(
          (r) => r.emojiId === reaction.reaction
        );
        if (existing) {
          const modifiedSet = [
            ...(existing?.memberIds ?? []).filter(
              (e) => e !== reaction.senderId
            ),
          ];
          let reactions =
            target.reactions?.filter((r) => r.emojiId !== reaction.reaction) ??
            [];
          if (modifiedSet.length != 0) {
            reactions = [
              ...reactions,
              {
                emojiId: reaction.reaction,
                emojiName: reaction.reaction,
                spaceId: spaceId != channelId ? spaceId : '',
                count: modifiedSet.length,
                memberIds: modifiedSet,
              },
            ];
          }
          await messageDB.saveMessage(
            {
              ...target,
              reactions: reactions,
            },
            0,
            spaceId,
            conversationType,
            updatedUserProfile.user_icon!,
            updatedUserProfile.display_name!
          );
        }
      } else {
        return;
      }
    } else if (decryptedContent.content.type === 'remove-message') {
      const targetMessage = await messageDB.getMessage({
        spaceId,
        channelId,
        messageId: decryptedContent.content.removeMessageId,
      });
      if (!targetMessage) {
        return;
      }

      if (
        targetMessage.channelId !== decryptedContent.channelId ||
        targetMessage.spaceId !== decryptedContent.spaceId
      ) {
        return;
      }

      if (
        targetMessage.content.senderId === decryptedContent.content.senderId
      ) {
        await messageDB.deleteMessage(decryptedContent.content.removeMessageId);
        return;
      }

      if (spaceId != channelId) {
        const space = await messageDB.getSpace(spaceId);
        
        
        // For read-only channels: ISOLATED permission system - only managers can delete
        const channel = space?.groups
          ?.find(g => g.channels.find(c => c.channelId === channelId))
          ?.channels.find(c => c.channelId === channelId);
          
        if (channel?.isReadOnly) {
          const isManager = !!(channel.managerRoleIds && space?.roles?.some(role => 
            channel.managerRoleIds?.includes(role.roleId) && 
            role.members.includes(decryptedContent.content.senderId)
          ));
          if (isManager) {
            await messageDB.deleteMessage(decryptedContent.content.removeMessageId);
            return;
          }
          // For read-only channels, if not a manager, deny delete (even if user has traditional roles)
          return;
        }
        
        // For regular channels: Traditional role-based permissions
        if (
          !space?.roles.find(
            (r) =>
              r.members.includes(decryptedContent.content.senderId) &&
              r.permissions.includes('message:delete')
          )
        ) {
          return;
        }
        await messageDB.deleteMessage(decryptedContent.content.removeMessageId);
      }
    } else if (decryptedContent.content.type === 'update-profile') {
      const participant = await messageDB.getSpaceMember(
        decryptedContent.spaceId,
        decryptedContent.content.senderId
      );
      if (
        !participant ||
        !decryptedContent.publicKey ||
        !decryptedContent.signature
      ) {
        return;
      }

      const sh = await sha256.digest(
        Buffer.from(decryptedContent.publicKey, 'hex')
      );
      const inboxAddress = base58btc.baseEncode(sh.bytes);

      if (
        participant.inbox_address &&
        participant.inbox_address != inboxAddress
      ) {
        return;
      }

      participant.display_name = decryptedContent.content.displayName;
      participant.user_icon = decryptedContent.content.userIcon;
      participant.inbox_address = inboxAddress;
      await messageDB.saveSpaceMember(decryptedContent.spaceId, participant);
    } else {
      await messageDB.saveMessage(
        { ...decryptedContent, channelId: channelId, spaceId: spaceId },
        0,
        spaceId,
        conversationType,
        updatedUserProfile.user_icon!,
        updatedUserProfile.display_name!
      );
    }
  };

  const addMessage = async (
    queryClient: QueryClient,
    spaceId: string,
    channelId: string,
    decryptedContent: Message
  ) => {
    if (decryptedContent.content.type === 'reaction') {
      const reaction = decryptedContent.content as ReactionMessage;
      queryClient.setQueryData(
        buildMessagesKey({ spaceId: spaceId, channelId: channelId }),
        (oldData: InfiniteData<any>) => {
          if (!oldData?.pages) return oldData;

          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page, index) => {
              return {
                ...page,
                messages: [
                  ...page.messages.map((m: Message) => {
                    if (m.messageId === reaction.messageId) {
                      const existing = m.reactions?.find(
                        (r) => r.emojiId === reaction.reaction
                      );
                      const modifiedSet = [
                        ...(existing?.memberIds ?? []).filter(
                          (e) => e !== reaction.senderId
                        ),
                        reaction.senderId,
                      ];
                      return {
                        ...m,
                        reactions: [
                          ...(m.reactions?.filter(
                            (r) => r.emojiId !== reaction.reaction
                          ) ?? []),
                          {
                            emojiId: reaction.reaction,
                            emojiName: reaction.reaction,
                            spaceId: spaceId !== channelId ? spaceId : '',
                            count: modifiedSet.length,
                            memberIds: modifiedSet,
                          },
                        ],
                      };
                    }
                    return m;
                  }),
                ],
                // Preserve any cursors or other pagination metadata
                nextCursor: page.nextCursor,
                prevCursor: page.prevCursor,
              };
            }),
          };
        }
      );
    } else if (decryptedContent.content.type === 'remove-reaction') {
      const reaction = decryptedContent.content as RemoveReactionMessage;
      queryClient.setQueryData(
        buildMessagesKey({ spaceId: spaceId, channelId: channelId }),
        (oldData: InfiniteData<any>) => {
          if (!oldData?.pages) return oldData;

          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page, index) => {
              return {
                ...page,
                messages: [
                  ...page.messages.map((m: Message) => {
                    if (m.messageId === reaction.messageId) {
                      const existing = m.reactions?.find(
                        (r) => r.emojiId === reaction.reaction
                      );
                      if (existing) {
                        const modifiedSet = [
                          ...(existing?.memberIds ?? []).filter(
                            (e) => e !== reaction.senderId
                          ),
                        ];
                        let reactions =
                          m.reactions?.filter(
                            (r) => r.emojiId !== reaction.reaction
                          ) ?? [];
                        if (modifiedSet.length != 0) {
                          reactions = [
                            ...reactions,
                            {
                              emojiId: reaction.reaction,
                              emojiName: reaction.reaction,
                              spaceId: spaceId != channelId ? spaceId : '',
                              count: modifiedSet.length,
                              memberIds: modifiedSet,
                            },
                          ];
                        }
                        return {
                          ...m,
                          reactions: reactions,
                        };
                      }
                      return m;
                    }
                    return m;
                  }),
                ],
                // Preserve any cursors or other pagination metadata
                nextCursor: page.nextCursor,
                prevCursor: page.prevCursor,
              };
            }),
          };
        }
      );
    } else if (decryptedContent.content.type === 'remove-message') {
      const targetMessage = await messageDB.getMessage({
        spaceId,
        channelId,
        messageId: decryptedContent.content.removeMessageId,
      });

      // Check if this delete request should be honored
      let shouldHonorDelete = false;
      
      if (!targetMessage) {
        // If target message doesn't exist, always remove from UI
        shouldHonorDelete = true;
      } else {
        // If target message exists, check permissions
        
        // 1. Users can always delete their own messages
        if (targetMessage.content.senderId === decryptedContent.content.senderId) {
          shouldHonorDelete = true;
        } else {
          
          if (!shouldHonorDelete && spaceId != channelId) {
            const space = await messageDB.getSpace(spaceId);
            
            // 3. Check read-only channel manager privileges
            const channel = space?.groups
              ?.find(g => g.channels.find(c => c.channelId === channelId))
              ?.channels.find(c => c.channelId === channelId);
              
            if (channel?.isReadOnly && channel.managerRoleIds) {
              const isManager = space?.roles?.some(role => 
                channel.managerRoleIds?.includes(role.roleId) && 
                role.members.includes(decryptedContent.content.senderId)
              );
              if (isManager) {
                shouldHonorDelete = true;
                console.log('🔹 ADDMESSAGE: Honoring read-only manager delete in UI cache');
              }
            }
            
            // 4. Check traditional role permissions
            if (!shouldHonorDelete && !channel?.isReadOnly) {
              const hasDeleteRole = space?.roles?.find(
                (r) =>
                  r.members.includes(decryptedContent.content.senderId) &&
                  r.permissions.includes('message:delete')
              );
              if (hasDeleteRole) {
                shouldHonorDelete = true;
                console.log('🔹 ADDMESSAGE: Honoring role-based delete in UI cache');
              }
            }
          }
        }
      }

      if (shouldHonorDelete) {
        const targetId = decryptedContent.content.removeMessageId;
        queryClient.setQueryData(
          buildMessagesKey({ spaceId: spaceId, channelId: channelId }),
          (oldData: InfiniteData<any>) => {
            if (!oldData?.pages) return oldData;

            return {
              pageParams: oldData.pageParams,
              pages: oldData.pages.map((page, index) => {
                return {
                  ...page,
                  messages: [
                    ...page.messages.filter(
                      (m: Message) => m.messageId !== targetId
                    ),
                  ],
                  // Preserve any cursors or other pagination metadata
                  nextCursor: page.nextCursor,
                  prevCursor: page.prevCursor,
                };
              }),
            };
          }
        );
      } else {
        console.log('🔹 ADDMESSAGE: Ignoring unauthorized delete request');
      }
    } else if (decryptedContent.content.type === 'update-profile') {
      const participant = await messageDB.getSpaceMember(
        decryptedContent.spaceId,
        decryptedContent.content.senderId
      );
      if (
        !participant ||
        !decryptedContent.publicKey ||
        !decryptedContent.signature
      ) {
        return;
      }

      const sh = await sha256.digest(
        Buffer.from(decryptedContent.publicKey, 'hex')
      );
      const inboxAddress = base58btc.baseEncode(sh.bytes);

      if (
        participant.inbox_address &&
        participant.inbox_address != inboxAddress
      ) {
        return;
      }

      participant.display_name = decryptedContent.content.displayName;
      participant.user_icon = decryptedContent.content.userIcon;
      participant.inbox_address = inboxAddress;
      await queryClient.setQueryData(
        buildSpaceMembersKey({ spaceId: decryptedContent.spaceId }),
        (oldData: secureChannel.UserProfile[]) => {
          return [
            ...(oldData ?? []).filter(
              (p) => p.user_address !== participant.user_address
            ),
            participant,
          ];
        }
      );
    } else {
      queryClient.setQueryData(
        buildMessagesKey({ spaceId: spaceId, channelId: channelId }),
        (oldData: InfiniteData<any>) => {
          if (!oldData?.pages) return oldData;

          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page, index) => {
              // Only add the new message to the most recent page
              if (index === oldData.pages.length - 1) {
                return {
                  ...page,
                  messages: [
                    ...page.messages.filter(
                      (m: Message) => m.messageId !== decryptedContent.messageId
                    ),
                    decryptedContent,
                  ],
                  // Preserve any cursors or other pagination metadata
                  nextCursor: page.nextCursor,
                  prevCursor: page.prevCursor,
                };
              }
              // Return other pages unchanged
              return page;
            }),
          };
        }
      );
    }
  };

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
                  {
                    conversationId,
                    address: address,
                    icon: updatedUserProfile?.user_icon,
                    displayName: updatedUserProfile?.display_name,
                    type: 'direct',
                    timestamp: timestamp,
                    lastReadTimestamp: lastReadTimestamp,
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

  const handleNewMessage = useCallback(
    async (
      self_address: string,
      keyset: {
        userKeyset: secureChannel.UserKeyset;
        deviceKeyset: secureChannel.DeviceKeyset;
      },
      message: EncryptedMessage
    ) => {
      const states = (await messageDB.getAllEncryptionStates()).reduce(
        (prev, curr) => {
          return Object.assign(prev, { [curr.inboxId]: curr });
        },
        {} as { [key: string]: EncryptionState }
      );
      let found = states[message.inboxAddress];

      if (
        message.inboxAddress == keyset.deviceKeyset.inbox_keyset.inbox_address
      ) {
        try {
          const envelope = Object.assign(
            secureChannel.UnsealInitializationEnvelope(
              keyset.deviceKeyset,
              JSON.parse(message.encryptedContent)
            ),
            { timestamp: message.timestamp }
          );
          const session = await secureChannel.NewDoubleRatchetRecipientSession(
            keyset.deviceKeyset,
            envelope
          );

          let decryptedContent: Message | null = null;
          let newState: any | null = null;

          let conversationId =
            session.user_address + '/' + session.user_address;

          let updatedUserProfile: secureChannel.UserProfile | undefined;
          decryptedContent = JSON.parse(session.message);

          if (session.user_address == self_address) {
            conversationId =
              decryptedContent?.channelId + '/' + decryptedContent?.channelId;
            session.user_address = decryptedContent!.channelId;
          }

          const encryptionStates = await messageDB.getEncryptionStates({
            conversationId,
          });
          const existing = encryptionStates.filter(
            (e) => JSON.parse(e.state).tag == session.tag
          );
          for (const e of existing) {
            await messageDB.deleteEncryptionState(e);
          }

          const inbox_key = await secureChannel.NewInboxKeyset();
          newState = JSON.stringify({
            ratchet_state: session.state,
            receiving_inbox: inbox_key,
            tag: session.tag,
            sending_inbox: {
              inbox_address: session.return_inbox_address,
              inbox_encryption_key: session.return_inbox_encryption_key,
              inbox_public_key: session.return_inbox_public_key,
              inbox_private_key: session.return_inbox_private_key,
            },
          });
          if (envelope.user_address != self_address) {
            updatedUserProfile = {
              user_address: envelope.user_address,
              user_icon: envelope.user_icon,
              display_name: envelope.display_name,
            };
          }
          enqueueOutbound(async () => {
            return [
              JSON.stringify({
                type: 'listen',
                inbox_addresses: [inbox_key.inbox_address],
              }),
            ];
          });

          if (decryptedContent && newState) {
            const newEncryptionState: EncryptionState = {
              state: newState,
              timestamp: message.timestamp,
              inboxId: inbox_key.inbox_address,
              conversationId: conversationId,
            };

            await messageDB.saveEncryptionState(newEncryptionState, true);
            const conversation = await messageDB.getConversation({
              conversationId,
            });
            await saveMessage(
              decryptedContent,
              messageDB,
              session.user_address,
              session.user_address,
              'direct',
              updatedUserProfile ?? {
                user_icon:
                  conversation?.conversation?.icon ??
                  DefaultImages.UNKNOWN_USER,
                display_name:
                  conversation?.conversation?.displayName ?? t`Unknown User`,
              }
            );
            await addMessage(
              queryClient,
              session.user_address,
              session.user_address,
              decryptedContent
            );
            addOrUpdateConversation(
              queryClient,
              session.user_address,
              envelope.timestamp,
              0,
              updatedUserProfile ?? {
                user_icon:
                  conversation?.conversation?.icon ??
                  DefaultImages.UNKNOWN_USER,
                display_name:
                  conversation?.conversation?.displayName ?? t`Unknown User`,
              }
            );
          } else {
            console.error(t`Failed to decrypt message with any known state`);
          }
          await deleteInboxMessages(
            keyset.deviceKeyset.inbox_keyset,
            [envelope.timestamp],
            apiClient
          );
        } catch (error) {
          await deleteInboxMessages(
            keyset.deviceKeyset.inbox_keyset,
            [message.timestamp],
            apiClient
          );
          return;
        }
        return;
      }

      if (!found) {
        await deleteInboxMessages(
          keyset.deviceKeyset.inbox_keyset,
          [message.timestamp],
          apiClient
        );
        return;
      }

      const conversationId = found.conversationId;
      const conversation = await messageDB.getConversation({ conversationId });

      let decryptedContent: Message | null = null;
      let newState: string | null = null;

      let keys = JSON.parse(found.state);
      let updatedUserProfile: secureChannel.UserProfile | undefined;
      let sentAccept: boolean | undefined;
      if (keys.sending_inbox) {
        // secureChannel.DoubleRatchetStateAndInboxKeys
        if (keys.sending_inbox.inbox_public_key === '') {
          try {
            const result =
              await secureChannel.ConfirmDoubleRatchetSenderSession(
                JSON.parse(found.state),
                JSON.parse(message.encryptedContent)
              );
            decryptedContent = JSON.parse(result.message);
            newState = JSON.stringify({
              ratchet_state: result.ratchet_state,
              receiving_inbox: result.receiving_inbox,
              sending_inbox: result.sending_inbox,
              tag: result.tag,
            });
            sentAccept = true;
            if (result.user_profile.user_address != self_address) {
              updatedUserProfile = result.user_profile;
            }
          } catch (error) {
            await deleteInboxMessages(
              keys.receiving_inbox,
              [message.timestamp],
              apiClient
            );
            await messageDB.deleteEncryptionState(found);
            return;
          }
        } else {
          try {
            const result = await secureChannel.DoubleRatchetInboxDecrypt(
              JSON.parse(found.state),
              JSON.parse(message.encryptedContent)
            );
            const maybeInit = result as {
              receiving_inbox: secureChannel.InboxKeyset;
              user_profile: secureChannel.UserProfile;
              tag: any;
              sending_inbox: secureChannel.SendingInbox;
              ratchet_state: string;
              message: string;
            };

            if (maybeInit.user_profile) {
              newState = JSON.stringify({
                ratchet_state: maybeInit.ratchet_state,
                receiving_inbox: maybeInit.receiving_inbox,
                sending_inbox: maybeInit.sending_inbox,
                tag: maybeInit.tag,
              });
            } else {
              newState = JSON.stringify({
                ratchet_state: result.ratchet_state,
                receiving_inbox: keys.receiving_inbox,
                sending_inbox: keys.sending_inbox,
                tag: keys.tag,
              });
            }
            decryptedContent = JSON.parse(result.message);
            sentAccept = found.sentAccept;
          } catch (error) {
            await deleteInboxMessages(
              keys.receiving_inbox,
              [message.timestamp],
              apiClient
            );
            await messageDB.deleteEncryptionState(found);
            return;
          }
        }
      } else {
        try {
          const hub_key = await messageDB.getSpaceKey(
            conversationId.split('/')[0],
            'hub'
          );
          const result = Buffer.from(
            new Uint8Array(
              await secureChannel.UnsealHubEnvelope(
                {
                  type: 'ed448',
                  public_key: [
                    ...new Uint8Array(Buffer.from(hub_key.publicKey, 'hex')),
                  ],
                  private_key: [
                    ...new Uint8Array(Buffer.from(hub_key.privateKey, 'hex')),
                  ],
                },
                JSON.parse(message.encryptedContent)
              )
            )
          ).toString('utf-8');
          const envelope = JSON.parse(result);
          if (envelope.type === 'message') {
            const decrypted = JSON.parse(
              await secureChannel.TripleRatchetDecrypt(
                JSON.stringify({
                  ratchet_state: keys.state,
                  envelope: JSON.stringify(envelope.message),
                })
              )
            );
            const output = Buffer.from(
              new Uint8Array(decrypted.message)
            ).toString('utf-8');
            decryptedContent = JSON.parse(output);

            if (decryptedContent) {
              const space = await messageDB.getSpace(
                conversationId.split('/')[0]
              );

              // enforce non-repudiability
              if (
                space &&
                !space.isRepudiable &&
                decryptedContent.publicKey &&
                decryptedContent.signature
              ) {
                const participant = await messageDB.getSpaceMember(
                  space.spaceId,
                  decryptedContent.content.senderId
                );
                const sh = await sha256.digest(
                  Buffer.from(decryptedContent.publicKey, 'hex')
                );
                const inboxAddress = base58btc.baseEncode(sh.bytes);
                const messageId = await crypto.subtle.digest(
                  'SHA-256',
                  Buffer.from(
                    decryptedContent.nonce +
                      'post' +
                      decryptedContent.content.senderId +
                      canonicalize(decryptedContent.content as any),
                    'utf-8'
                  )
                );
                const inboxMismatch = (participant.inbox_address !== inboxAddress && participant.inbox_address);
                const messageIdMismatch = decryptedContent.messageId !== Buffer.from(messageId).toString('hex');
                
                if (inboxMismatch || messageIdMismatch) {
                  console.warn(t`invalid address for signature`);
                  decryptedContent.publicKey = undefined;
                  decryptedContent.signature = undefined;
                } else {
                  if (
                    ch.js_verify_ed448(
                      Buffer.from(decryptedContent.publicKey, 'hex').toString(
                        'base64'
                      ),
                      Buffer.from(messageId).toString('base64'),
                      Buffer.from(decryptedContent.signature, 'hex').toString(
                        'base64'
                      )
                    ) !== 'true'
                  ) {
                    console.warn('invalid signature');
                    decryptedContent.publicKey = undefined;
                    decryptedContent.signature = undefined;
                  }
                }
              }

              if (
                decryptedContent?.content.type === 'update-profile' &&
                (!decryptedContent?.publicKey || !decryptedContent?.signature)
              ) {
                decryptedContent = null;
              }
            }
          } else if (envelope.type === 'control') {
            const exteriorEnvelope = JSON.parse(message.encryptedContent);
            if (envelope.message.type === 'join') {
              const participant = envelope.message.participant;
              const pointResult = ch.js_verify_point(
                JSON.stringify({
                  ratchet_state: keys.state,
                  point: participant.pubKey,
                  index: participant.id,
                })
              );
              if (pointResult === 'true') {
                const msg = Buffer.from(
                  participant.address +
                    participant.id +
                    participant.inboxAddress +
                    participant.pubKey +
                    participant.inboxKey +
                    participant.identityKey +
                    participant.preKey +
                    participant.userIcon +
                    participant.displayName,
                  'utf-8'
                ).toString('base64');
                const result = ch.js_verify_ed448(
                  Buffer.from(participant.inboxPubKey, 'hex').toString(
                    'base64'
                  ),
                  msg,
                  participant.signature
                );
                if (result === 'true') {
                  messageDB.saveSpaceMember(conversationId.split('/')[0], {
                    user_address: participant.address,
                    user_icon: participant.userIcon,
                    display_name: participant.displayName,
                    inbox_address: participant.inboxAddress,
                  });
                  await queryClient.setQueryData(
                    buildSpaceMembersKey({
                      spaceId: conversationId.split('/')[0],
                    }),
                    (oldData: secureChannel.UserProfile[]) => {
                      return [
                        ...(oldData ?? []),
                        {
                          user_address: participant.address,
                          user_icon: participant.userIcon,
                          display_name: participant.displayName,
                        },
                      ];
                    }
                  );
                  const ratchet = JSON.parse(keys.state);
                  ratchet.id_peer_map = {
                    ...ratchet.id_peer_map,
                    [participant.id]: {
                      public_key: Buffer.from(
                        participant.inboxKey,
                        'hex'
                      ).toString('base64'),
                      identity_public_key: Buffer.from(
                        participant.identityKey,
                        'hex'
                      ).toString('base64'),
                      signed_pre_public_key: Buffer.from(
                        participant.preKey,
                        'hex'
                      ).toString('base64'),
                    },
                  };
                  ratchet.peer_id_map = {
                    ...ratchet.peer_id_map,
                    [Buffer.from(participant.inboxKey, 'hex').toString(
                      'base64'
                    )]: participant.id,
                  };
                  newState = JSON.stringify({
                    ...keys,
                    state: JSON.stringify(ratchet),
                  });
                  const space = await messageDB.getSpace(
                    conversationId.split('/')[0]
                  );
                  const messageId = await crypto.subtle.digest(
                    'SHA-256',
                    Buffer.from('join' + participant.inboxAddress, 'utf-8')
                  );
                  const msg = {
                    channelId: space!.defaultChannelId,
                    spaceId: conversationId.split('/')[0],
                    messageId: Buffer.from(messageId).toString('hex'),
                    digestAlgorithm: 'SHA-256',
                    nonce: Buffer.from(messageId).toString('hex'),
                    createdDate: Date.now(),
                    modifiedDate: Date.now(),
                    lastModifiedHash: '',
                    content: {
                      senderId: participant.address,
                      type: 'join',
                    } as JoinMessage,
                  } as Message;
                  await saveMessage(
                    msg,
                    messageDB,
                    conversationId.split('/')[0],
                    space!.defaultChannelId,
                    'group',
                    {}
                  );
                  await addMessage(
                    queryClient,
                    conversationId.split('/')[0],
                    space!.defaultChannelId,
                    msg
                  );
                }
              } else {
                console.error(pointResult);
              }
            } else if (envelope.message.type === 'sync-peer-map') {
              let reg = spaceInfo.current[conversationId.split('/')[0]];
              if (!reg) {
                reg = (await apiClient.getSpace(conversationId.split('/')[0]))
                  .data;
                spaceInfo.current[conversationId.split('/')[0]] = reg;
              }

              if (
                reg.owner_public_keys.includes(
                  exteriorEnvelope.owner_public_key
                ) ||
                syncInfo.current[conversationId.split('/')[0]]
              ) {
                const verify = JSON.parse(
                  ch.js_verify_ed448(
                    Buffer.from(
                      exteriorEnvelope.owner_public_key,
                      'hex'
                    ).toString('base64'),
                    Buffer.from(exteriorEnvelope.envelope, 'utf-8').toString(
                      'base64'
                    ),
                    Buffer.from(
                      exteriorEnvelope.owner_signature,
                      'hex'
                    ).toString('base64')
                  )
                );
                if (verify) {
                  const ratchet = JSON.parse(keys.state);
                  ratchet.id_peer_map = envelope.message.peerMap.id_peer_map;
                  ratchet.peer_id_map = envelope.message.peerMap.peer_id_map;
                  newState = JSON.stringify({
                    ...keys,
                    state: JSON.stringify(ratchet),
                  });
                }
              }
            } else if (envelope.message.type === 'space-manifest') {
              let reg = spaceInfo.current[conversationId.split('/')[0]];
              if (!reg) {
                reg = (await apiClient.getSpace(conversationId.split('/')[0]))
                  .data;
                spaceInfo.current[conversationId.split('/')[0]] = reg;
              }
              const manifest = envelope.message
                .manifest as secureChannel.SpaceManifest;
              if (reg.owner_public_keys.includes(manifest.owner_public_key)) {
                const verify = JSON.parse(
                  ch.js_verify_ed448(
                    Buffer.from(manifest.owner_public_key, 'hex').toString(
                      'base64'
                    ),
                    Buffer.from(
                      new Uint8Array([
                        ...new Uint8Array(
                          Buffer.from(manifest.space_manifest, 'utf-8')
                        ),
                        ...int64ToBytes(manifest.timestamp),
                      ])
                    ).toString('base64'),
                    Buffer.from(manifest.owner_signature, 'hex').toString(
                      'base64'
                    )
                  )
                );
                if (verify) {
                  const ciphertext = JSON.parse(manifest.space_manifest) as {
                    ciphertext: string;
                    initialization_vector: string;
                    associated_data: string;
                  };
                  const config_key = await messageDB.getSpaceKey(
                    conversationId.split('/')[0],
                    'config'
                  );
                  const space = JSON.parse(
                    Buffer.from(
                      JSON.parse(
                        ch.js_decrypt_inbox_message(
                          JSON.stringify({
                            inbox_private_key: [
                              ...new Uint8Array(
                                Buffer.from(config_key.privateKey, 'hex')
                              ),
                            ],
                            ephemeral_public_key: [
                              ...new Uint8Array(
                                Buffer.from(
                                  manifest.ephemeral_public_key,
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
                  await messageDB.saveSpace(space);
                  await queryClient.setQueryData(
                    buildSpaceKey({ spaceId: conversationId.split('/')[0] }),
                    () => {
                      return space;
                    }
                  );
                }
              }
            } else if (envelope.message.type === 'leave') {
              const hubKey = await messageDB.getSpaceKey(
                conversationId.split('/')[0],
                'hub'
              );

              const verify = JSON.parse(
                ch.js_verify_ed448(
                  Buffer.from(envelope.message.inboxPublicKey, 'hex').toString(
                    'base64'
                  ),
                  Buffer.from(
                    new Uint8Array([
                      ...new Uint8Array(
                        Buffer.from('delete' + hubKey.publicKey, 'utf-8')
                      ),
                    ])
                  ).toString('base64'),
                  Buffer.from(envelope.message.inboxSignature, 'hex').toString(
                    'base64'
                  )
                )
              );
              const sh = await sha256.digest(
                Buffer.from(envelope.message.inboxPublicKey, 'hex')
              );
              const inboxAddress = base58btc.baseEncode(sh.bytes);
              if (verify) {
                const members = await messageDB.getSpaceMembers(
                  conversationId.split('/')[0]
                );
                for (const member of members) {
                  if (member.inbox_address == inboxAddress) {
                    await messageDB.saveSpaceMember(
                      conversationId.split('/')[0],
                      { ...member, inbox_address: '' }
                    );
                    await queryClient.setQueryData(
                      buildSpaceMembersKey({
                        spaceId: conversationId.split('/')[0],
                      }),
                      (oldData: secureChannel.UserProfile[]) => {
                        return [
                          ...(oldData ?? []),
                          { ...member, inbox_address: '' },
                        ];
                      }
                    );
                    const space = await messageDB.getSpace(
                      conversationId.split('/')[0]
                    );
                    const messageId = await crypto.subtle.digest(
                      'SHA-256',
                      Buffer.from('leave' + member.inbox_address, 'utf-8')
                    );
                    const msg = {
                      channelId: space!.defaultChannelId,
                      spaceId: conversationId.split('/')[0],
                      messageId: Buffer.from(messageId).toString('hex'),
                      digestAlgorithm: 'SHA-256',
                      nonce: Buffer.from(messageId).toString('hex'),
                      createdDate: Date.now(),
                      modifiedDate: Date.now(),
                      lastModifiedHash: '',
                      content: {
                        senderId: member.user_address,
                        type: 'leave',
                      } as LeaveMessage,
                    } as Message;
                    await saveMessage(
                      msg,
                      messageDB,
                      conversationId.split('/')[0],
                      space!.defaultChannelId,
                      'group',
                      {}
                    );
                    await addMessage(
                      queryClient,
                      conversationId.split('/')[0],
                      space!.defaultChannelId,
                      msg
                    );
                    break;
                  }
                }
              }
            } else if (envelope.message.type === 'rekey') {
              let reg = spaceInfo.current[conversationId.split('/')[0]];
              if (!reg) {
                reg = (await apiClient.getSpace(conversationId.split('/')[0]))
                  .data;
                spaceInfo.current[conversationId.split('/')[0]] = reg;
              }
              if (
                reg.owner_public_keys.includes(
                  exteriorEnvelope.owner_public_key
                )
              ) {
                const verify = JSON.parse(
                  ch.js_verify_ed448(
                    Buffer.from(
                      exteriorEnvelope.owner_public_key,
                      'hex'
                    ).toString('base64'),
                    Buffer.from(exteriorEnvelope.envelope, 'utf-8').toString(
                      'base64'
                    ),
                    Buffer.from(
                      exteriorEnvelope.owner_signature,
                      'hex'
                    ).toString('base64')
                  )
                );
                if (verify) {
                  const info = JSON.parse(envelope.message.info);
                  const inner_envelope = JSON.parse(
                    Buffer.from(
                      new Uint8Array(
                        await secureChannel.UnsealInboxEnvelope(
                          keyset.deviceKeyset.inbox_keyset.inbox_encryption_key
                            .private_key,
                          info
                        )
                      )
                    ).toString('utf-8')
                  );
                  const configPub = Buffer.from(
                    JSON.parse(
                      ch.js_get_pubkey_x448(
                        Buffer.from(inner_envelope.configKey, 'hex').toString(
                          'base64'
                        )
                      )
                    ),
                    'base64'
                  ).toString('hex');
                  await messageDB.saveSpaceKey({
                    spaceId: conversationId.split('/')[0],
                    keyId: 'config',
                    privateKey: inner_envelope.configKey,
                    publicKey: configPub,
                  });
                  let template = JSON.parse(inner_envelope.state);
                  template.peer_key = Buffer.from(
                    new Uint8Array(
                      keyset.deviceKeyset.inbox_keyset.inbox_encryption_key.private_key
                    )
                  ).toString('base64');
                  newState = JSON.stringify({
                    ...keys,
                    state: JSON.stringify(template),
                  });
                  const space = await messageDB.getSpace(
                    conversationId.split('/')[0]
                  );
                  if (envelope.message.kick) {
                    const messageId = await crypto.subtle.digest(
                      'SHA-256',
                      Buffer.from('kick' + envelope.message.kick, 'utf-8')
                    );
                    const msg = {
                      channelId: space!.defaultChannelId,
                      spaceId: conversationId.split('/')[0],
                      messageId: Buffer.from(messageId).toString('hex'),
                      digestAlgorithm: 'SHA-256',
                      nonce: Buffer.from(messageId).toString('hex'),
                      createdDate: Date.now(),
                      modifiedDate: Date.now(),
                      lastModifiedHash: '',
                      content: {
                        senderId: envelope.message.kick,
                        type: 'kick',
                      } as KickMessage,
                    } as Message;
                    await saveMessage(
                      msg,
                      messageDB,
                      conversationId.split('/')[0],
                      space!.defaultChannelId,
                      'group',
                      {}
                    );
                    await addMessage(
                      queryClient,
                      conversationId.split('/')[0],
                      space!.defaultChannelId,
                      msg
                    );
                  }

                  if (space?.inviteUrl) {
                    space.inviteUrl = `https://qm.one/invite/#spaceId=${space.spaceId}&configKey=${inner_envelope.configKey}`;
                    await messageDB.saveSpace(space);
                  }
                }
              }
            } else if (envelope.message.type === 'kick') {
              let reg = spaceInfo.current[conversationId.split('/')[0]];
              if (!reg) {
                reg = (await apiClient.getSpace(conversationId.split('/')[0]))
                  .data;
                spaceInfo.current[conversationId.split('/')[0]] = reg;
              }
              if (
                reg.owner_public_keys.includes(
                  exteriorEnvelope.owner_public_key
                )
              ) {
                const verify = JSON.parse(
                  ch.js_verify_ed448(
                    Buffer.from(
                      exteriorEnvelope.owner_public_key,
                      'hex'
                    ).toString('base64'),
                    Buffer.from(exteriorEnvelope.envelope, 'utf-8').toString(
                      'base64'
                    ),
                    Buffer.from(
                      exteriorEnvelope.owner_signature,
                      'hex'
                    ).toString('base64')
                  )
                );
                if (verify) {
                  if (envelope.message.kick === self_address) {
                    const spaceId = conversationId.split('/')[0];
                    const hubKey = await messageDB.getSpaceKey(spaceId, 'hub');
                    const inboxKey = await messageDB.getSpaceKey(
                      spaceId,
                      'inbox'
                    );
                    await apiClient.postHubDelete({
                      hub_address: hubKey.address!,
                      hub_public_key: hubKey.publicKey,
                      hub_signature: Buffer.from(
                        JSON.parse(
                          ch.js_sign_ed448(
                            Buffer.from(hubKey.privateKey, 'hex').toString(
                              'base64'
                            ),
                            Buffer.from(
                              new Uint8Array([
                                ...new Uint8Array(
                                  Buffer.from(
                                    'delete' + inboxKey.publicKey,
                                    'utf-8'
                                  )
                                ),
                              ])
                            ).toString('base64')
                          )
                        ),
                        'base64'
                      ).toString('hex'),
                      inbox_public_key: inboxKey.publicKey,
                      inbox_signature: Buffer.from(
                        JSON.parse(
                          ch.js_sign_ed448(
                            Buffer.from(inboxKey.privateKey, 'hex').toString(
                              'base64'
                            ),
                            Buffer.from(
                              new Uint8Array([
                                ...new Uint8Array(
                                  Buffer.from(
                                    'delete' + hubKey.publicKey,
                                    'utf-8'
                                  )
                                ),
                              ])
                            ).toString('base64')
                          )
                        ),
                        'base64'
                      ).toString('hex'),
                    });
                    const states = await messageDB.getEncryptionStates({
                      conversationId: spaceId + '/' + spaceId,
                    });
                    for (const state of states) {
                      await messageDB.deleteEncryptionState(state);
                    }
                    const messages = await messageDB.getAllSpaceMessages({
                      spaceId,
                    });
                    for (const message of messages) {
                      await messageDB.deleteMessage(message.messageId);
                    }
                    const members = await messageDB.getSpaceMembers(spaceId);
                    for (const member of members) {
                      await messageDB.deleteSpaceMember(
                        spaceId,
                        member.user_address
                      );
                    }
                    const keys = await messageDB.getSpaceKeys(spaceId);
                    for (const key of keys) {
                      await messageDB.deleteSpaceKey(spaceId, key.keyId);
                    }
                    let userConfig = await messageDB.getUserConfig({
                      address: self_address,
                    });
                    userConfig = {
                      ...(userConfig ?? { address: self_address }),
                      spaceIds: [
                        ...(userConfig?.spaceIds.filter((s) => s != spaceId) ??
                          []),
                      ],
                    };
                    await saveConfig({ config: userConfig, keyset });
                    await queryClient.setQueryData(
                      buildConfigKey({ userAddress: self_address }),
                      () => userConfig
                    );
                    await messageDB.deleteSpace(spaceId);
                    return;
                  }
                }
              }
            } else if (envelope.message.type === 'sync') {
              await synchronizeAll(
                conversationId.split('/')[0],
                envelope.message.inboxAddress
              );
            } else if (envelope.message.type === 'sync-request') {
              if (envelope.message.expiry > Date.now()) {
                await informSyncData(
                  conversationId.split('/')[0],
                  envelope.message.inboxAddress,
                  envelope.message.messageCount,
                  envelope.message.memberCount
                );
              }
            } else if (envelope.message.type === 'sync-info') {
              if (
                syncInfo.current[conversationId.split('/')[0]] &&
                syncInfo.current[conversationId.split('/')[0]].expiry >
                  Date.now()
              ) {
                if (
                  envelope.message.inboxAddress &&
                  envelope.message.messageCount &&
                  envelope.message.memberCount
                ) {
                  syncInfo.current[
                    conversationId.split('/')[0]
                  ].candidates.push(envelope.message);
                  // reset the timeout to be 1s to more aggressively grab viable candidates for sync instead of waiting the full 30s
                  clearTimeout(
                    syncInfo.current[conversationId.split('/')[0]].invokable
                  );
                  syncInfo.current[conversationId.split('/')[0]].invokable =
                    setTimeout(
                      () => initiateSync(conversationId.split('/')[0]),
                      1000
                    );
                }
              }
            } else if (envelope.message.type === 'sync-initiate') {
              if (envelope.message.inboxAddress) {
                await directSync(
                  conversationId.split('/')[0],
                  envelope.message
                );
              }
            } else if (envelope.message.type === 'sync-members') {
              let reg = spaceInfo.current[conversationId.split('/')[0]];
              if (!reg) {
                reg = (await apiClient.getSpace(conversationId.split('/')[0]))
                  .data;
                spaceInfo.current[conversationId.split('/')[0]] = reg;
              }

              if (
                reg.owner_public_keys.includes(
                  exteriorEnvelope.owner_public_key
                ) ||
                syncInfo.current[conversationId.split('/')[0]]
              ) {
                const verify = JSON.parse(
                  ch.js_verify_ed448(
                    Buffer.from(
                      exteriorEnvelope.owner_public_key,
                      'hex'
                    ).toString('base64'),
                    Buffer.from(exteriorEnvelope.envelope, 'utf-8').toString(
                      'base64'
                    ),
                    Buffer.from(
                      exteriorEnvelope.owner_signature,
                      'hex'
                    ).toString('base64')
                  )
                );
                if (verify) {
                  for (const member of envelope.message.members) {
                    await messageDB.saveSpaceMember(
                      conversationId.split('/')[0],
                      member
                    );
                  }
                  await queryClient.setQueryData(
                    buildSpaceMembersKey({
                      spaceId: conversationId.split('/')[0],
                    }),
                    (oldData: secureChannel.UserProfile[]) => {
                      return [...(oldData ?? []), ...envelope.message.members];
                    }
                  );
                }
              }
            } else if (envelope.message.type === 'sync-messages') {
              let reg = spaceInfo.current[conversationId.split('/')[0]];
              if (!reg) {
                reg = (await apiClient.getSpace(conversationId.split('/')[0]))
                  .data;
                spaceInfo.current[conversationId.split('/')[0]] = reg;
              }

              if (
                reg.owner_public_keys.includes(
                  exteriorEnvelope.owner_public_key
                ) ||
                syncInfo.current[conversationId.split('/')[0]]
              ) {
                const verify = JSON.parse(
                  ch.js_verify_ed448(
                    Buffer.from(
                      exteriorEnvelope.owner_public_key,
                      'hex'
                    ).toString('base64'),
                    Buffer.from(exteriorEnvelope.envelope, 'utf-8').toString(
                      'base64'
                    ),
                    Buffer.from(
                      exteriorEnvelope.owner_signature,
                      'hex'
                    ).toString('base64')
                  )
                );
                if (verify) {
                  const space = await messageDB.getSpace(
                    conversationId.split('/')[0]
                  );
                  for (const message of envelope.message.messages) {
                    // enforce non-repudiability
                    if (
                      space &&
                      !space.isRepudiable &&
                      message.publicKey &&
                      message.signature
                    ) {
                      const participant = await messageDB.getSpaceMember(
                        space.spaceId,
                        message.content.senderId
                      );
                      const sh = await sha256.digest(
                        Buffer.from(message.publicKey, 'hex')
                      );
                      const inboxAddress = base58btc.baseEncode(sh.bytes);
                      const messageId = await crypto.subtle.digest(
                        'SHA-256',
                        Buffer.from(
                          message.nonce +
                            'post' +
                            message.content.senderId +
                            canonicalize(message.content as any),
                          'utf-8'
                        )
                      );
                      if (
                        (participant.inbox_address !== inboxAddress &&
                          participant.inbox_address) ||
                        message.messageId !==
                          Buffer.from(messageId).toString('hex')
                      ) {
                        message.publicKey = undefined;
                        message.signature = undefined;
                      } else {
                        if (
                          ch.js_verify_ed448(
                            Buffer.from(message.publicKey, 'hex').toString(
                              'base64'
                            ),
                            Buffer.from(messageId).toString('base64'),
                            Buffer.from(message.signature, 'hex').toString(
                              'base64'
                            )
                          ) !== 'true'
                        ) {
                          console.warn('invalid signature');
                          message.publicKey = undefined;
                          message.signature = undefined;
                        }
                      }
                    }
                    await saveMessage(
                      message,
                      messageDB,
                      conversationId.split('/')[0],
                      message.channelId,
                      'group',
                      {}
                    );
                  }
                  const channelIds = envelope.message.messages
                    .map((m: any) => m.channelId)
                    .sort();
                  const checked = {} as { [id: string]: boolean };
                  for (const channelId of channelIds) {
                    if (!checked[channelId]) {
                      checked[channelId] = true;
                      queryClient.refetchQueries({
                        queryKey: buildMessagesKey({
                          spaceId: conversationId.split('/')[0],
                          channelId: channelId,
                        }),
                      });
                    }
                  }
                }
              }
            }
          }
        } catch {}
      }

      if (newState) {
        const newEncryptionState: EncryptionState = {
          state: newState,
          timestamp: message.timestamp,
          inboxId: found.inboxId,
          sentAccept: sentAccept,
          conversationId: conversationId,
        };
        await messageDB.saveEncryptionState(newEncryptionState, true);
      }

      if (decryptedContent) {
        if (keys.sending_inbox) {
          await saveMessage(
            decryptedContent,
            messageDB,
            conversationId.split('/')[0],
            conversationId.split('/')[0],
            keys.sending_inbox ? 'direct' : 'group',
            updatedUserProfile ?? {
              user_icon: conversation.conversation?.icon,
              display_name: conversation.conversation?.displayName,
            }
          );
          await addMessage(
            queryClient,
            conversationId.split('/')[0],
            conversationId.split('/')[0],
            decryptedContent
          );
          addOrUpdateConversation(
            queryClient,
            conversationId.split('/')[0],
            message.timestamp,
            conversation.conversation?.lastReadTimestamp ?? 0,
            updatedUserProfile ?? {
              user_icon: conversation.conversation?.icon,
              display_name: conversation.conversation?.displayName,
            }
          );
        } else {
          await saveMessage(
            decryptedContent,
            messageDB,
            conversationId.split('/')[0],
            decryptedContent.channelId,
            keys.sending_inbox ? 'direct' : 'group',
            updatedUserProfile ?? {
              user_icon: conversation.conversation?.icon,
              display_name: conversation.conversation?.displayName,
            }
          );
          await addMessage(
            queryClient,
            conversationId.split('/')[0],
            decryptedContent.channelId,
            decryptedContent
          );
        }
      }

      if (keys.sending_inbox) {
        await deleteInboxMessages(
          keys.receiving_inbox,
          [message.timestamp],
          apiClient
        );
      } else {
        const inbox_key = await messageDB.getSpaceKey(
          conversationId.split('/')[0],
          'inbox'
        );
        await deleteInboxMessages(
          {
            inbox_address: inbox_key.address!,
            inbox_encryption_key: {} as never,
            inbox_key: {
              type: 'ed448',
              public_key: [
                ...new Uint8Array(Buffer.from(inbox_key.publicKey, 'hex')),
              ],
              private_key: [
                ...new Uint8Array(Buffer.from(inbox_key.privateKey, 'hex')),
              ],
            },
          },
          [message.timestamp],
          apiClient
        );
      }
    },
    [queryClient]
  );

  const synchronizeAll = React.useCallback(
    async (spaceId: string, inboxAddress: string) => {
      try {
        const ownerKey = await messageDB.getSpaceKey(spaceId, 'owner');
        if (ownerKey) {
          enqueueOutbound(async () => {
            const memberSet = await messageDB.getSpaceMembers(spaceId);
            const messageSet = await messageDB.getAllSpaceMessages({ spaceId });
            const hubKey = await messageDB.getSpaceKey(spaceId, 'hub');
            let outbounds: string[] = [];
            const encryptionState = await messageDB.getEncryptionStates({
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
    },
    []
  );

  const initiateSync = React.useCallback(async (spaceId: string) => {
    if (
      !syncInfo.current[spaceId] ||
      !syncInfo.current[spaceId].candidates.length
    ) {
      return;
    }

    const memberSet = await messageDB.getSpaceMembers(spaceId);
    const messageSet = await messageDB.getAllSpaceMessages({ spaceId });

    let candidates = syncInfo.current[spaceId].candidates;

    candidates = candidates
      .filter((c) => c.messageCount > messageSet.length)
      .sort((a, b) => b.messageCount - a.messageCount);

    if (candidates.length == 0) {
      return;
    }

    enqueueOutbound(async () => {
      const hubKey = await messageDB.getSpaceKey(spaceId, 'hub');
      const inboxKey = await messageDB.getSpaceKey(spaceId, 'inbox');

      const envelope = await secureChannel.SealSyncEnvelope(
        candidates[0].inboxAddress,
        hubKey.address!,
        {
          type: 'ed448',
          private_key: [
            ...new Uint8Array(Buffer.from(hubKey.privateKey, 'hex')),
          ],
          public_key: [...new Uint8Array(Buffer.from(hubKey.publicKey, 'hex'))],
        },
        {
          type: 'ed448',
          private_key: [
            ...new Uint8Array(Buffer.from(inboxKey.privateKey, 'hex')),
          ],
          public_key: [
            ...new Uint8Array(Buffer.from(inboxKey.publicKey, 'hex')),
          ],
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
  }, []);

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
      enqueueOutbound(async () => {
        const memberSet = await messageDB.getSpaceMembers(spaceId);
        const messageSet = await messageDB.getAllSpaceMessages({ spaceId });
        const hubKey = await messageDB.getSpaceKey(spaceId, 'hub');
        const inboxKey = await messageDB.getSpaceKey(spaceId, 'inbox');
        let outbounds: string[] = [];
        const encryptionState = await messageDB.getEncryptionStates({
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
              ...new Uint8Array(Buffer.from(inboxKey.privateKey, 'hex')),
            ],
            public_key: [
              ...new Uint8Array(Buffer.from(inboxKey.publicKey, 'hex')),
            ],
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
                ...new Uint8Array(Buffer.from(inboxKey.privateKey, 'hex')),
              ],
              public_key: [
                ...new Uint8Array(Buffer.from(inboxKey.publicKey, 'hex')),
              ],
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
                ...new Uint8Array(Buffer.from(inboxKey.privateKey, 'hex')),
              ],
              public_key: [
                ...new Uint8Array(Buffer.from(inboxKey.publicKey, 'hex')),
              ],
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
    },
    []
  );

  const requestSync = React.useCallback(async (spaceId: string) => {
    try {
      enqueueOutbound(async () => {
        const hubKey = await messageDB.getSpaceKey(spaceId, 'hub');
        const inboxKey = await messageDB.getSpaceKey(spaceId, 'inbox');
        const expiry = Date.now() + 30000;
        const memberSet = await messageDB.getSpaceMembers(spaceId);
        const messageSet = await messageDB.getAllSpaceMessages({ spaceId });
        const envelope = await secureChannel.SealHubEnvelope(
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
        syncInfo.current[spaceId] = {
          expiry,
          candidates: [],
          invokable: setTimeout(() => initiateSync(spaceId), 30000),
        };
        return [JSON.stringify({ type: 'group', ...envelope })];
      });
    } catch {}
  }, []);

  const informSyncData = React.useCallback(
    async (
      spaceId: string,
      inboxAddress: string,
      messageCount: number,
      memberCount: number
    ) => {
      try {
        const inboxKey = await messageDB.getSpaceKey(spaceId, 'inbox');
        if (inboxKey && inboxKey.address != inboxAddress) {
          const memberSet = await messageDB.getSpaceMembers(spaceId);
          const messageSet = await messageDB.getAllSpaceMessages({ spaceId });
          if (
            messageCount >= messageSet.length &&
            memberCount >= memberSet.length
          ) {
            return;
          }

          enqueueOutbound(async () => {
            const hubKey = await messageDB.getSpaceKey(spaceId, 'hub');
            let outbounds: string[] = [];

            const envelope = await secureChannel.SealSyncEnvelope(
              inboxAddress,
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
                  ...new Uint8Array(Buffer.from(inboxKey.privateKey, 'hex')),
                ],
                public_key: [
                  ...new Uint8Array(Buffer.from(inboxKey.publicKey, 'hex')),
                ],
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
    },
    []
  );

  const deleteConversation = React.useCallback(
    async (conversationId: string) => {
      try {
        const [spaceId, channelId] = conversationId.split('/');
        // Delete encryption states (keys) and latest state
        const states = await messageDB.getEncryptionStates({ conversationId });
        for (const state of states) {
          await messageDB.deleteEncryptionState(state);
          // Best-effort cleanup of inbox mapping for this inbox
          if (state.inboxId) {
            await messageDB.deleteInboxMapping(state.inboxId);
          }
        }
        await messageDB.deleteLatestState(conversationId);

        // Delete all messages for this conversation and remove from indices
        await messageDB.deleteMessagesForConversation(conversationId);

        // Delete conversation users mapping and metadata
        await messageDB.deleteConversationUsers(conversationId);
        await messageDB.deleteConversation(conversationId);

        // Best-effort: remove cached user profile for counterparty
        if (spaceId && spaceId === channelId) {
          await messageDB.deleteUser(spaceId);
        }

        // Invalidate queries
        await queryClient.invalidateQueries({
          queryKey: buildMessagesKey({ spaceId, channelId }),
        });
        await queryClient.invalidateQueries({
          queryKey: buildConversationKey({ conversationId }),
        });
        await queryClient.invalidateQueries({
          queryKey: buildConversationsKey({ type: 'direct' }),
        });
      } catch (e) {
        // no-op
      }
    },
    [messageDB, queryClient]
  );

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

  const submitUpdateSpace = React.useCallback(
    async (manifest: secureChannel.SpaceManifest) => {
      try {
        enqueueOutbound(async () => {
          const hubKey = await messageDB.getSpaceKey(
            manifest.space_address,
            'hub'
          );
          const envelope = await secureChannel.SealHubEnvelope(
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
            JSON.stringify({
              type: 'control',
              message: {
                type: 'space-manifest',
                manifest: manifest,
              },
            })
          );
          return [JSON.stringify({ type: 'group', ...envelope })];
        });
      } catch {}
    },
    []
  );

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
      enqueueOutbound(async () => {
        let outbounds: string[] = [];
        const nonce = crypto.randomUUID();
        const messageId = await crypto.subtle.digest(
          'SHA-256',
          Buffer.from(
            nonce +
              'post' +
              currentPasskeyInfo.address +
              (typeof pendingMessage === 'string'
                ? pendingMessage
                : JSON.stringify(pendingMessage)),
            'utf-8'
          )
        );
        const message = {
          channelId: address!,
          spaceId: address!,
          messageId: Buffer.from(messageId).toString('hex'),
          digestAlgorithm: 'SHA-256',
          nonce: nonce,
          createdDate: Date.now(),
          modifiedDate: Date.now(),
          lastModifiedHash: '',
          content:
            typeof pendingMessage === 'string'
              ? ({
                  type: 'post',
                  senderId: currentPasskeyInfo.address,
                  text: pendingMessage,
                  repliesToMessageId: inReplyTo,
                } as PostMessage)
              : {
                  ...(pendingMessage as any),
                  senderId: currentPasskeyInfo.address,
                },
        } as Message;
        let conversationId = address + '/' + address;
        const conversation = await messageDB.getConversation({
          conversationId,
        });
        let response = await messageDB.getEncryptionStates({ conversationId });
        const inboxes = self.device_registrations
          .map((d) => d.inbox_registration.inbox_address)
          .concat(
            counterparty.device_registrations.map(
              (d) => d.inbox_registration.inbox_address
            )
          )
          .sort();
        for (const res of response) {
          if (!inboxes.includes(JSON.parse(res.state).tag)) {
            await messageDB.deleteEncryptionState(res);
          }
        }

        response = await messageDB.getEncryptionStates({ conversationId });
        let sets = response.map((e) => JSON.parse(e.state));

        let sessions: secureChannel.SealedMessageAndMetadata[] = [];
        // Sign DM unless explicitly skipped
        if (!skipSigning) {
          try {
            const sig = ch.js_sign_ed448(
              Buffer.from(
                new Uint8Array(keyset.userKeyset.user_key.private_key)
              ).toString('base64'),
              Buffer.from(messageId).toString('base64')
            );
            message.publicKey = Buffer.from(
              new Uint8Array(keyset.userKeyset.user_key.public_key)
            ).toString('hex');
            message.signature = Buffer.from(JSON.parse(sig), 'base64').toString(
              'hex'
            );
          } catch {}
        }

        for (const inbox of inboxes.filter(
          (i) => i !== keyset.deviceKeyset.inbox_keyset.inbox_address
        )) {
          const set = sets.find((s) => s.tag === inbox);
          if (set) {
            if (set.sending_inbox.inbox_public_key === '') {
              sessions = [
                ...sessions,
                ...secureChannel.DoubleRatchetInboxEncryptForceSenderInit(
                  keyset.deviceKeyset,
                  [set],
                  JSON.stringify(message),
                  self,
                  currentPasskeyInfo!.displayName,
                  currentPasskeyInfo?.pfpUrl
                ),
              ];
            } else {
              sessions = [
                ...sessions,
                ...secureChannel.DoubleRatchetInboxEncrypt(
                  keyset.deviceKeyset,
                  [set],
                  JSON.stringify(message),
                  self,
                  currentPasskeyInfo!.displayName,
                  currentPasskeyInfo?.pfpUrl
                ),
              ];
            }
          } else {
            sessions = [
              ...sessions,
              ...(await secureChannel.NewDoubleRatchetSenderSession(
                keyset.deviceKeyset,
                self.user_address,
                self.device_registrations
                  .concat(counterparty.device_registrations)
                  .find((d) => d.inbox_registration.inbox_address === inbox)!,
                JSON.stringify(message),
                currentPasskeyInfo!.displayName,
                currentPasskeyInfo?.pfpUrl
              )),
            ];
          }
        }

        for (const session of sessions) {
          const newEncryptionState: EncryptionState = {
            state: JSON.stringify({
              ratchet_state: session.ratchet_state,
              receiving_inbox: session.receiving_inbox,
              tag: session.tag,
              sending_inbox: session.sending_inbox,
            } as secureChannel.DoubleRatchetStateAndInboxKeys),
            timestamp: Date.now(),
            inboxId: session.receiving_inbox.inbox_address,
            conversationId: address! + '/' + address!,
            sentAccept: session.sent_accept,
          };
          await messageDB.saveEncryptionState(newEncryptionState, true);
          outbounds.push(
            JSON.stringify({
              type: 'listen',
              inbox_addresses: [session.receiving_inbox.inbox_address],
            })
          );
          outbounds.push(
            JSON.stringify({ type: 'direct', ...session.sealed_message })
          );
        }

        await saveMessage(message, messageDB, address!, address!, 'direct', {
          user_icon:
            conversation?.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
          display_name:
            conversation?.conversation?.displayName ?? t`Unknown User`,
        });
        await addMessage(queryClient, address, address, message);
        addOrUpdateConversation(
          queryClient,
          address,
          Date.now(),
          message.createdDate,
          {
            user_icon:
              conversation?.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
            display_name:
              conversation?.conversation?.displayName ?? 'Unknown User',
          }
        );

        return outbounds;
      });
    },
    []
  );

  const int64ToBytes = (num: number) => {
    const arr = new Uint8Array(8);
    const view = new DataView(arr.buffer);
    view.setBigInt64(0, BigInt(num), false);
    return arr;
  };

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
      const sp = ch.js_generate_ed448();
      const spacePair = JSON.parse(sp);
      const sh = await sha256.digest(
        Buffer.from(new Uint8Array(spacePair.public_key))
      );
      const spaceAddress = base58btc.baseEncode(sh.bytes);
      const cp = ch.js_generate_x448();
      const configPair = JSON.parse(cp);
      const gp = ch.js_generate_ed448();
      const groupPair = JSON.parse(gp);
      const gh = await sha256.digest(
        Buffer.from(new Uint8Array(groupPair.public_key))
      );
      const groupAddress = base58btc.baseEncode(gh.bytes);
      const hp = ch.js_generate_ed448();
      const hubPair = JSON.parse(hp);
      const hh = await sha256.digest(
        Buffer.from(new Uint8Array(hubPair.public_key))
      );
      const hubAddress = base58btc.baseEncode(hh.bytes);
      const ip = ch.js_generate_ed448();
      const inboxPair = JSON.parse(ip);
      const ih = await sha256.digest(
        Buffer.from(new Uint8Array(inboxPair.public_key))
      );
      const inboxAddress = base58btc.baseEncode(ih.bytes);
      const op = ch.js_generate_ed448();
      const ownerPair = JSON.parse(op);
      const ts = Date.now();
      const ownerPayload = Buffer.from(
        new Uint8Array([
          ...spacePair.public_key,
          ...configPair.public_key,
          ...ownerPair.public_key,
          ...int64ToBytes(ts),
        ])
      ).toString('base64');
      const spacePayload = Buffer.from(
        new Uint8Array([
          ...spacePair.public_key,
          ...configPair.public_key,
          ...ownerPair.public_key,
          ...int64ToBytes(ts),
        ])
      ).toString('base64');
      const spaceSignature = JSON.parse(
        ch.js_sign_ed448(
          Buffer.from(new Uint8Array(spacePair.private_key)).toString('base64'),
          spacePayload
        )
      );
      const ownerSignature = JSON.parse(
        ch.js_sign_ed448(
          Buffer.from(new Uint8Array(ownerPair.private_key)).toString('base64'),
          ownerPayload
        )
      );

      await apiClient.postSpace(spaceAddress, {
        space_address: spaceAddress,
        space_public_key: Buffer.from(
          new Uint8Array(spacePair.public_key)
        ).toString('hex'),
        space_signature: Buffer.from(spaceSignature, 'base64').toString('hex'),
        config_public_key: Buffer.from(
          new Uint8Array(configPair.public_key)
        ).toString('hex'),
        owner_public_keys: [
          Buffer.from(new Uint8Array(ownerPair.public_key)).toString('hex'),
        ],
        owner_signatures: [
          Buffer.from(ownerSignature, 'base64').toString('hex'),
        ],
        timestamp: ts,
      });

      const space = {
        spaceId: spaceAddress,
        spaceName: spaceName,
        description: '',
        vanityUrl: '',
        inviteUrl: '',
        iconUrl: spaceIcon,
        bannerUrl: '',
        defaultChannelId: groupAddress,
        hubAddress: hubAddress,
        createdDate: ts,
        modifiedDate: ts,
        isRepudiable: isRepudiable,
        isPublic: isPublic,
        emojis: [],
        roles: [],
        stickers: [],
        groups: [
          {
            groupName: 'Text Channels',
            channels: [
              {
                spaceId: spaceAddress,
                channelId: groupAddress,
                channelName: t`general`,
                channelTopic: t`General Chat`,
                createdDate: ts,
                modifiedDate: ts,
              },
            ],
          },
        ],
      } as Space;

      const ephemeral_key = JSON.parse(
        ch.js_generate_x448()
      ) as secureChannel.X448Keypair;
      const ciphertext = ch.js_encrypt_inbox_message(
        JSON.stringify({
          inbox_public_key: configPair.public_key,
          ephemeral_private_key: ephemeral_key.private_key,
          plaintext: [
            ...new Uint8Array(Buffer.from(JSON.stringify(space), 'utf-8')),
          ],
        } as secureChannel.SealedInboxMessageEncryptRequest)
      );

      await apiClient.postSpaceManifest(spaceAddress, {
        space_address: spaceAddress,
        space_manifest: ciphertext,
        ephemeral_public_key: Buffer.from(
          new Uint8Array(ephemeral_key.public_key)
        ).toString('hex'),
        timestamp: ts,
        owner_public_key: Buffer.from(
          new Uint8Array(ownerPair.public_key)
        ).toString('hex'),
        owner_signature: Buffer.from(
          JSON.parse(
            ch.js_sign_ed448(
              Buffer.from(new Uint8Array(ownerPair.private_key)).toString(
                'base64'
              ),
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
      });

      await apiClient.postHubAdd({
        hub_address: hubAddress,
        hub_public_key: Buffer.from(
          new Uint8Array(hubPair.public_key)
        ).toString('hex'),
        hub_signature: Buffer.from(
          JSON.parse(
            ch.js_sign_ed448(
              Buffer.from(new Uint8Array(hubPair.private_key)).toString(
                'base64'
              ),
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
                    Buffer.from(
                      'add' +
                        Buffer.from(
                          new Uint8Array(hubPair.public_key)
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
      });

      const session = await secureChannel.EstablishTripleRatchetSessionForSpace(
        keyset.userKeyset,
        keyset.deviceKeyset,
        registration
      );

      await messageDB.saveSpaceKey({
        spaceId: spaceAddress,
        keyId: 'config',
        publicKey: Buffer.from(new Uint8Array(configPair.public_key)).toString(
          'hex'
        ),
        privateKey: Buffer.from(
          new Uint8Array(configPair.private_key)
        ).toString('hex'),
      });
      await messageDB.saveSpaceKey({
        spaceId: spaceAddress,
        keyId: 'hub',
        address: hubAddress,
        publicKey: Buffer.from(new Uint8Array(hubPair.public_key)).toString(
          'hex'
        ),
        privateKey: Buffer.from(new Uint8Array(hubPair.private_key)).toString(
          'hex'
        ),
      });
      await messageDB.saveSpaceKey({
        spaceId: spaceAddress,
        keyId: 'owner',
        publicKey: Buffer.from(new Uint8Array(ownerPair.public_key)).toString(
          'hex'
        ),
        privateKey: Buffer.from(new Uint8Array(ownerPair.private_key)).toString(
          'hex'
        ),
      });
      await messageDB.saveSpaceKey({
        spaceId: spaceAddress,
        keyId: 'inbox',
        address: inboxAddress,
        publicKey: Buffer.from(new Uint8Array(inboxPair.public_key)).toString(
          'hex'
        ),
        privateKey: Buffer.from(new Uint8Array(inboxPair.private_key)).toString(
          'hex'
        ),
      });
      await messageDB.saveSpaceKey({
        spaceId: spaceAddress,
        keyId: groupAddress,
        publicKey: Buffer.from(new Uint8Array(groupPair.public_key)).toString(
          'hex'
        ),
        privateKey: Buffer.from(new Uint8Array(groupPair.private_key)).toString(
          'hex'
        ),
      });
      await messageDB.saveSpaceKey({
        spaceId: spaceAddress,
        keyId: spaceAddress,
        publicKey: Buffer.from(new Uint8Array(spacePair.public_key)).toString(
          'hex'
        ),
        privateKey: Buffer.from(new Uint8Array(spacePair.private_key)).toString(
          'hex'
        ),
      });
      await messageDB.saveSpace(space);
      await messageDB.saveSpaceMember(spaceAddress, {
        user_address: registration.user_address,
        user_icon: userIcon,
        display_name: userDisplayName,
        inbox_address: inboxAddress,
      });
      const config = await messageDB.getUserConfig({
        address: registration.user_address,
      });
      if (!config) {
        await saveConfig({
          config: {
            address: registration.user_address,
            spaceIds: [spaceAddress],
          },
          keyset,
        });
      } else {
        await saveConfig({
          config: { ...config, spaceIds: [...config.spaceIds, spaceAddress] },
          keyset,
        });
      }
      await messageDB.saveEncryptionState(
        {
          state: JSON.stringify(session),
          timestamp: ts,
          conversationId: spaceAddress + '/' + spaceAddress,
          inboxId: inboxAddress,
        },
        true
      );
      await queryClient.invalidateQueries({ queryKey: buildSpacesKey({}) });
      await queryClient.invalidateQueries({
        queryKey: buildConfigKey({ userAddress: registration.user_address }),
      });
      enqueueOutbound(async () => {
        return [
          JSON.stringify({ type: 'listen', inbox_addresses: [inboxAddress] }),
        ];
      });
      return { spaceId: spaceAddress, channelId: groupAddress };
    },
    []
  );

  const updateSpace = React.useCallback(async (space: Space) => {
    const config_key = await messageDB.getSpaceKey(space.spaceId, 'config');
    const owner_key = await messageDB.getSpaceKey(space.spaceId, 'owner');
    const ephemeral_key = JSON.parse(
      ch.js_generate_x448()
    ) as secureChannel.X448Keypair;
    const ciphertext = ch.js_encrypt_inbox_message(
      JSON.stringify({
        inbox_public_key: [
          ...new Uint8Array(Buffer.from(config_key.publicKey, 'hex')),
        ],
        ephemeral_private_key: ephemeral_key.private_key,
        plaintext: [
          ...new Uint8Array(Buffer.from(JSON.stringify(space), 'utf-8')),
        ],
      } as secureChannel.SealedInboxMessageEncryptRequest)
    );
    const ts = Date.now();
    const manifest = {
      space_address: space.spaceId,
      space_manifest: ciphertext,
      ephemeral_public_key: Buffer.from(
        new Uint8Array(ephemeral_key.public_key)
      ).toString('hex'),
      timestamp: ts,
      owner_public_key: owner_key.publicKey,
      owner_signature: Buffer.from(
        JSON.parse(
          ch.js_sign_ed448(
            Buffer.from(owner_key.privateKey, 'hex').toString('base64'),
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
    await apiClient.postSpaceManifest(space.spaceId, manifest);
    await messageDB.saveSpace(space);
    await submitUpdateSpace(manifest);
    queryClient.invalidateQueries({
      queryKey: buildSpaceKey({ spaceId: space.spaceId }),
    });
  }, []);

  const deleteSpace = React.useCallback(
    async (spaceId: string) => {
      const hubKey = await messageDB.getSpaceKey(spaceId, 'hub');
      const inboxKey = await messageDB.getSpaceKey(spaceId, 'inbox');
      const envelope = await secureChannel.SealHubEnvelope(
        hubKey.address!,
        {
          type: 'ed448',
          private_key: [
            ...new Uint8Array(Buffer.from(hubKey.privateKey, 'hex')),
          ],
          public_key: [...new Uint8Array(Buffer.from(hubKey.publicKey, 'hex'))],
        },
        JSON.stringify({
          type: 'control',
          message: {
            type: 'leave',
            inboxPublicKey: inboxKey.publicKey,
            inboxSignature: Buffer.from(
              JSON.parse(
                ch.js_sign_ed448(
                  Buffer.from(inboxKey.privateKey, 'hex').toString('base64'),
                  Buffer.from(
                    new Uint8Array([
                      ...new Uint8Array(
                        Buffer.from('delete' + hubKey.publicKey, 'utf-8')
                      ),
                    ])
                  ).toString('base64')
                )
              ),
              'base64'
            ).toString('hex'),
          },
        })
      );
      const message = JSON.stringify({ type: 'group', ...envelope });
      enqueueOutbound(async () => [message]);
      await apiClient.postHubDelete({
        hub_address: hubKey.address!,
        hub_public_key: hubKey.publicKey,
        hub_signature: Buffer.from(
          JSON.parse(
            ch.js_sign_ed448(
              Buffer.from(hubKey.privateKey, 'hex').toString('base64'),
              Buffer.from(
                new Uint8Array([
                  ...new Uint8Array(
                    Buffer.from('delete' + inboxKey.publicKey, 'utf-8')
                  ),
                ])
              ).toString('base64')
            )
          ),
          'base64'
        ).toString('hex'),
        inbox_public_key: inboxKey.publicKey,
        inbox_signature: Buffer.from(
          JSON.parse(
            ch.js_sign_ed448(
              Buffer.from(inboxKey.privateKey, 'hex').toString('base64'),
              Buffer.from(
                new Uint8Array([
                  ...new Uint8Array(
                    Buffer.from('delete' + hubKey.publicKey, 'utf-8')
                  ),
                ])
              ).toString('base64')
            )
          ),
          'base64'
        ).toString('hex'),
      });
      const states = await messageDB.getEncryptionStates({
        conversationId: spaceId + '/' + spaceId,
      });
      for (const state of states) {
        await messageDB.deleteEncryptionState(state);
      }
      const messages = await messageDB.getAllSpaceMessages({ spaceId });
      for (const message of messages) {
        await messageDB.deleteMessage(message.messageId);
      }
      const members = await messageDB.getSpaceMembers(spaceId);
      for (const member of members) {
        await messageDB.deleteSpaceMember(spaceId, member.user_address);
      }
      const keys = await messageDB.getSpaceKeys(spaceId);
      for (const key of keys) {
        await messageDB.deleteSpaceKey(spaceId, key.keyId);
      }
      let userConfig = await messageDB.getUserConfig({ address: selfAddress });
      userConfig = {
        ...(userConfig ?? { address: selfAddress }),
        spaceIds: [...(userConfig?.spaceIds.filter((s) => s != spaceId) ?? [])],
      };
      await saveConfig({
        config: userConfig,
        keyset,
      });
      await queryClient.setQueryData(
        buildConfigKey({ userAddress: selfAddress }),
        () => userConfig
      );
      await messageDB.deleteSpace(spaceId);
    },
    [selfAddress, keyset]
  );

  const kickUser = React.useCallback(
    async (
      spaceId: string,
      userAddress: string,
      user_keyset: secureChannel.UserKeyset,
      device_keyset: secureChannel.DeviceKeyset,
      registration: secureChannel.UserRegistration
    ) => {
      // Get space information to validate kick operation
      const space = await messageDB.getSpace(spaceId);
      
      // Prevent kicking the space owner
      if (!canKickUser(userAddress, space)) {
        console.error('Cannot kick space owner');
        throw new Error('Cannot kick space owner from the space');
      }

      enqueueOutbound(async () => {
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
        const space = await messageDB.getSpace(spaceId);
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
        await apiClient.postSpaceManifest(spaceId, manifest);
        let members = await messageDB.getSpaceMembers(spaceId);
        let filteredMembers = members.filter(
          (m) =>
            m.inbox_address !== '' &&
            m.inbox_address &&
            m.user_address != userAddress &&
            m.user_address != selfAddress
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
                kick: userAddress,
              },
            })
          );
          outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));
          idCounter++;
        }
        const envelope = await secureChannel.SealSyncEnvelope(
          members.find((m) => m.user_address === userAddress)!.inbox_address,
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
              type: 'kick',
              kick: userAddress,
            },
          })
        );
        outbounds.push(JSON.stringify({ type: 'sync', ...envelope }));
        const messageId = await crypto.subtle.digest(
          'SHA-256',
          Buffer.from('kick' + userAddress, 'utf-8')
        );
        const msg = {
          channelId: space!.defaultChannelId,
          spaceId: spaceId,
          messageId: Buffer.from(messageId).toString('hex'),
          digestAlgorithm: 'SHA-256',
          nonce: Buffer.from(messageId).toString('hex'),
          createdDate: Date.now(),
          modifiedDate: Date.now(),
          lastModifiedHash: '',
          content: { senderId: userAddress, type: 'kick' } as KickMessage,
        } as Message;
        await saveMessage(
          msg,
          messageDB,
          spaceId,
          space!.defaultChannelId,
          'group',
          {}
        );
        await addMessage(queryClient, spaceId, space!.defaultChannelId, msg);

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

        await apiClient.postSpaceInviteEvals(out);

        space!.inviteUrl = `https://qm.one/invite/#spaceId=${space!.spaceId}&configKey=${Buffer.from(new Uint8Array(configPair.private_key)).toString('hex')}`;
        await messageDB.saveSpace(space!);
        await queryClient.setQueryData(
          buildSpaceKey({ spaceId: space?.spaceId! }),
          space
        );

        await messageDB.saveEncryptionState(
          { ...state, state: JSON.stringify(session) },
          true
        );
        return outbounds;
      });
    },
    [selfAddress]
  );

  const ensureKeyForSpace = React.useCallback(
    async (user_address: string, space: Space) => {
      let spaceKey:
        | {
            address?: string;
            spaceId: string;
            keyId: string;
            publicKey: string;
            privateKey: string;
          }
        | undefined = undefined;
      try {
        spaceKey = await messageDB.getSpaceKey(space.spaceId, space.spaceId);
      } catch {}
      if (spaceKey) {
        return space.spaceId;
      }

      const sp = ch.js_generate_ed448();
      const spacePair = JSON.parse(sp);
      const sh = await sha256.digest(
        Buffer.from(new Uint8Array(spacePair.public_key))
      );
      const spaceAddress = base58btc.baseEncode(sh.bytes);
      const cp = ch.js_generate_x448();
      const configPair = JSON.parse(cp);
      let ownerKey: {
        address?: string;
        spaceId: string;
        keyId: string;
        publicKey: string;
        privateKey: string;
      };
      let inboxAddress = '';

      const keys = await messageDB.getSpaceKeys(space.spaceId);
      for (const key of keys) {
        await messageDB.deleteSpaceKey(space.spaceId, key.keyId);
        if (key.keyId != 'config') {
          await messageDB.saveSpaceKey({ ...key, spaceId: spaceAddress });
        }

        if (key.keyId == 'inbox') {
          inboxAddress = key.address!;
        }

        if (key.keyId.startsWith('Qm')) {
          const conversations = await messageDB.getConversations({
            type: 'group',
            limit: 100000,
          });
          for (const conv of conversations.conversations) {
            conv.conversationId =
              spaceAddress + '/' + conv.conversationId.split('/')[1];
            await messageDB.saveConversation(conv);
          }
          const messages = await messageDB.getMessages({
            spaceId: space.spaceId,
            channelId: key.keyId,
            limit: 100000,
          });
          for (const message of messages.messages) {
            await messageDB.saveMessage(
              { ...message, spaceId: spaceAddress },
              0,
              spaceAddress,
              'group',
              DefaultImages.UNKNOWN_USER,
              t`Unknown User`
            );
          }
        }

        if (key.keyId == 'owner') {
          ownerKey = key;
        }
      }

      const encryptionStates = await messageDB.getEncryptionStates({
        conversationId: space.spaceId + '/' + space.spaceId,
      });
      for (const es of encryptionStates) {
        await messageDB.deleteEncryptionState(es);
        es.conversationId = spaceAddress + '/' + spaceAddress;
        await messageDB.saveEncryptionState(es, true);
      }

      const members = await messageDB.getSpaceMembers(space.spaceId);
      for (const member of members) {
        await messageDB.deleteSpaceMember(space.spaceId, member.user_address);
        if (member.user_address == selfAddress) {
          await messageDB.saveSpaceMember(spaceAddress, {
            ...member,
            spaceId: spaceAddress,
            inbox_address: inboxAddress,
          } as any);
        } else {
          await messageDB.saveSpaceMember(spaceAddress, {
            ...member,
            spaceId: spaceAddress,
          } as any);
        }
      }

      await messageDB.saveSpaceKey({
        spaceId: spaceAddress,
        keyId: 'config',
        publicKey: Buffer.from(new Uint8Array(configPair.public_key)).toString(
          'hex'
        ),
        privateKey: Buffer.from(
          new Uint8Array(configPair.private_key)
        ).toString('hex'),
      });

      const ts = Date.now();
      const ownerPayload = Buffer.from(
        new Uint8Array([
          ...spacePair.public_key,
          ...configPair.public_key,
          ...new Uint8Array(Buffer.from(ownerKey!.publicKey, 'hex')),
          ...int64ToBytes(ts),
        ])
      ).toString('base64');
      const spacePayload = Buffer.from(
        new Uint8Array([
          ...spacePair.public_key,
          ...configPair.public_key,
          ...new Uint8Array(Buffer.from(ownerKey!.publicKey, 'hex')),
          ...int64ToBytes(ts),
        ])
      ).toString('base64');
      const spaceSignature = JSON.parse(
        ch.js_sign_ed448(
          Buffer.from(new Uint8Array(spacePair.private_key)).toString('base64'),
          spacePayload
        )
      );
      const ownerSignature = JSON.parse(
        ch.js_sign_ed448(
          Buffer.from(
            new Uint8Array(Buffer.from(ownerKey!.privateKey, 'hex'))
          ).toString('base64'),
          ownerPayload
        )
      );

      await apiClient.postSpace(spaceAddress, {
        space_address: spaceAddress,
        space_public_key: Buffer.from(
          new Uint8Array(spacePair.public_key)
        ).toString('hex'),
        space_signature: Buffer.from(spaceSignature, 'base64').toString('hex'),
        config_public_key: Buffer.from(
          new Uint8Array(configPair.public_key)
        ).toString('hex'),
        owner_public_keys: [ownerKey!.publicKey],
        owner_signatures: [
          Buffer.from(ownerSignature, 'base64').toString('hex'),
        ],
        timestamp: ts,
      });

      const config = await messageDB.getUserConfig({ address: user_address });
      config.spaceIds = config.spaceIds.map((s) =>
        s == space.spaceId ? spaceAddress : s
      );
      await saveConfig({ config, keyset });

      await messageDB.deleteSpace(space.spaceId);
      await messageDB.saveSpaceKey({
        spaceId: spaceAddress,
        keyId: spaceAddress,
        address: spaceAddress,
        publicKey: Buffer.from(new Uint8Array(spacePair.public_key)).toString(
          'hex'
        ),
        privateKey: Buffer.from(new Uint8Array(spacePair.private_key)).toString(
          'hex'
        ),
      });
      space.spaceId = spaceAddress;
      await updateSpace(space);
      const spaces = await messageDB.getSpaces();
      queryClient.setQueryData(buildSpacesKey({}), (oldData) => {
        return spaces;
      });
      queryClient.setQueryData(
        buildConfigKey({ userAddress: user_address }),
        () => {
          return config;
        }
      );
      return spaceAddress;
    },
    [keyset]
  );

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
    const link = `https://qm.one/#spaceId=${spaceId}&configKey=${config_key.privateKey}&template=${template}&secret=${secret}&hubKey=${hub_key.privateKey}`;
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

        space!.inviteUrl = `https://qm.one/invite/#spaceId=${space!.spaceId}&configKey=${Buffer.from(new Uint8Array(configPair.private_key)).toString('hex')}`;
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
    if (
      inviteLink.startsWith('https://app.quorummessenger.com/invite/#') ||
      inviteLink.startsWith('https://qm.one/#') ||
      inviteLink.startsWith('https://qm.one/invite/#') ||
      inviteLink.startsWith('app.quorummessenger.com/invite/#') ||
      inviteLink.startsWith('qm.one/#')
    ) {
      const output = inviteLink
        .split('#')[1]
        .split('&')
        .map((l) => {
          const [key, value] = l.split('=');
          if (!key || !value) {
            return undefined;
          }

          if (
            key != 'spaceId' &&
            key != 'configKey' &&
            key != 'secret' &&
            key != 'template' &&
            key != 'hubKey'
          ) {
            return undefined;
          }

          return { [key]: value };
        })
        .filter((l) => !!l)
        .reduce((prev, curr) => Object.assign(prev, curr), {});

      if (output) {
        const info = output as {
          spaceId: string;
          configKey: string;
          secret: string;
          template: string;
          hubKey: string;
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
      }
    }
    throw new Error(t`invalid link`);
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
      if (
        inviteLink.startsWith('https://app.quorummessenger.com/invite/#') ||
        inviteLink.startsWith('https://qm.one/#') ||
        inviteLink.startsWith('https://qm.one/invite/#') ||
        inviteLink.startsWith('app.quorummessenger.com/invite/#') ||
        inviteLink.startsWith('qm.one/#')
      ) {
        const output = inviteLink
          .split('#')[1]
          .split('&')
          .map((l) => {
            const [key, value] = l.split('=');
            if (!key || !value) {
              return undefined;
            }

            if (
              key != 'spaceId' &&
              key != 'configKey' &&
              key != 'secret' &&
              key != 'template' &&
              key != 'hubKey'
            ) {
              return undefined;
            }

            return { [key]: value };
          })
          .filter((l) => !!l)
          .reduce((prev, curr) => Object.assign(prev, curr), {});

        if (output) {
          const info = output as {
            spaceId: string;
            configKey: string;
            secret: string;
            template: string;
            hubKey: string;
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

            const inviteEval = await apiClient.getSpaceInviteEval(
              configPub.toString('hex')
            );
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
              Buffer.from(info.template, 'hex').toString('utf-8')
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
              Buffer.from(info.hubKey, 'hex').toString('base64')
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
          ratchet.scalar = Buffer.from(info.secret, 'hex').toString('base64');
          ratchet.point = JSON.parse(
            ch.js_get_pubkey_x448(
              Buffer.from(info.secret, 'hex').toString('base64')
            )
          );
          ratchet.random_commitment_point = JSON.parse(
            ch.js_get_pubkey_x448(
              Buffer.from(info.secret, 'hex').toString('base64')
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
                  Buffer.from(info.hubKey, 'hex').toString('base64'),
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
            privateKey: info.hubKey,
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
            publicKey: Buffer.from(
              new Uint8Array(inboxPair.public_key)
            ).toString('hex'),
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
                  Buffer.from(info.secret, 'hex').toString('base64')
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
      }
    },
    []
  );

  const createChannel = React.useCallback(async (spaceId: string) => {
    const gp = ch.js_generate_ed448();
    const groupPair = JSON.parse(gp);
    const gh = await sha256.digest(
      Buffer.from(new Uint8Array(groupPair.public_key))
    );
    const groupAddress = base58btc.baseEncode(gh.bytes);

    await messageDB.saveSpaceKey({
      spaceId: spaceId,
      keyId: groupAddress,
      publicKey: Buffer.from(new Uint8Array(groupPair.public_key)).toString(
        'hex'
      ),
      privateKey: Buffer.from(new Uint8Array(groupPair.private_key)).toString(
        'hex'
      ),
    });

    return groupAddress;
  }, []);

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
      enqueueOutbound(async () => {
        let outbounds: string[] = [];
        const nonce = crypto.randomUUID();
        const space = await messageDB.getSpace(spaceId);
        const messageId = await crypto.subtle.digest(
          'SHA-256',
          Buffer.from(
            nonce +
              'post' +
              currentPasskeyInfo.address +
              canonicalize(pendingMessage as any),
            'utf-8'
          )
        );
        const message = {
          spaceId: spaceId,
          channelId: channelId,
          messageId: Buffer.from(messageId).toString('hex'),
          digestAlgorithm: 'SHA-256',
          nonce: nonce,
          createdDate: Date.now(),
          modifiedDate: Date.now(),
          lastModifiedHash: '',
          content:
            typeof pendingMessage === 'string'
              ? ({
                  type: 'post',
                  senderId: currentPasskeyInfo.address,
                  text: pendingMessage,
                  repliesToMessageId: inReplyTo,
                } as PostMessage)
              : {
                  ...(pendingMessage as any),
                  senderId: currentPasskeyInfo.address,
                },
        } as Message;

        let conversationId = spaceId + '/' + channelId;
        const conversation = await messageDB.getConversation({
          conversationId,
        });
        let response = await messageDB.getEncryptionStates({
          conversationId: spaceId + '/' + spaceId,
        });
        const sets = response.map((e) => JSON.parse(e.state));

        // enforce non-repudiability
        if (
          (!space?.isRepudiable || (space?.isRepudiable && !skipSigning)) ||
          (typeof pendingMessage !== 'string' &&
            (pendingMessage as any).type === 'update-profile')
        ) {
          const inboxKey = await messageDB.getSpaceKey(spaceId, 'inbox');
          message.publicKey = inboxKey.publicKey;
          message.signature = Buffer.from(
            JSON.parse(
              ch.js_sign_ed448(
                Buffer.from(inboxKey.privateKey, 'hex').toString('base64'),
                Buffer.from(messageId).toString('base64')
              )
            ),
            'base64'
          ).toString('hex');
        }

        const msg = secureChannel.TripleRatchetEncrypt(
          JSON.stringify({
            ratchet_state: sets[0].state,
            message: [
              ...new Uint8Array(Buffer.from(JSON.stringify(message), 'utf-8')),
            ],
          } as secureChannel.TripleRatchetStateAndMessage)
        );
        const result = JSON.parse(
          msg
        ) as secureChannel.TripleRatchetStateAndEnvelope;
        outbounds.push(
          await sendHubMessage(
            spaceId,
            JSON.stringify({
              type: 'message',
              message: JSON.parse(result.envelope),
            })
          )
        );
        await saveMessage(message, messageDB, spaceId, channelId, 'group', {
          user_icon:
            conversation.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
          display_name:
            conversation.conversation?.displayName ?? t`Unknown User`,
        });
        await addMessage(queryClient, spaceId, channelId, message);

        return outbounds;
      });
    },
    []
  );

  const sendHubMessage = React.useCallback(
    async (spaceId: string, message: string) => {
      const hubKey = await messageDB.getSpaceKey(spaceId, 'hub');
      const envelope = await secureChannel.SealHubEnvelope(
        hubKey.address!,
        {
          type: 'ed448',
          private_key: [
            ...new Uint8Array(Buffer.from(hubKey.privateKey, 'hex')),
          ],
          public_key: [...new Uint8Array(Buffer.from(hubKey.publicKey, 'hex'))],
        },
        message
      );
      return JSON.stringify({ type: 'group', ...envelope });
    },
    []
  );

  const getConfig = React.useCallback(
    async ({
      address,
      userKey,
    }: {
      address: string;
      userKey: secureChannel.UserKeyset;
    }) => {
      let savedConfig: secureChannel.UserConfig | undefined;
      try {
        savedConfig = (await apiClient.getUserSettings(address)).data;
      } catch {}

      const storedConfig = await messageDB.getUserConfig({ address });
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

      for (const space of config.spaceKeys ?? []) {
        const existingSpace = await messageDB.getSpace(space.spaceId);
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
              await messageDB.saveSpaceKey(key);
            }

            let reg = (await apiClient.getSpace(space.spaceId)).data;
            spaceInfo.current[space.spaceId] = reg;

            const manifestPayload = await apiClient.getSpaceManifest(
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

            await messageDB.saveSpace(manifest);
            await messageDB.saveEncryptionState(
              { ...space.encryptionState, inboxId: inboxAddress },
              true
            );

            await apiClient.postHubAdd({
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

            enqueueOutbound(async () => [
              JSON.stringify({
                type: 'listen',
                inbox_addresses: [inboxAddress],
              }),
            ]);

            await messageDB.saveSpaceKey({
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

            enqueueOutbound(async () => [
              await sendHubMessage(
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

      await messageDB.saveUserConfig({
        ...config,
        timestamp: savedConfig.timestamp,
      });
      const updatedSpaces = await messageDB.getSpaces();
      await queryClient.setQueryData(buildSpacesKey({}), () => updatedSpaces);
      await queryClient.setQueryData(
        buildConfigKey({ userAddress: config.address! }),
        () => config
      );
      return config;
    },
    []
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

        const spaces = await messageDB.getSpaces();

        // Fetch all space keys and encryption states in parallel
        const spaceKeysPromises = spaces.map(async (space) => {
          const [keys, encryptionState] = await Promise.all([
            messageDB.getSpaceKeys(space.spaceId),
            messageDB.getEncryptionStates({
              conversationId: space.spaceId + '/' + space.spaceId,
            })
          ]);
          return {
            spaceId: space.spaceId,
            encryptionState: encryptionState[0],
            keys: keys,
          };
        });
        
        config.spaceKeys = await Promise.all(spaceKeysPromises);

        let iv = crypto.getRandomValues(new Uint8Array(12));
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

        await apiClient.postUserSettings(config.address, {
          user_address: config.address,
          user_public_key: Buffer.from(
            new Uint8Array(userKey.user_key.public_key)
          ).toString('hex'),
          user_config: ciphertext,
          timestamp: ts,
          signature: signature,
        });
      }

      await messageDB.saveUserConfig(config);
    },
    []
  );

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

  return (
    <MessageDBContext.Provider
      value={{
        messageDB,
        keyset,
        setKeyset,
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
  deleteConversation: () => undefined as never,
});

export { MessageDBProvider, MessageDBContext };
