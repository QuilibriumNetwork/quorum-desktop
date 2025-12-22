// MessageService.ts - Extracted from MessageDB.tsx with ZERO modifications
// This service handles message CRUD operations, encryption/decryption, and reactions

import { MessageDB, EncryptionState, EncryptedMessage } from '../db/messages';
import {
  Message,
  ReactionMessage,
  RemoveReactionMessage,
  PostMessage,
  JoinMessage,
  LeaveMessage,
  KickMessage,
  MuteMessage,
  Space,
  EditMessage,
  PinMessage,
  UpdateProfileMessage,
} from '../api/quorumApi';
import { sha256, base58btc, hexToSpreadArray } from '../utils/crypto';
import { int64ToBytes } from '../utils/bytes';
import { QueryClient, InfiniteData } from '@tanstack/react-query';
import {
  buildMessagesKey,
  buildSpaceMembersKey,
  buildSpaceKey,
  buildConfigKey,
  buildConversationsKey,
} from '../hooks';
import { buildConversationKey } from '../hooks/queries/conversation/buildConversationKey';
import {
  channel as secureChannel,
  channel_raw as ch,
} from '@quilibrium/quilibrium-js-sdk-channels';
import { t } from '@lingui/core/macro';
import { DefaultImages } from '../utils';
import { getInviteUrlBase } from '../utils/inviteDomain';
import { canonicalize } from '../utils/canonicalize';
import { QuorumApiClient } from '../api/baseTypes';
import {
  extractMentionsFromText,
  MAX_MENTIONS_PER_MESSAGE,
} from '../utils/mentionUtils';
import { MAX_MESSAGE_LENGTH } from '../utils/validation';
import { hasPermission } from '../utils/permissions';
import { showWarning, dismissToast, showPersistentToast } from '../utils/toast';
import { SimpleRateLimiter, RATE_LIMITS } from '../utils/rateLimit';
import type { ActionQueueService } from './ActionQueueService';

// Timer for dismissing sync toast after inactivity
let syncDismissTimer: NodeJS.Timeout | undefined;

// Type definitions for the service
export interface MessageServiceDependencies {
  messageDB: MessageDB;
  enqueueOutbound: (action: () => Promise<string[]>) => void;
  addOrUpdateConversation: (
    queryClient: QueryClient,
    address: string,
    timestamp: number,
    lastReadTimestamp: number,
    updatedUserProfile?: Partial<secureChannel.UserProfile>
  ) => void;
  // Additional dependencies needed by handleNewMessage
  apiClient: QuorumApiClient;
  deleteEncryptionStates: (args: { conversationId: string }) => Promise<void>;
  deleteInboxMessages: (
    inboxKeyset: any,
    timestamps: number[],
    apiClient: QuorumApiClient
  ) => Promise<void>;
  navigate: (path: string, options?: any) => void;
  spaceInfo: React.MutableRefObject<{ [key: string]: any }>;
  syncInfo: React.MutableRefObject<{ [key: string]: any }>;
  synchronizeAll: (spaceId: string, inboxAddress: string) => Promise<void>;
  informSyncData: (
    spaceId: string,
    inboxAddress: string,
    messageCount: number,
    memberCount: number
  ) => Promise<void>;
  initiateSync: (spaceId: string) => Promise<void>;
  directSync: (spaceId: string, message: any) => Promise<void>;
  saveConfig: (args: { config: any; keyset: any }) => Promise<void>;
  sendHubMessage: (spaceId: string, message: string) => Promise<string>;
}

export class MessageService {
  private messageDB: MessageDB;
  private enqueueOutbound: (action: () => Promise<string[]>) => void;
  private addOrUpdateConversation: (
    queryClient: QueryClient,
    address: string,
    timestamp: number,
    lastReadTimestamp: number,
    updatedUserProfile?: Partial<secureChannel.UserProfile>
  ) => void;
  // Additional dependencies for handleNewMessage
  private apiClient: QuorumApiClient;
  private deleteEncryptionStates: (args: {
    conversationId: string;
  }) => Promise<void>;
  private deleteInboxMessages: (
    inboxKeyset: any,
    timestamps: number[],
    apiClient: QuorumApiClient
  ) => Promise<void>;
  private navigate: (path: string, options?: any) => void;
  private spaceInfo: React.MutableRefObject<{ [key: string]: any }>;
  private syncInfo: React.MutableRefObject<{ [key: string]: any }>;
  private synchronizeAll: (
    spaceId: string,
    inboxAddress: string
  ) => Promise<void>;
  private informSyncData: (
    spaceId: string,
    inboxAddress: string,
    messageCount: number,
    memberCount: number
  ) => Promise<void>;
  private initiateSync: (spaceId: string) => Promise<void>;
  private directSync: (spaceId: string, message: any) => Promise<void>;
  private saveConfig: (args: { config: any; keyset: any }) => Promise<void>;
  private sendHubMessage: (spaceId: string, message: string) => Promise<string>;

  // Per-sender rate limiters (receiving-side defense-in-depth)
  private receivingRateLimiters = new Map<string, SimpleRateLimiter>();

  // ActionQueueService for persistent queue (optional, set via setter)
  private actionQueueService?: ActionQueueService;

  constructor(dependencies: MessageServiceDependencies) {
    this.messageDB = dependencies.messageDB;
    this.enqueueOutbound = dependencies.enqueueOutbound;
    this.addOrUpdateConversation = dependencies.addOrUpdateConversation;
    this.apiClient = dependencies.apiClient;
    this.deleteEncryptionStates = dependencies.deleteEncryptionStates;
    this.deleteInboxMessages = dependencies.deleteInboxMessages;
    this.navigate = dependencies.navigate;
    this.spaceInfo = dependencies.spaceInfo;
    this.syncInfo = dependencies.syncInfo;
    this.synchronizeAll = dependencies.synchronizeAll;
    this.informSyncData = dependencies.informSyncData;
    this.initiateSync = dependencies.initiateSync;
    this.directSync = dependencies.directSync;
    this.saveConfig = dependencies.saveConfig;
    this.sendHubMessage = dependencies.sendHubMessage;
  }

  /**
   * Set the ActionQueueService for persistent queue operations.
   * Call this after MessageService is created to avoid circular dependencies.
   */
  setActionQueueService(service: ActionQueueService): void {
    this.actionQueueService = service;
  }

  /**
   * Get sendHubMessage for use by ActionQueueHandlers
   */
  getSendHubMessage(): (spaceId: string, message: string) => Promise<string> {
    return this.sendHubMessage;
  }

  /**
   * Get encryptAndSendToSpace for use by ActionQueueHandlers.
   * Returns a bound method that can be called externally.
   */
  getEncryptAndSendToSpace(): (
    spaceId: string,
    message: Message,
    options?: { stripEphemeralFields?: boolean; saveStateAfterSend?: boolean }
  ) => Promise<string> {
    return this.encryptAndSendToSpace.bind(this);
  }

  /**
   * Encrypts a message using Triple Ratchet and sends it to a Space channel.
   * Centralizes the encryption pattern used across multiple message types.
   *
   * @param spaceId - The Space ID to send to
   * @param message - The message to encrypt and send
   * @param options - Configuration options
   * @param options.stripEphemeralFields - Remove sendStatus/sendError before encrypting (for retries)
   * @param options.saveStateAfterSend - Save encryption state after sending instead of before (for ActionQueue)
   * @returns The outbound message string from sendHubMessage
   */
  async encryptAndSendToSpace(
    spaceId: string,
    message: Message,
    options: {
      stripEphemeralFields?: boolean;
      saveStateAfterSend?: boolean;
    } = {}
  ): Promise<string> {
    const response = await this.messageDB.getEncryptionStates({
      conversationId: spaceId + '/' + spaceId,
    });
    const sets = response.map((e) => JSON.parse(e.state));

    // Strip ephemeral fields if requested (for retries)
    const messageToEncrypt = options.stripEphemeralFields
      ? (({ sendStatus: _sendStatus, sendError: _sendError, ...rest }) => rest)(message as any)
      : message;

    const msg = secureChannel.TripleRatchetEncrypt(
      JSON.stringify({
        ratchet_state: sets[0].state,
        message: [
          ...new Uint8Array(Buffer.from(JSON.stringify(messageToEncrypt), 'utf-8')),
        ],
      } as secureChannel.TripleRatchetStateAndMessage)
    );
    const result = JSON.parse(msg) as secureChannel.TripleRatchetStateAndEnvelope;

    const saveState = async () => {
      await this.messageDB.saveEncryptionState(
        {
          state: JSON.stringify({ state: result.ratchet_state }),
          timestamp: Date.now(),
          inboxId: spaceId,
          conversationId: spaceId + '/' + spaceId,
          sentAccept: false,
        },
        true
      );
    };

    if (!options.saveStateAfterSend) {
      await saveState();
    }

    const outbound = await this.sendHubMessage(
      spaceId,
      JSON.stringify({
        type: 'message',
        message: JSON.parse(result.envelope),
      })
    );

    if (options.saveStateAfterSend) {
      await saveState();
    }

    return outbound;
  }

  /**
   * Send direct message(s) via WebSocket.
   * Used by ActionQueueHandlers for DM sending.
   * @param messages Array of pre-formatted message strings to send
   */
  sendDirectMessages(messages: string[]): Promise<void> {
    return new Promise((resolve) => {
      this.enqueueOutbound(async () => {
        resolve();
        return messages;
      });
    });
  }

  /**
   * Saves message to DB and updates query cache.
   */
  async saveMessage(
    decryptedContent: Message,
    messageDB: MessageDB,
    spaceId: string,
    channelId: string,
    conversationType: string,
    updatedUserProfile: { user_icon?: string; display_name?: string }
  ) {
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

      // For DMs: Both users store messages with their partner's address as spaceId/channelId
      // So we can't do a direct comparison. Instead, check if both are DMs (spaceId == channelId)
      const isTargetDM = targetMessage.spaceId === targetMessage.channelId;
      const isRequestDM =
        decryptedContent.spaceId === decryptedContent.channelId;

      if (isTargetDM && isRequestDM) {
        // Both are DMs - this is valid even if IDs don't match exactly
        // The IDs represent conversation partners' addresses
      } else if (
        targetMessage.channelId !== decryptedContent.channelId ||
        targetMessage.spaceId !== decryptedContent.spaceId
      ) {
        // For Spaces: IDs must match exactly
        return;
      }

      // For DMs (spaceId == channelId): Always honor deletion if sender owns the target message
      if (
        targetMessage.content.senderId === decryptedContent.content.senderId
      ) {
        await messageDB.deleteMessage(decryptedContent.content.removeMessageId);
        // Don't return early - allow addMessage() to update React Query cache
      } else if (spaceId != channelId) {
        // For Spaces: Check role-based permissions
        const space = await messageDB.getSpace(spaceId);

        // For read-only channels: ISOLATED permission system - only managers can delete
        const channel = space?.groups
          ?.find((g) => g.channels.find((c) => c.channelId === channelId))
          ?.channels.find((c) => c.channelId === channelId);

        if (channel?.isReadOnly) {
          const isManager = !!(
            channel.managerRoleIds &&
            space?.roles?.some(
              (role) =>
                channel.managerRoleIds?.includes(role.roleId) &&
                role.members.includes(decryptedContent.content.senderId)
            )
          );
          if (isManager) {
            await messageDB.deleteMessage(
              decryptedContent.content.removeMessageId
            );
            // Don't return early - allow addMessage() to update React Query cache
          } else {
            // For read-only channels, if not a manager, deny delete (even if user has traditional roles)
            return;
          }
        } else {
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
          await messageDB.deleteMessage(
            decryptedContent.content.removeMessageId
          );
          // Don't return early - allow addMessage() to update React Query cache
        }
      }
    } else if (decryptedContent.content.type === 'edit-message') {
      const editMessage = decryptedContent.content as EditMessage;
      const targetMessage = await messageDB.getMessage({
        spaceId,
        channelId,
        messageId: editMessage.originalMessageId,
      });

      if (!targetMessage) {
        return;
      }

      // Only original sender can edit their message
      if (targetMessage.content.senderId !== editMessage.senderId) {
        return;
      }

      // Only allow editing post messages
      if (targetMessage.content.type !== 'post') {
        return;
      }

      // Check edit time window (15 minutes = 900000 ms)
      const editTimeWindow = 15 * 60 * 1000;
      const timeSinceCreation = Date.now() - targetMessage.createdDate;
      if (timeSinceCreation > editTimeWindow) {
        return;
      }

      // Edit message length validation (defense-in-depth)
      // Note: editedText can be string | string[], must handle both
      const editedTextContent = editMessage.editedText;
      const editedMessageText = Array.isArray(editedTextContent)
        ? editedTextContent.join('')
        : editedTextContent;

      if (editedMessageText && editedMessageText.length > MAX_MESSAGE_LENGTH) {
        return;
      }

      // Check if saveEditHistory is enabled for this conversation/space
      const isDM = spaceId === channelId;
      let saveEditHistoryEnabled = false;

      if (isDM) {
        // For DMs, check conversation setting
        const conversationId = `${spaceId}/${channelId}`;
        const conversation = await messageDB.getConversation({
          conversationId,
        });
        saveEditHistoryEnabled =
          conversation?.conversation?.saveEditHistory ?? false;
      } else {
        // For spaces, check space setting
        const space = await messageDB.getSpace(spaceId);
        saveEditHistoryEnabled = space?.saveEditHistory ?? false;
      }

      // Check if this edit has already been applied (by comparing lastModifiedHash with editNonce)
      // This prevents duplicate edits when processing the same edit message multiple times
      const isAlreadyApplied =
        targetMessage.lastModifiedHash === editMessage.editNonce;

      // Preserve current content in edits array before updating (only if saveEditHistory is enabled)
      const currentText =
        targetMessage.content.type === 'post' ? targetMessage.content.text : '';

      // Create edits array if it doesn't exist
      const existingEdits = targetMessage.edits || [];

      // Only add to edits if saveEditHistory is enabled AND this edit hasn't been applied yet
      let edits: Array<{
        text: string | string[];
        modifiedDate: number;
        lastModifiedHash: string;
      }>;

      if (isAlreadyApplied) {
        // Edit already applied: use existing edits array (don't modify)
        edits = existingEdits;
      } else if (!saveEditHistoryEnabled) {
        // saveEditHistory disabled: don't preserve edits
        edits = [];
      } else if (targetMessage.modifiedDate === targetMessage.createdDate) {
        // First edit: add original content to edits array
        edits = [
          {
            text: currentText,
            modifiedDate: targetMessage.createdDate,
            lastModifiedHash: targetMessage.nonce, // Use original nonce as hash
          },
        ];
      } else if (existingEdits.length > 0) {
        // Subsequent edits: add current version (which is now the previous version)
        edits = [
          ...existingEdits,
          {
            text: currentText,
            modifiedDate: targetMessage.modifiedDate,
            lastModifiedHash:
              targetMessage.lastModifiedHash || targetMessage.nonce,
          },
        ];
      } else {
        // Edge case: edited before but edits array is empty (shouldn't happen, but handle gracefully)
        edits = existingEdits;
      }

      // Update the original message with edited text
      const updatedMessage: Message = {
        ...targetMessage,
        modifiedDate: editMessage.editedAt,
        lastModifiedHash: editMessage.editNonce,
        content: {
          ...targetMessage.content,
          text: editMessage.editedText,
        } as PostMessage,
        edits: edits,
      };

      await messageDB.saveMessage(
        updatedMessage,
        0,
        spaceId,
        conversationType,
        updatedUserProfile.user_icon!,
        updatedUserProfile.display_name!
      );
    } else if (decryptedContent.content.type === 'pin') {
      const pinMessage = decryptedContent.content as PinMessage;
      const targetMessage = await messageDB.getMessage({
        spaceId,
        channelId,
        messageId: pinMessage.targetMessageId,
      });
      if (!targetMessage) {
        return;
      }

      // Reject DMs - pins are Space-only feature
      if (spaceId === channelId) {
        return; // Not supported
      }

      const space = await messageDB.getSpace(spaceId);
      const senderId = pinMessage.senderId;

      // For read-only channels: check manager privileges FIRST
      const channel = space?.groups
        ?.find((g) => g.channels.find((c) => c.channelId === channelId))
        ?.channels.find((c) => c.channelId === channelId);

      if (channel?.isReadOnly) {
        const isManager = !!(
          channel.managerRoleIds &&
          space?.roles?.some(
            (role) =>
              channel.managerRoleIds?.includes(role.roleId) &&
              role.members.includes(senderId)
          )
        );
        if (!isManager) {
          return; // Reject
        }
      } else {
        // For regular channels: check explicit role membership (NO isSpaceOwner bypass)
        // Space owners must assign themselves a role with message:pin permission
        const hasRolePermission = space?.roles?.some(
          (role) =>
            role.members.includes(senderId) &&
            role.permissions.includes('message:pin')
        );
        if (!hasRolePermission) {
          return; // Reject
        }
      }

      // Pin limit validation (defense-in-depth) - only check when pinning
      if (pinMessage.action === 'pin') {
        const pinnedMessages = await messageDB.getPinnedMessages(
          spaceId,
          channelId
        );
        if (pinnedMessages.length >= 50) {
          return; // Reject - pin limit reached
        }
      }

      // Update target message with pin status
      const updatedMessage: Message = {
        ...targetMessage,
        isPinned: pinMessage.action === 'pin',
        pinnedAt: pinMessage.action === 'pin' ? Date.now() : undefined,
        pinnedBy: pinMessage.action === 'pin' ? senderId : undefined,
      };

      await messageDB.saveMessage(
        updatedMessage,
        0,
        spaceId,
        conversationType,
        updatedUserProfile.user_icon!,
        updatedUserProfile.display_name!
      );
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
      // Check tombstone before saving - prevents deleted messages from being re-added during sync
      if (await messageDB.isMessageDeleted(decryptedContent.messageId)) {
        return;
      }

      await messageDB.saveMessage(
        { ...decryptedContent, channelId: channelId, spaceId: spaceId },
        0,
        spaceId,
        conversationType,
        updatedUserProfile.user_icon!,
        updatedUserProfile.display_name!
      );
    }
  }

  /**
   * Updates message send status in the query cache.
   * Used for optimistic updates when sending messages.
   * Handles race condition: if server version already replaced optimistic version,
   * the message won't have sendStatus and we skip the update.
   */
  updateMessageStatus(
    queryClient: QueryClient,
    spaceId: string,
    channelId: string,
    messageId: string,
    status: 'sent' | 'failed',
    error?: string
  ) {
    const queryKey = buildMessagesKey({ spaceId, channelId });

    queryClient.setQueryData(
      queryKey,
      (oldData: InfiniteData<any>) => {
        if (!oldData?.pages) return oldData;

        return {
          pageParams: oldData.pageParams,
          pages: oldData.pages.map((page) => ({
            ...page,
            messages: page.messages.map((msg: Message) => {
              if (msg.messageId === messageId) {
                // Only update if this is still the optimistic version (has sendStatus)
                // If server version already replaced it, sendStatus will be undefined
                if (msg.sendStatus !== undefined) {
                  return status === 'sent'
                    ? { ...msg, sendStatus: undefined, sendError: undefined }
                    : { ...msg, sendStatus: status, sendError: error };
                }
                // Server version already replaced optimistic - no action needed
                return msg;
              }
              return msg;
            }),
            nextCursor: page.nextCursor,
            prevCursor: page.prevCursor,
          })),
        };
      }
    );
  }

  /**
   * Adds message to query cache (optimistic update).
   * @param skipRateLimit - If true, skips rate limiting (used for DMs where spam is less of a concern)
   */
  async addMessage(
    queryClient: QueryClient,
    spaceId: string,
    channelId: string,
    decryptedContent: Message,
    skipRateLimit = false
  ) {
    if (decryptedContent.content.type === 'reaction') {
      const reaction = decryptedContent.content as ReactionMessage;
      queryClient.setQueryData(
        buildMessagesKey({ spaceId: spaceId, channelId: channelId }),
        (oldData: InfiniteData<any>) => {
          if (!oldData?.pages) return oldData;

          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page, _index) => {
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
            pages: oldData.pages.map((page, _index) => {
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
    } else if (decryptedContent.content.type === 'edit-message') {
      const editMessage = decryptedContent.content as EditMessage;

      queryClient.setQueryData(
        buildMessagesKey({ spaceId: spaceId, channelId: channelId }),
        (oldData: InfiniteData<any>) => {
          if (!oldData?.pages) return oldData;

          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page) => {
              return {
                ...page,
                messages: [
                  ...page.messages.map((m: Message) => {
                    if (m.messageId === editMessage.originalMessageId) {
                      // Only update if the sender matches (permission check)
                      if (m.content.senderId !== editMessage.senderId) {
                        return m;
                      }
                      // Only allow editing post messages
                      if (m.content.type !== 'post') {
                        return m;
                      }

                      // Check edit time window (15 minutes)
                      const editTimeWindow = 15 * 60 * 1000;
                      const timeSinceCreation = Date.now() - m.createdDate;
                      if (timeSinceCreation > editTimeWindow) {
                        return m;
                      }

                      // CRITICAL: Skip if this edit or a newer edit was already applied
                      // This prevents duplicates from: 1) queue processing, 2) hub echoes
                      if (m.modifiedDate >= editMessage.editedAt) {
                        return m;
                      }

                      // Keep existing edits array - optimistic update already handles it
                      const existingEdits = m.edits || [];

                      // Update the message with edited text, keeping existing edits array
                      return {
                        ...m,
                        modifiedDate: editMessage.editedAt,
                        lastModifiedHash: editMessage.editNonce,
                        content: {
                          ...m.content,
                          text: editMessage.editedText,
                        } as PostMessage,
                        edits: existingEdits,
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
    } else if (decryptedContent.content.type === 'remove-message') {
      const targetMessage = await this.messageDB.getMessage({
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
        if (
          targetMessage.content.senderId === decryptedContent.content.senderId
        ) {
          shouldHonorDelete = true;
        } else {
          if (!shouldHonorDelete && spaceId != channelId) {
            const space = await this.messageDB.getSpace(spaceId);

            // 3. Check read-only channel manager privileges
            const channel = space?.groups
              ?.find((g) => g.channels.find((c) => c.channelId === channelId))
              ?.channels.find((c) => c.channelId === channelId);

            if (channel?.isReadOnly && channel.managerRoleIds) {
              const isManager = space?.roles?.some(
                (role) =>
                  channel.managerRoleIds?.includes(role.roleId) &&
                  role.members.includes(decryptedContent.content.senderId)
              );
              if (isManager) {
                shouldHonorDelete = true;
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
              pages: oldData.pages.map((page, _index) => {
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
      }
    } else if (decryptedContent.content.type === 'pin') {
      const pinMessage = decryptedContent.content as PinMessage;

      // Reject DMs - pins are Space-only feature
      if (spaceId === channelId) {
        return; // Not supported
      }

      const space = await this.messageDB.getSpace(spaceId);
      const senderId = pinMessage.senderId;

      // Check permissions (same logic as saveMessage)
      let hasPermission = false;

      // For read-only channels: check manager privileges FIRST
      const channel = space?.groups
        ?.find((g) => g.channels.find((c) => c.channelId === channelId))
        ?.channels.find((c) => c.channelId === channelId);

      if (channel?.isReadOnly) {
        const isManager = !!(
          channel.managerRoleIds &&
          space?.roles?.some(
            (role) =>
              channel.managerRoleIds?.includes(role.roleId) &&
              role.members.includes(senderId)
          )
        );
        hasPermission = isManager;
      } else {
        // For regular channels: check explicit role membership (NO isSpaceOwner bypass)
        hasPermission = !!(
          space?.roles?.some(
            (role) =>
              role.members.includes(senderId) &&
              role.permissions.includes('message:pin')
          )
        );
      }

      if (!hasPermission) {
        return; // Reject
      }

      // Pin limit validation - only check when pinning
      if (pinMessage.action === 'pin') {
        const pinnedMessages = await this.messageDB.getPinnedMessages(
          spaceId,
          channelId
        );
        if (pinnedMessages.length >= 50) {
          return; // Reject - pin limit reached
        }
      }

      // Update React Query cache
      queryClient.setQueryData(
        buildMessagesKey({ spaceId: spaceId, channelId: channelId }),
        (oldData: InfiniteData<any>) => {
          if (!oldData?.pages) return oldData;

          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page) => {
              return {
                ...page,
                messages: [
                  ...page.messages.map((m: Message) => {
                    if (m.messageId === pinMessage.targetMessageId) {
                      return {
                        ...m,
                        isPinned: pinMessage.action === 'pin',
                        pinnedAt:
                          pinMessage.action === 'pin' ? Date.now() : undefined,
                        pinnedBy:
                          pinMessage.action === 'pin' ? senderId : undefined,
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

      // Invalidate BOTH query caches
      queryClient.invalidateQueries({
        queryKey: ['pinnedMessages', spaceId, channelId],
      });
      queryClient.invalidateQueries({
        queryKey: ['pinnedMessageCount', spaceId, channelId],
      });
    } else if (decryptedContent.content.type === 'update-profile') {
      const participant = await this.messageDB.getSpaceMember(
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
    } else if (decryptedContent.content.type === 'mute') {
      // Handle mute/unmute message - receive-side validation
      const muteContent = decryptedContent.content as MuteMessage;

      // Reject DMs - mute is Space-only feature
      if (spaceId === channelId) {
        return;
      }

      // Self-mute check (only for mute action)
      if (muteContent.action === 'mute' && muteContent.targetUserId === muteContent.senderId) {
        return;
      }

      // Fail-secure validation
      const space = await this.messageDB.getSpace(spaceId);
      if (!space) {
        return;
      }

      // Check permission - sender must have user:mute via roles
      const hasPermission = space.roles?.some(
        (role) =>
          role.members?.includes(muteContent.senderId) &&
          role.permissions?.includes('user:mute')
      );

      if (!hasPermission) {
        return;
      }

      if (muteContent.action === 'mute') {
        // Deduplication check
        const existingMute = await this.messageDB.getMuteByMuteId(muteContent.muteId);
        if (existingMute) {
          return;
        }

        // Calculate expiresAt from duration (if provided)
        const expiresAt = muteContent.duration
          ? muteContent.timestamp + muteContent.duration
          : undefined;

        // Apply mute
        await this.messageDB.muteUser(
          spaceId,
          muteContent.targetUserId,
          muteContent.senderId,
          muteContent.muteId,
          muteContent.timestamp,
          expiresAt
        );
      } else {
        // Apply unmute
        await this.messageDB.unmuteUser(spaceId, muteContent.targetUserId);
      }

      // Invalidate muted users cache
      queryClient.invalidateQueries({
        queryKey: ['mutedUsers', spaceId],
      });
    } else {
      // Read-only channel validation - must validate BEFORE adding to cache
      // Note: edit-message is handled earlier in the if-else chain (line ~310)
      const isDM = spaceId === channelId;
      const isPostMessage = decryptedContent.content.type === 'post';

      if (!isDM && isPostMessage) {
        const space = await this.messageDB.getSpace(spaceId);

        // FAIL-SECURE: Reject if space data unavailable
        if (!space) {
          console.warn(
            `⚠️ Rejecting message ${decryptedContent.messageId} - space ${spaceId} data unavailable`
          );
          return;
        }

        // Find the target channel in space groups
        const channel = space.groups
          ?.find((g) => g.channels.find((c) => c.channelId === channelId))
          ?.channels.find((c) => c.channelId === channelId);

        // FAIL-SECURE: Reject if channel not found
        if (!channel) {
          console.warn(
            `⚠️ Rejecting message ${decryptedContent.messageId} - channel ${channelId} not found in space ${spaceId}`
          );
          return;
        }

        // Validate read-only channel permissions
        if (channel.isReadOnly) {
          const senderId = decryptedContent.content.senderId;

          // Check if channel has manager roles configured
          if (!channel.managerRoleIds || channel.managerRoleIds.length === 0) {
            return;
          }

          // Check if sender is in a manager role
          // Note: Space owners must explicitly join a manager role (privacy requirement)
          const isChannelManager =
            space.roles?.some(
              (role) =>
                channel.managerRoleIds?.includes(role.roleId) &&
                role.members?.includes(senderId)
            ) ?? false;

          if (!isChannelManager) {
            return;
          }
        }
      }

      // Message length validation for post messages (defense-in-depth)
      // Note: text can be string | string[], must handle both
      // Edit-message validation is in the edit-message handler above (line ~310)
      if (isPostMessage) {
        const text = (decryptedContent.content as PostMessage).text;
        const messageText = Array.isArray(text) ? text.join('') : text;

        if (messageText && messageText.length > MAX_MESSAGE_LENGTH) {
          return;
        }
      }

      // Mention count validation (defense-in-depth)
      if (decryptedContent.mentions) {
        const totalMentions =
          (decryptedContent.mentions.memberIds?.length || 0) +
          (decryptedContent.mentions.roleIds?.length || 0) +
          (decryptedContent.mentions.channelIds?.length || 0) +
          (decryptedContent.mentions.everyone ? 1 : 0);

        if (totalMentions > MAX_MENTIONS_PER_MESSAGE) {
          return;
        }
      }

      // Receiving-side rate limit detection (defense-in-depth)
      // Skip rate limiting for DMs - spam is less of a concern in 1:1 conversations
      // and rate limiting interferes with syncing historical messages
      const senderId = decryptedContent.content.senderId;
      if (!skipRateLimit) {
        let limiter = this.receivingRateLimiters.get(senderId);
        if (!limiter) {
          limiter = new SimpleRateLimiter(
            RATE_LIMITS.RECEIVING.maxMessages,
            RATE_LIMITS.RECEIVING.windowMs
          );
          this.receivingRateLimiters.set(senderId, limiter);
        }

        const rateCheck = limiter.canSend();
        if (!rateCheck.allowed) {
          console.warn(
            `🔒 Rate limit: Message from ${senderId} rejected (flood detected). ` +
              `Message ID: ${decryptedContent.messageId}`
          );
          return; // Drop message silently (defense-in-depth)
        }
      }

      // Check if sender is muted in this space (filter muted users' messages)
      const isSenderMuted = await this.messageDB.isUserMuted(spaceId, senderId);
      if (isSenderMuted) {
        return; // Drop message silently - sender is muted
      }

      // Authorized - add to cache
      queryClient.setQueryData(
        buildMessagesKey({ spaceId: spaceId, channelId: channelId }),
        (oldData: InfiniteData<any>) => {
          if (!oldData?.pages) return oldData;

          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page, index) => {
              // Only add the new message to the most recent page
              if (index === oldData.pages.length - 1) {
                // Build new messages array with deduplication
                const newMessages = [
                  ...page.messages.filter(
                    (m: Message) => m.messageId !== decryptedContent.messageId
                  ),
                  decryptedContent,
                ];

                // Sort: pending messages ('sending') stay at end, others by createdDate
                newMessages.sort((a: Message, b: Message) => {
                  // Pending messages always go to END
                  if (
                    a.sendStatus === 'sending' &&
                    b.sendStatus !== 'sending'
                  ) {
                    return 1;
                  }
                  if (
                    b.sendStatus === 'sending' &&
                    a.sendStatus !== 'sending'
                  ) {
                    return -1;
                  }
                  // Otherwise maintain chronological order by createdDate
                  return a.createdDate - b.createdDate;
                });

                return {
                  ...page,
                  messages: newMessages,
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

    // Invalidate mention counts when a message with mentions is added
    if (
      decryptedContent.mentions?.memberIds &&
      decryptedContent.mentions.memberIds.length > 0
    ) {
      // Get user address from current passkey (we need to pass this in or get it from context)
      // For now, invalidate for the whole space to catch all potential mentions
      await queryClient.invalidateQueries({
        queryKey: ['mention-counts', spaceId],
      });
      // Also invalidate notification inbox query
      await queryClient.invalidateQueries({
        queryKey: ['mention-notifications', spaceId],
      });
      // Invalidate unread message counts when new messages arrive
      await queryClient.invalidateQueries({
        queryKey: ['unread-counts', 'channel', spaceId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['unread-counts', 'space'],
      });
    }

    // Invalidate unread counts for ALL messages (including DMs without mentions)
    // Check if this is a DM (spaceId === channelId for direct messages)
    if (spaceId === channelId) {
      // This is a direct message conversation
      await queryClient.invalidateQueries({
        queryKey: ['unread-counts', 'direct-messages'],
      });
    } else {
      // This is a channel message - invalidate channel/space unread counts
      // (only if not already done above for mentions)
      if (
        !decryptedContent.mentions?.memberIds ||
        decryptedContent.mentions.memberIds.length === 0
      ) {
        await queryClient.invalidateQueries({
          queryKey: ['unread-counts', 'channel', spaceId],
        });
        await queryClient.invalidateQueries({
          queryKey: ['unread-counts', 'space'],
        });
      }
    }
  }

  /**
   * Submits direct message: encrypts, signs, sends to API, saves locally.
   * For post messages: uses optimistic updates (message appears immediately with "Sending" status).
   */
  async submitMessage(
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
  ) {
    // Determine message type for optimistic update handling
    const isEditMessage =
      typeof pendingMessage === 'object' &&
      (pendingMessage as any).type === 'edit-message';
    const isDeleteConversation =
      typeof pendingMessage === 'object' &&
      (pendingMessage as any).type === 'delete-conversation';
    const isReaction =
      typeof pendingMessage === 'object' &&
      ((pendingMessage as any).type === 'reaction' ||
        (pendingMessage as any).type === 'remove-reaction');
    const isRemoveMessage =
      typeof pendingMessage === 'object' &&
      (pendingMessage as any).type === 'remove-message';

    // Post messages (regular text/embed) use optimistic updates
    const isPostMessage =
      typeof pendingMessage === 'string' ||
      (!isEditMessage &&
        !isDeleteConversation &&
        !isReaction &&
        !isRemoveMessage &&
        (pendingMessage as any).type !== 'remove-message');

    // For post messages: prepare and show optimistically BEFORE enqueueing
    if (isPostMessage) {
      // Generate nonce and calculate messageId
      const nonce = crypto.randomUUID();
      const messageIdBuffer = await crypto.subtle.digest(
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
      const messageIdHex = Buffer.from(messageIdBuffer).toString('hex');

      // Create message object
      const message = {
        channelId: address!,
        spaceId: address!,
        messageId: messageIdHex,
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
        reactions: [],
      } as unknown as Message;

      // Sign message BEFORE optimistic display
      if (!skipSigning) {
        try {
          const sig = ch.js_sign_ed448(
            Buffer.from(
              new Uint8Array(keyset.userKeyset.user_key.private_key)
            ).toString('base64'),
            Buffer.from(messageIdBuffer).toString('base64')
          );
          message.publicKey = Buffer.from(
            new Uint8Array(keyset.userKeyset.user_key.public_key)
          ).toString('hex');
          message.signature = Buffer.from(JSON.parse(sig), 'base64').toString(
            'hex'
          );
        } catch { /* Signature optional - continue without it */ }
      }

      // Check if we have existing encryption states for this conversation
      // If yes, use action queue (works offline). If no, use legacy path (creates new sessions).
      const conversationId = address + '/' + address;
      const existingStates = await this.messageDB.getEncryptionStates({ conversationId });
      const hasEstablishedSessions = existingStates.length > 0;

      if (hasEstablishedSessions) {
        // Add to cache with 'sending' status (optimistic update)
        await this.addMessage(queryClient, address, address, {
          ...message,
          sendStatus: 'sending',
        });

        // Queue to ActionQueue for persistent, crash-resistant delivery
        if (!this.actionQueueService) {
          throw new Error(
            'ActionQueueService not initialized. This is a bug - MessageService.setActionQueueService() must be called before sending messages.'
          );
        }
        await this.actionQueueService.enqueue(
          'send-dm',
          {
            address,
            signedMessage: message,
            messageId: messageIdHex,
            selfUserAddress: self.user_address,
            senderDisplayName: currentPasskeyInfo.displayName,
            senderUserIcon: currentPasskeyInfo.pfpUrl,
          },
          `send-dm:${address}:${messageIdHex}`
        );

        return; // Post message handling complete via action queue
      }

      // No established sessions - fall through to legacy path below
      // which will create new sessions using full self/counterparty data
    }

    // For edit-message, delete-conversation, reactions: use existing flow (no optimistic update)
    this.enqueueOutbound(async () => {
      const outbounds: string[] = [];
      const nonce = crypto.randomUUID();

      // Handle edit-message type
      if (
        typeof pendingMessage === 'object' &&
        (pendingMessage as any).type === 'edit-message'
      ) {
        const editMessage = pendingMessage as EditMessage;
        // Verify the original message exists and can be edited
        const originalMessage = await this.messageDB.getMessage({
          spaceId: address,
          channelId: address,
          messageId: editMessage.originalMessageId,
        });

        if (!originalMessage) {
          return outbounds;
        }

        // Check permissions
        if (originalMessage.content.senderId !== currentPasskeyInfo.address) {
          return outbounds;
        }

        // Only allow editing post messages
        if (originalMessage.content.type !== 'post') {
          return outbounds;
        }

        // Check edit time window (15 minutes)
        const editTimeWindow = 15 * 60 * 1000;
        const timeSinceCreation = Date.now() - originalMessage.createdDate;
        if (timeSinceCreation > editTimeWindow) {
          return outbounds;
        }

        // Create the edit message with proper structure
        const messageId = await crypto.subtle.digest(
          'SHA-256',
          Buffer.from(
            nonce +
              'edit-message' +
              currentPasskeyInfo.address +
              canonicalize(editMessage),
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
          content: {
            ...editMessage,
            senderId: currentPasskeyInfo.address,
          } as EditMessage,
        } as Message;

        const conversationId = address + '/' + address;
        const conversation = await this.messageDB.getConversation({
          conversationId,
        });
        let response = await this.messageDB.getEncryptionStates({
          conversationId,
        });
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
            await this.messageDB.deleteEncryptionState(res);
          }
        }

        response = await this.messageDB.getEncryptionStates({ conversationId });
        const sets = response.map((e) => JSON.parse(e.state));

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
          } catch { /* Signature optional - continue without it */ }
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
          await this.messageDB.saveEncryptionState(newEncryptionState, true);
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

        await this.saveMessage(
          message,
          this.messageDB,
          address!,
          address!,
          'direct',
          {
            user_icon:
              conversation?.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
            display_name:
              conversation?.conversation?.displayName ?? t`Unknown User`,
          }
        );
        await this.addMessage(queryClient, address, address, message);

        return outbounds;
      }

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
      const conversationId = address + '/' + address;
      const conversation = await this.messageDB.getConversation({
        conversationId,
      });
      let response = await this.messageDB.getEncryptionStates({
        conversationId,
      });
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
          await this.messageDB.deleteEncryptionState(res);
        }
      }

      response = await this.messageDB.getEncryptionStates({ conversationId });
      const sets = response.map((e) => JSON.parse(e.state));

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
        } catch { /* Signature optional - continue without it */ }
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
        await this.messageDB.saveEncryptionState(newEncryptionState, true);
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

      // do not save delete-conversation message
      if (message.content.type === 'delete-conversation') {
        return outbounds;
      }

      await this.saveMessage(
        message,
        this.messageDB,
        address!,
        address!,
        'direct',
        {
          user_icon:
            conversation?.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
          display_name:
            conversation?.conversation?.displayName ?? t`Unknown User`,
        }
      );
      await this.addMessage(queryClient, address, address, message);
      this.addOrUpdateConversation(
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
  }

  /**
   * Handles all incoming messages: decrypts, processes control/sync/post messages, updates state.
   */
  async handleNewMessage(
    self_address: string,
    keyset: {
      userKeyset: secureChannel.UserKeyset;
      deviceKeyset: secureChannel.DeviceKeyset;
    },
    message: EncryptedMessage,
    queryClient: QueryClient
  ) {
    const states = (await this.messageDB.getAllEncryptionStates()).reduce(
      (prev, curr) => {
        return Object.assign(prev, { [curr.inboxId]: curr });
      },
      {} as { [key: string]: EncryptionState }
    );
    const found = states[message.inboxAddress];

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

        let conversationId = session.user_address + '/' + session.user_address;

        let updatedUserProfile: secureChannel.UserProfile | undefined;
        decryptedContent = JSON.parse(session.message);

        if (session.user_address == self_address) {
          conversationId =
            decryptedContent?.channelId + '/' + decryptedContent?.channelId;
          session.user_address = decryptedContent!.channelId;
        }
        if (decryptedContent?.content?.type === 'delete-conversation') {
          await this.deleteEncryptionStates({ conversationId });
          await this.deleteInboxMessages(
            keyset.deviceKeyset.inbox_keyset,
            [envelope.timestamp],
            this.apiClient
          );
          return;
        }

        const encryptionStates = await this.messageDB.getEncryptionStates({
          conversationId,
        });
        const existing = encryptionStates.filter(
          (e) => JSON.parse(e.state).tag == session.tag
        );
        for (const e of existing) {
          await this.messageDB.deleteEncryptionState(e);
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
        this.enqueueOutbound(async () => {
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

          await this.messageDB.saveEncryptionState(newEncryptionState, true);
          const conversation = await this.messageDB.getConversation({
            conversationId,
          });
          await this.saveMessage(
            decryptedContent,
            this.messageDB,
            session.user_address,
            session.user_address,
            'direct',
            updatedUserProfile ?? {
              user_icon:
                conversation?.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
              display_name:
                conversation?.conversation?.displayName ?? t`Unknown User`,
            }
          );
          await this.addMessage(
            queryClient,
            session.user_address,
            session.user_address,
            decryptedContent
          );
          const profileToUse = updatedUserProfile ?? {
            user_icon:
              conversation?.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
            display_name:
              conversation?.conversation?.displayName ?? t`Unknown User`,
          };
          this.addOrUpdateConversation(
            queryClient,
            session.user_address,
            envelope.timestamp,
            0,
            profileToUse
          );
        } else {
          console.error(t`Failed to decrypt message with any known state`);
        }
        await this.deleteInboxMessages(
          keyset.deviceKeyset.inbox_keyset,
          [envelope.timestamp],
          this.apiClient
        );
      } catch {
        await this.deleteInboxMessages(
          keyset.deviceKeyset.inbox_keyset,
          [message.timestamp],
          this.apiClient
        );
        return;
      }
      return;
    }

    if (!found) {
      await this.deleteInboxMessages(
        keyset.deviceKeyset.inbox_keyset,
        [message.timestamp],
        this.apiClient
      );
      return;
    }

    const conversationId = found.conversationId;
    const conversation = await this.messageDB.getConversation({
      conversationId,
    });

    let decryptedContent: Message | null = null;
    let newState: string | null = null;

    const keys = JSON.parse(found.state);
    let updatedUserProfile: secureChannel.UserProfile | undefined;
    let sentAccept: boolean | undefined;
    if (keys.sending_inbox) {
      // secureChannel.DoubleRatchetStateAndInboxKeys
      if (keys.sending_inbox.inbox_public_key === '') {
        try {
          const result = await secureChannel.ConfirmDoubleRatchetSenderSession(
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
          if (decryptedContent?.content?.type === 'delete-conversation') {
            await this.deleteEncryptionStates({ conversationId });
            await this.deleteInboxMessages(
              keys.receiving_inbox,
              [message.timestamp],
              this.apiClient
            );
            return;
          }
        } catch {
          await this.deleteInboxMessages(
            keys.receiving_inbox,
            [message.timestamp],
            this.apiClient
          );
          await this.messageDB.deleteEncryptionState(found);
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
          if (
            (decryptedContent as any)?.content?.type === 'delete-conversation'
          ) {
            await this.deleteEncryptionStates({ conversationId });
            await this.deleteInboxMessages(
              keys.receiving_inbox,
              [message.timestamp],
              this.apiClient
            );
            return;
          }
        } catch {
          await this.deleteInboxMessages(
            keys.receiving_inbox,
            [message.timestamp],
            this.apiClient
          );
          await this.messageDB.deleteEncryptionState(found);
          return;
        }
      }
    } else {
      try {
        const hub_key = await this.messageDB.getSpaceKey(
          conversationId.split('/')[0],
          'hub'
        );
        const result = Buffer.from(
          new Uint8Array(
            await secureChannel.UnsealHubEnvelope(
              {
                type: 'ed448',
                public_key: hexToSpreadArray(hub_key.publicKey),
                private_key: hexToSpreadArray(hub_key.privateKey),
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
            const space = await this.messageDB.getSpace(
              conversationId.split('/')[0]
            );

            // enforce non-repudiability
            if (
              space &&
              !space.isRepudiable &&
              decryptedContent.publicKey &&
              decryptedContent.signature
            ) {
              const participant = await this.messageDB.getSpaceMember(
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
              const inboxMismatch =
                participant.inbox_address !== inboxAddress &&
                participant.inbox_address;
              const messageIdMismatch =
                decryptedContent.messageId !==
                Buffer.from(messageId).toString('hex');

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
                Buffer.from(participant.inboxPubKey, 'hex').toString('base64'),
                msg,
                participant.signature
              );
              if (result === 'true') {
                this.messageDB.saveSpaceMember(conversationId.split('/')[0], {
                  user_address: participant.address,
                  user_icon: participant.userIcon,
                  display_name: participant.displayName,
                  inbox_address: participant.inboxAddress,
                  isKicked: false,
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
                        // isKicked intentionally omitted here (defaults to false on fetch)
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
                  [Buffer.from(participant.inboxKey, 'hex').toString('base64')]:
                    participant.id,
                };
                newState = JSON.stringify({
                  ...keys,
                  state: JSON.stringify(ratchet),
                });
                const space = await this.messageDB.getSpace(
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
                await this.saveMessage(
                  msg,
                  this.messageDB,
                  conversationId.split('/')[0],
                  space!.defaultChannelId,
                  'group',
                  {}
                );
                await this.addMessage(
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
            let reg = this.spaceInfo.current[conversationId.split('/')[0]];
            if (!reg) {
              reg = (
                await this.apiClient.getSpace(conversationId.split('/')[0])
              ).data;
              this.spaceInfo.current[conversationId.split('/')[0]] = reg;
            }

            if (
              reg.owner_public_keys.includes(
                exteriorEnvelope.owner_public_key
              ) ||
              this.syncInfo.current[conversationId.split('/')[0]]
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
                  Buffer.from(exteriorEnvelope.owner_signature, 'hex').toString(
                    'base64'
                  )
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
            let reg = this.spaceInfo.current[conversationId.split('/')[0]];
            if (!reg) {
              reg = (
                await this.apiClient.getSpace(conversationId.split('/')[0])
              ).data;
              this.spaceInfo.current[conversationId.split('/')[0]] = reg;
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
                const config_key = await this.messageDB.getSpaceKey(
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
                              Buffer.from(manifest.ephemeral_public_key, 'hex')
                            ),
                          ],
                          ciphertext: ciphertext,
                        })
                      )
                    )
                  ).toString('utf-8')
                ) as Space;
                await this.messageDB.saveSpace(space);
                await queryClient.setQueryData(
                  buildSpaceKey({ spaceId: conversationId.split('/')[0] }),
                  () => {
                    return space;
                  }
                );
              }
            }
          } else if (envelope.message.type === 'leave') {
            const hubKey = await this.messageDB.getSpaceKey(
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
              const members = await this.messageDB.getSpaceMembers(
                conversationId.split('/')[0]
              );
              for (const member of members) {
                if (member.inbox_address == inboxAddress) {
                  await this.messageDB.saveSpaceMember(
                    conversationId.split('/')[0],
                    { ...member, inbox_address: '' }
                  );
                  await queryClient.setQueryData(
                    buildSpaceMembersKey({
                      spaceId: conversationId.split('/')[0],
                    }),
                    (
                      oldData: (secureChannel.UserProfile & {
                        inbox_address: string;
                        isKicked?: boolean;
                      })[]
                    ) => {
                      const previous = oldData ?? [];
                      return previous.map((m) =>
                        m.user_address === member.user_address
                          ? { ...m, inbox_address: '' }
                          : m
                      );
                    }
                  );
                  const space = await this.messageDB.getSpace(
                    conversationId.split('/')[0]
                  );

                  // Remove leaving user from all roles
                  if (space) {
                    space.roles = space.roles.map((role) => ({
                      ...role,
                      members: role.members.filter(
                        (m) => m !== member.user_address
                      ),
                    }));
                    await this.messageDB.saveSpace(space);
                  }

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
                  await this.saveMessage(
                    msg,
                    this.messageDB,
                    conversationId.split('/')[0],
                    space!.defaultChannelId,
                    'group',
                    {}
                  );
                  await this.addMessage(
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
            let reg = this.spaceInfo.current[conversationId.split('/')[0]];
            if (!reg) {
              reg = (
                await this.apiClient.getSpace(conversationId.split('/')[0])
              ).data;
              this.spaceInfo.current[conversationId.split('/')[0]] = reg;
            }
            if (
              reg.owner_public_keys.includes(exteriorEnvelope.owner_public_key)
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
                  Buffer.from(exteriorEnvelope.owner_signature, 'hex').toString(
                    'base64'
                  )
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
                await this.messageDB.saveSpaceKey({
                  spaceId: conversationId.split('/')[0],
                  keyId: 'config',
                  privateKey: inner_envelope.configKey,
                  publicKey: configPub,
                });
                const template = JSON.parse(inner_envelope.state);
                template.peer_key = Buffer.from(
                  new Uint8Array(
                    keyset.deviceKeyset.inbox_keyset.inbox_encryption_key.private_key
                  )
                ).toString('base64');
                newState = JSON.stringify({
                  ...keys,
                  state: JSON.stringify(template),
                });
                const space = await this.messageDB.getSpace(
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
                  await this.saveMessage(
                    msg,
                    this.messageDB,
                    conversationId.split('/')[0],
                    space!.defaultChannelId,
                    'group',
                    {}
                  );
                  await this.addMessage(
                    queryClient,
                    conversationId.split('/')[0],
                    space!.defaultChannelId,
                    msg
                  );
                }

                if (space?.inviteUrl) {
                  space.inviteUrl = `${getInviteUrlBase(true)}#spaceId=${space.spaceId}&configKey=${inner_envelope.configKey}`;
                  await this.messageDB.saveSpace(space);
                }
              }
            }
          } else if (envelope.message.type === 'kick') {
            let reg = this.spaceInfo.current[conversationId.split('/')[0]];
            if (!reg) {
              reg = (
                await this.apiClient.getSpace(conversationId.split('/')[0])
              ).data;
              this.spaceInfo.current[conversationId.split('/')[0]] = reg;
            }
            if (
              reg.owner_public_keys.includes(exteriorEnvelope.owner_public_key)
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
                  Buffer.from(exteriorEnvelope.owner_signature, 'hex').toString(
                    'base64'
                  )
                )
              );
              if (verify) {
                if (envelope.message.kick === self_address) {
                  const spaceId = conversationId.split('/')[0];
                  try {
                    const space = await this.messageDB.getSpace(spaceId);
                    showWarning(
                      `You've been kicked from ${space?.spaceName || spaceId}`
                    );
                  } catch { /* intentionally empty */ }
                  // Immediately navigate away from the space view when kicked
                  this.navigate('/messages', {
                    replace: true,
                    state: { from: 'kicked', spaceId },
                  });
                  const hubKey = await this.messageDB.getSpaceKey(
                    spaceId,
                    'hub'
                  );
                  const inboxKey = await this.messageDB.getSpaceKey(
                    spaceId,
                    'inbox'
                  );
                  await this.apiClient.postHubDelete({
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
                  const states = await this.messageDB.getEncryptionStates({
                    conversationId: spaceId + '/' + spaceId,
                  });
                  for (const state of states) {
                    await this.messageDB.deleteEncryptionState(state);
                  }
                  const messages = await this.messageDB.getAllSpaceMessages({
                    spaceId,
                  });
                  for (const message of messages) {
                    await this.messageDB.deleteMessage(message.messageId);
                  }
                  const members = await this.messageDB.getSpaceMembers(spaceId);
                  for (const member of members) {
                    await this.messageDB.deleteSpaceMember(
                      spaceId,
                      member.user_address
                    );
                  }
                  const keys = await this.messageDB.getSpaceKeys(spaceId);
                  for (const key of keys) {
                    await this.messageDB.deleteSpaceKey(spaceId, key.keyId);
                  }
                  let userConfig = await this.messageDB.getUserConfig({
                    address: self_address,
                  });
                  userConfig = {
                    ...(userConfig ?? { address: self_address }),
                    spaceIds: [
                      ...(userConfig?.spaceIds.filter((s) => s != spaceId) ??
                        []),
                    ],
                  };
                  await this.saveConfig({ config: userConfig, keyset });
                  await queryClient.setQueryData(
                    buildConfigKey({ userAddress: self_address }),
                    () => userConfig
                  );
                  await this.messageDB.deleteSpace(spaceId);
                  return;
                }
                // If someone else was kicked, mark them inactive locally
                if (
                  envelope.message.kick &&
                  envelope.message.kick !== self_address
                ) {
                  const spaceId = conversationId.split('/')[0];
                  const kickedAddress = envelope.message.kick;
                  const kicked = await this.messageDB.getSpaceMember(
                    spaceId,
                    kickedAddress
                  );
                  if (kicked) {
                    await this.messageDB.saveSpaceMember(spaceId, {
                      ...kicked,
                      inbox_address: '',
                    });
                    await queryClient.setQueryData(
                      buildSpaceMembersKey({ spaceId }),
                      (
                        oldData: (secureChannel.UserProfile & {
                          inbox_address: string;
                        })[]
                      ) => {
                        const previous = oldData ?? [];
                        return previous.map((m) =>
                          m.user_address === kickedAddress
                            ? { ...m, inbox_address: '' }
                            : m
                        );
                      }
                    );
                  }
                }
              }
            }
          } else if (envelope.message.type === 'sync') {
            await this.synchronizeAll(
              conversationId.split('/')[0],
              envelope.message.inboxAddress
            );
          } else if (envelope.message.type === 'sync-request') {
            if (envelope.message.expiry > Date.now()) {
              await this.informSyncData(
                conversationId.split('/')[0],
                envelope.message.inboxAddress,
                envelope.message.messageCount,
                envelope.message.memberCount
              );
            }
          } else if (envelope.message.type === 'sync-info') {
            if (
              this.syncInfo.current[conversationId.split('/')[0]] &&
              this.syncInfo.current[conversationId.split('/')[0]].expiry >
                Date.now()
            ) {
              if (
                envelope.message.inboxAddress &&
                envelope.message.messageCount &&
                envelope.message.memberCount
              ) {
                this.syncInfo.current[
                  conversationId.split('/')[0]
                ].candidates.push(envelope.message);
                // reset the timeout to be 1s to more aggressively grab viable candidates for sync instead of waiting the full 30s
                clearTimeout(
                  this.syncInfo.current[conversationId.split('/')[0]].invokable
                );
                this.syncInfo.current[conversationId.split('/')[0]].invokable =
                  setTimeout(
                    () => this.initiateSync(conversationId.split('/')[0]),
                    1000
                  );
              }
            }
          } else if (envelope.message.type === 'sync-initiate') {
            if (envelope.message.inboxAddress) {
              await this.directSync(
                conversationId.split('/')[0],
                envelope.message
              );
            }
          } else if (envelope.message.type === 'sync-members') {
            let reg = this.spaceInfo.current[conversationId.split('/')[0]];
            if (!reg) {
              reg = (
                await this.apiClient.getSpace(conversationId.split('/')[0])
              ).data;
              this.spaceInfo.current[conversationId.split('/')[0]] = reg;
            }

            if (
              reg.owner_public_keys.includes(
                exteriorEnvelope.owner_public_key
              ) ||
              this.syncInfo.current[conversationId.split('/')[0]]
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
                  Buffer.from(exteriorEnvelope.owner_signature, 'hex').toString(
                    'base64'
                  )
                )
              );
              if (verify) {
                for (const member of envelope.message.members) {
                  try {
                    const existing = await this.messageDB.getSpaceMember(
                      conversationId.split('/')[0],
                      (member as any).user_address
                    );
                    await this.messageDB.saveSpaceMember(
                      conversationId.split('/')[0],
                      {
                        ...(member as any),
                        isKicked: existing?.isKicked ?? false,
                      } as any
                    );
                  } catch {
                    await this.messageDB.saveSpaceMember(
                      conversationId.split('/')[0],
                      member as any
                    );
                  }
                }
                await queryClient.setQueryData(
                  buildSpaceMembersKey({
                    spaceId: conversationId.split('/')[0],
                  }),
                  (
                    oldData: (secureChannel.UserProfile & {
                      isKicked?: boolean;
                    })[]
                  ) => {
                    const existingMap = new Map(
                      (oldData ?? []).map((m) => [m.user_address, m])
                    );
                    const merged = (envelope.message.members as any[]).map(
                      (m) => {
                        const prev = existingMap.get(m.user_address);
                        return { ...m, isKicked: prev?.isKicked ?? false };
                      }
                    );
                    return [...(oldData ?? []), ...merged];
                  }
                );
              }
            }
          } else if (envelope.message.type === 'verify-kicked') {
            if (Array.isArray(envelope.message.addresses)) {
              const spaceId = conversationId.split('/')[0];
              for (const address of envelope.message.addresses) {
                const member = await this.messageDB.getSpaceMember(
                  spaceId,
                  address
                );
                if (member) {
                  await this.messageDB.saveSpaceMember(spaceId, {
                    ...member,
                    isKicked: true,
                  });
                }
              }
              await queryClient.setQueryData(
                buildSpaceMembersKey({ spaceId }),
                (
                  oldData: (secureChannel.UserProfile & {
                    inbox_address: string;
                    isKicked?: boolean;
                  })[]
                ) => {
                  const previous = oldData ?? [];
                  const mark = new Set(envelope.message.addresses as string[]);
                  return previous.map((m) =>
                    mark.has(m.user_address) ? { ...m, isKicked: true } : m
                  );
                }
              );
            }
          } else if (envelope.message.type === 'sync-messages') {
            let reg = this.spaceInfo.current[conversationId.split('/')[0]];
            if (!reg) {
              reg = (
                await this.apiClient.getSpace(conversationId.split('/')[0])
              ).data;
              this.spaceInfo.current[conversationId.split('/')[0]] = reg;
            }

            if (
              reg.owner_public_keys.includes(
                exteriorEnvelope.owner_public_key
              ) ||
              this.syncInfo.current[conversationId.split('/')[0]]
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
                  Buffer.from(exteriorEnvelope.owner_signature, 'hex').toString(
                    'base64'
                  )
                )
              );
              if (verify) {
                // Show toast when receiving actual sync messages (not preemptively)
                // Only show for significant syncs (>= 20 messages in this chunk)
                if (envelope.message.messages?.length >= 20) {
                  showPersistentToast('sync', t`Syncing Space...`, 'info');
                }

                const space = await this.messageDB.getSpace(
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
                    const participant = await this.messageDB.getSpaceMember(
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
                  await this.saveMessage(
                    message,
                    this.messageDB,
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

                // Reset dismiss timer on each sync chunk (5s after last chunk)
                clearTimeout(syncDismissTimer);
                syncDismissTimer = setTimeout(() => {
                  dismissToast('sync');
                }, 5000);
              }
            }
          }
        }
      } catch { /* intentionally empty */ }
    }

    if (newState) {
      const newEncryptionState: EncryptionState = {
        state: newState,
        timestamp: message.timestamp,
        inboxId: found.inboxId,
        sentAccept: sentAccept,
        conversationId: conversationId,
      };
      await this.messageDB.saveEncryptionState(newEncryptionState, true);
    }

    if (decryptedContent) {
      if (keys.sending_inbox) {
        const profileToUse = updatedUserProfile ?? {
          user_icon: conversation.conversation?.icon,
          display_name: conversation.conversation?.displayName,
        };
        await this.saveMessage(
          decryptedContent,
          this.messageDB,
          conversationId.split('/')[0],
          conversationId.split('/')[0],
          keys.sending_inbox ? 'direct' : 'group',
          profileToUse
        );
        await this.addMessage(
          queryClient,
          conversationId.split('/')[0],
          conversationId.split('/')[0],
          decryptedContent,
          true // Skip rate limiting for DMs
        );
        this.addOrUpdateConversation(
          queryClient,
          conversationId.split('/')[0],
          message.timestamp,
          conversation.conversation?.lastReadTimestamp ?? 0,
          profileToUse
        );
      } else {
        await this.saveMessage(
          decryptedContent,
          this.messageDB,
          conversationId.split('/')[0],
          decryptedContent.channelId,
          keys.sending_inbox ? 'direct' : 'group',
          updatedUserProfile ?? {
            user_icon: conversation.conversation?.icon,
            display_name: conversation.conversation?.displayName,
          }
        );
        await this.addMessage(
          queryClient,
          conversationId.split('/')[0],
          decryptedContent.channelId,
          decryptedContent
        );
      }
    }

    if (keys.sending_inbox) {
      await this.deleteInboxMessages(
        keys.receiving_inbox,
        [message.timestamp],
        this.apiClient
      );
    } else {
      const inbox_key = await this.messageDB.getSpaceKey(
        conversationId.split('/')[0],
        'inbox'
      );

      if (!inbox_key) {
        // Space was deleted, silently skip cleanup
        console.debug(
          `Skipping inbox cleanup for deleted space: ${conversationId.split('/')[0]}`
        );
        return;
      }

      await this.deleteInboxMessages(
        {
          inbox_address: inbox_key.address!,
          inbox_encryption_key: {} as never,
          inbox_key: {
            type: 'ed448',
            public_key: hexToSpreadArray(inbox_key.publicKey),
            private_key: hexToSpreadArray(inbox_key.privateKey),
          },
        },
        [message.timestamp],
        this.apiClient
      );
    }
  }

  /**
   * Sanitizes error messages for display to users.
   * Never exposes sensitive data like IP addresses, paths, or stack traces.
   */
  private sanitizeError(error: unknown): string {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('network') || msg.includes('fetch') || msg.includes('socket')) {
        return 'Network error';
      }
      if (msg.includes('encrypt') || msg.includes('ratchet') || msg.includes('crypto')) {
        return 'Encryption error';
      }
      if (msg.includes('timeout')) {
        return 'Connection timed out';
      }
    }
    return 'Failed to send message';
  }

  /**
   * Submits channel message: encrypts with triple ratchet, sends via hub, saves locally.
   * For post messages: uses optimistic updates (message appears immediately with "Sending" status).
   */
  async submitChannelMessage(
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
  ) {
    // Determine message type for optimistic update handling
    const isEditMessage =
      typeof pendingMessage === 'object' &&
      (pendingMessage as any).type === 'edit-message';
    const isPinMessage =
      typeof pendingMessage === 'object' &&
      (pendingMessage as any).type === 'pin';
    const isUpdateProfileMessage =
      typeof pendingMessage === 'object' &&
      (pendingMessage as any).type === 'update-profile';

    // Post messages (regular text messages) use optimistic updates
    const isPostMessage =
      typeof pendingMessage === 'string' ||
      (!isEditMessage && !isPinMessage && !isUpdateProfileMessage);

    // For post messages: prepare and show optimistically BEFORE enqueueing
    if (isPostMessage) {
      // Generate nonce and fetch required data (fast local operations)
      const nonce = crypto.randomUUID();
      const space = await this.messageDB.getSpace(spaceId);

      // Calculate messageId (SHA-256 hash)
      const messageIdBuffer = await crypto.subtle.digest(
        'SHA-256',
        Buffer.from(
          nonce +
            'post' +
            currentPasskeyInfo.address +
            canonicalize(pendingMessage as any),
          'utf-8'
        )
      );
      const messageIdHex = Buffer.from(messageIdBuffer).toString('hex');

      // Extract mentions
      const canUseEveryone = hasPermission(
        currentPasskeyInfo.address,
        'mention:everyone',
        space ?? undefined,
        isSpaceOwner || false
      );
      const spaceRoles =
        space?.roles
          ?.filter((r) => r.isPublic !== false)
          .map((r) => ({
            roleId: r.roleId,
            roleTag: r.roleTag,
          })) || [];
      const spaceChannels =
        space?.groups?.flatMap((g) =>
          g.channels.map((c) => ({
            channelId: c.channelId,
            channelName: c.channelName,
          }))
        ) || [];

      let mentions;
      if (typeof pendingMessage === 'string') {
        mentions = extractMentionsFromText(pendingMessage, {
          allowEveryone: canUseEveryone,
          spaceRoles,
          spaceChannels,
        });
      } else if ((pendingMessage as any).text) {
        mentions = extractMentionsFromText((pendingMessage as any).text, {
          allowEveryone: canUseEveryone,
          spaceRoles,
          spaceChannels,
        });
      }

      // Build reply metadata
      let replyMetadata:
        | { parentAuthor: string; parentChannelId: string }
        | undefined;
      if (inReplyTo && parentMessage) {
        if (parentMessage.content.senderId !== currentPasskeyInfo.address) {
          replyMetadata = {
            parentAuthor: parentMessage.content.senderId,
            parentChannelId: channelId,
          };
        }
      }

      // Create message object
      const message = {
        spaceId: spaceId,
        channelId: channelId,
        messageId: messageIdHex,
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
        mentions:
          mentions &&
          (mentions.memberIds.length > 0 ||
            mentions.roleIds.length > 0 ||
            mentions.channelIds.length > 0 ||
            mentions.everyone)
            ? mentions
            : undefined,
        replyMetadata,
        reactions: [],
      } as Message;

      // Sign message BEFORE optimistic display (non-repudiability requirement)
      if (!space?.isRepudiable || (space?.isRepudiable && !skipSigning)) {
        const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');
        message.publicKey = inboxKey.publicKey;
        message.signature = Buffer.from(
          JSON.parse(
            ch.js_sign_ed448(
              Buffer.from(inboxKey.privateKey, 'hex').toString('base64'),
              Buffer.from(messageIdBuffer).toString('base64')
            )
          ),
          'base64'
        ).toString('hex');
      }

      // Add to cache with 'sending' status (optimistic update)
      await this.addMessage(queryClient, spaceId, channelId, {
        ...message,
        sendStatus: 'sending',
      });

      // Queue to ActionQueue for persistent, crash-resistant delivery
      if (!this.actionQueueService) {
        throw new Error(
          'ActionQueueService not initialized. This is a bug - MessageService.setActionQueueService() must be called before sending messages.'
        );
      }
      await this.actionQueueService.enqueue(
        'send-channel-message',
        {
          spaceId,
          channelId,
          signedMessage: message,
          messageId: messageIdHex,
          replyMetadata: message.replyMetadata,
        },
        `send:${spaceId}:${channelId}:${messageIdHex}`
      );

      return; // Post message handling complete
    }

    // For edit-message, pin-message, and update-profile: use existing flow (no optimistic update)
    this.enqueueOutbound(async () => {
      const outbounds: string[] = [];
      const nonce = crypto.randomUUID();
      const space = await this.messageDB.getSpace(spaceId);

      // Handle edit-message type
      if (
        typeof pendingMessage === 'object' &&
        (pendingMessage as any).type === 'edit-message'
      ) {
        const editMessage = pendingMessage as EditMessage;
        // Verify the original message exists and can be edited
        const originalMessage = await this.messageDB.getMessage({
          spaceId,
          channelId,
          messageId: editMessage.originalMessageId,
        });

        if (!originalMessage) {
          return outbounds;
        }

        // Check permissions
        if (originalMessage.content.senderId !== currentPasskeyInfo.address) {
          return outbounds;
        }

        // Only allow editing post messages
        if (originalMessage.content.type !== 'post') {
          return outbounds;
        }

        // Check edit time window (15 minutes)
        const editTimeWindow = 15 * 60 * 1000;
        const timeSinceCreation = Date.now() - originalMessage.createdDate;
        if (timeSinceCreation > editTimeWindow) {
          return outbounds;
        }

        // Create the edit message with proper structure
        const messageId = await crypto.subtle.digest(
          'SHA-256',
          Buffer.from(
            nonce +
              'edit-message' +
              currentPasskeyInfo.address +
              canonicalize(editMessage),
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
          content: {
            ...editMessage,
            senderId: currentPasskeyInfo.address,
          } as EditMessage,
        } as Message;

        const conversationId = spaceId + '/' + channelId;
        const conversation = await this.messageDB.getConversation({
          conversationId,
        });

        // enforce non-repudiability
        if (!space?.isRepudiable || (space?.isRepudiable && !skipSigning)) {
          const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');
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

        outbounds.push(await this.encryptAndSendToSpace(spaceId, message));
        await this.saveMessage(
          message,
          this.messageDB,
          spaceId,
          channelId,
          'group',
          {
            user_icon:
              conversation.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
            display_name:
              conversation.conversation?.displayName ?? t`Unknown User`,
          }
        );
        await this.addMessage(queryClient, spaceId, channelId, message);

        return outbounds;
      }

      // Handle pin-message type
      if (
        typeof pendingMessage === 'object' &&
        (pendingMessage as any).type === 'pin'
      ) {
        const pinMessage = pendingMessage as PinMessage;

        // Reject DMs - pins are Space-only feature
        if (spaceId === channelId) {
          return outbounds;
        }

        // Validate permissions (same logic as saveMessage/addMessage)
        let hasPermission = false;

        // For read-only channels: check manager privileges FIRST
        const channel = space?.groups
          ?.find((g) => g.channels.find((c) => c.channelId === channelId))
          ?.channels.find((c) => c.channelId === channelId);

        if (channel?.isReadOnly) {
          const isManager = !!(
            channel.managerRoleIds &&
            space?.roles?.some(
              (role) =>
                channel.managerRoleIds?.includes(role.roleId) &&
                role.members.includes(currentPasskeyInfo.address)
            )
          );
          hasPermission = isManager;
        } else {
          // For regular channels: check explicit role membership (NO isSpaceOwner bypass)
          hasPermission = !!(
            space?.roles?.some(
              (role) =>
                role.members.includes(currentPasskeyInfo.address) &&
                role.permissions.includes('message:pin')
            )
          );
        }

        if (!hasPermission) {
          return outbounds;
        }

        // Generate message ID using SHA-256(nonce + 'pin' + senderId + canonicalize(pinMessage))
        const messageId = await crypto.subtle.digest(
          'SHA-256',
          Buffer.from(
            nonce +
              'pin' +
              currentPasskeyInfo.address +
              canonicalize(pinMessage),
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
          content: {
            ...pinMessage,
            senderId: currentPasskeyInfo.address,
          } as PinMessage,
        } as Message;

        const conversationId = spaceId + '/' + channelId;
        const conversation = await this.messageDB.getConversation({
          conversationId,
        });

        // Enforce non-repudiability
        if (!space?.isRepudiable || (space?.isRepudiable && !skipSigning)) {
          const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');
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

        outbounds.push(await this.encryptAndSendToSpace(spaceId, message));
        await this.saveMessage(
          message,
          this.messageDB,
          spaceId,
          channelId,
          'group',
          {
            user_icon:
              conversation.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
            display_name:
              conversation.conversation?.displayName ?? t`Unknown User`,
          }
        );
        await this.addMessage(queryClient, spaceId, channelId, message);

        return outbounds;
      }

      // Handle update-profile type
      if (
        typeof pendingMessage === 'object' &&
        (pendingMessage as any).type === 'update-profile'
      ) {
        const updateProfileMessage = pendingMessage as UpdateProfileMessage;

        // Generate message ID
        const messageId = await crypto.subtle.digest(
          'SHA-256',
          Buffer.from(
            nonce +
              'update-profile' +
              currentPasskeyInfo.address +
              canonicalize(updateProfileMessage),
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
          content: {
            ...updateProfileMessage,
            senderId: currentPasskeyInfo.address,
          } as UpdateProfileMessage,
        } as Message;

        // Enforce non-repudiability (required for profile updates to verify sender)
        const inboxKey = await this.messageDB.getSpaceKey(spaceId, 'inbox');
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

        // Send to hub
        outbounds.push(await this.encryptAndSendToSpace(spaceId, message));

        // Update local database immediately (don't wait for server echo)
        // This ensures the profile change is visible right away
        const participant = await this.messageDB.getSpaceMember(
          spaceId,
          currentPasskeyInfo.address
        );
        if (participant) {
          participant.display_name = updateProfileMessage.displayName;
          participant.user_icon = updateProfileMessage.userIcon;
          await this.messageDB.saveSpaceMember(spaceId, participant);

          // Update query cache for immediate UI refresh
          queryClient.setQueryData(
            buildSpaceMembersKey({ spaceId }),
            (oldData: secureChannel.UserProfile[]) => {
              if (!oldData) return oldData;
              return oldData.map((member) =>
                member.user_address === currentPasskeyInfo.address
                  ? {
                      ...member,
                      display_name: updateProfileMessage.displayName,
                      user_icon: updateProfileMessage.userIcon,
                    }
                  : member
              );
            }
          );
        }

        return outbounds;
      }

      // No matching message type in this path
      return outbounds;
    });
  }

  /**
   * Retries sending a failed message.
   * Re-uses the same signed message (messageId preserved) with fresh encryption.
   */
  async retryMessage(
    spaceId: string,
    channelId: string,
    failedMessage: Message,
    queryClient: QueryClient
  ) {
    // Validate message is in 'failed' state
    if (failedMessage.sendStatus !== 'failed') {
      console.warn('Cannot retry message that is not in failed state');
      return;
    }

    // Update status to 'sending' (optimistic)
    queryClient.setQueryData(
      buildMessagesKey({ spaceId, channelId }),
      (oldData: InfiniteData<any>) => {
        if (!oldData?.pages) return oldData;
        return {
          pageParams: oldData.pageParams,
          pages: oldData.pages.map((page) => ({
            ...page,
            messages: page.messages.map((msg: Message) =>
              msg.messageId === failedMessage.messageId
                ? { ...msg, sendStatus: 'sending' as const, sendError: undefined }
                : msg
            ),
            nextCursor: page.nextCursor,
            prevCursor: page.prevCursor,
          })),
        };
      }
    );

    // Enqueue the retry
    this.enqueueOutbound(async () => {
      const outbounds: string[] = [];
      try {
        // Get conversation for user profile info
        const conversationId = spaceId + '/' + channelId;
        const conversation = await this.messageDB.getConversation({
          conversationId,
        });

        // Triple Ratchet encrypt with fresh envelope (strips ephemeral fields)
        outbounds.push(
          await this.encryptAndSendToSpace(spaceId, failedMessage, {
            stripEphemeralFields: true,
          })
        );

        // Strip ephemeral fields for saving to IndexedDB
        const {
          sendStatus: _sendStatus,
          sendError: _sendError,
          ...messageToEncrypt
        } = failedMessage;

        // Save to IndexedDB (without sendStatus/sendError)
        await this.saveMessage(
          messageToEncrypt as Message,
          this.messageDB,
          spaceId,
          channelId,
          'group',
          {
            user_icon:
              conversation.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
            display_name:
              conversation.conversation?.displayName ?? t`Unknown User`,
          }
        );

        // Update status to 'sent'
        this.updateMessageStatus(
          queryClient,
          spaceId,
          channelId,
          failedMessage.messageId,
          'sent'
        );

        return outbounds;
      } catch (error) {
        // Revert status to 'failed' with updated error
        const sanitizedError = this.sanitizeError(error);
        this.updateMessageStatus(
          queryClient,
          spaceId,
          channelId,
          failedMessage.messageId,
          'failed',
          sanitizedError
        );
        console.error('Retry failed:', error);
        return outbounds;
      }
    });
  }

  /**
   * Retries sending a failed direct message.
   * Re-uses the same signed message (messageId preserved) with fresh encryption.
   */
  async retryDirectMessage(
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
  ) {
    // Validate message is in 'failed' state
    if (failedMessage.sendStatus !== 'failed') {
      console.warn('Cannot retry message that is not in failed state');
      return;
    }

    // Update status to 'sending' (optimistic)
    queryClient.setQueryData(
      buildMessagesKey({ spaceId: address, channelId: address }),
      (oldData: InfiniteData<any>) => {
        if (!oldData?.pages) return oldData;
        return {
          pageParams: oldData.pageParams,
          pages: oldData.pages.map((page) => ({
            ...page,
            messages: page.messages.map((msg: Message) =>
              msg.messageId === failedMessage.messageId
                ? { ...msg, sendStatus: 'sending' as const, sendError: undefined }
                : msg
            ),
            nextCursor: page.nextCursor,
            prevCursor: page.prevCursor,
          })),
        };
      }
    );

    // Enqueue the retry
    this.enqueueOutbound(async () => {
      const outbounds: string[] = [];
      try {
        const conversationId = address + '/' + address;
        const conversation = await this.messageDB.getConversation({
          conversationId,
        });
        let response = await this.messageDB.getEncryptionStates({
          conversationId,
        });
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
            await this.messageDB.deleteEncryptionState(res);
          }
        }

        response = await this.messageDB.getEncryptionStates({ conversationId });
        const sets = response.map((e) => JSON.parse(e.state));

        let sessions: secureChannel.SealedMessageAndMetadata[] = [];

        // Strip ephemeral fields before encrypting
        const { sendStatus: _sendStatus, sendError: _sendError, ...messageToEncrypt } = failedMessage;

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
                  JSON.stringify(messageToEncrypt),
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
                  JSON.stringify(messageToEncrypt),
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
                JSON.stringify(messageToEncrypt),
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
            conversationId: address + '/' + address,
            sentAccept: session.sent_accept,
          };
          await this.messageDB.saveEncryptionState(newEncryptionState, true);
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

        // Save to IndexedDB (without sendStatus/sendError)
        await this.saveMessage(
          messageToEncrypt as Message,
          this.messageDB,
          address,
          address,
          'direct',
          {
            user_icon:
              conversation?.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
            display_name:
              conversation?.conversation?.displayName ?? t`Unknown User`,
          }
        );

        // Update status to 'sent'
        this.updateMessageStatus(
          queryClient,
          address,
          address,
          failedMessage.messageId,
          'sent'
        );

        return outbounds;
      } catch (error) {
        // Revert status to 'failed' with updated error
        const sanitizedError = this.sanitizeError(error);
        this.updateMessageStatus(
          queryClient,
          address,
          address,
          failedMessage.messageId,
          'failed',
          sanitizedError
        );
        console.error('Retry DM failed:', error);
        return outbounds;
      }
    });
  }

  /**
   * Deletes conversation: removes messages, encryption states, updates cache.
   */
  async deleteConversation(
    conversationId: string,
    currentPasskeyInfo: {
      credentialId: string;
      address: string;
      publicKey: string;
      displayName?: string;
      pfpUrl?: string;
      completedOnboarding: boolean;
    },
    queryClient: QueryClient,
    keyset: {
      deviceKeyset: secureChannel.DeviceKeyset;
      userKeyset: secureChannel.UserKeyset;
    },
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
        deviceKeyset: secureChannel.DeviceKeyset;
        userKeyset: secureChannel.UserKeyset;
      },
      inReplyTo?: string,
      skipSigning?: boolean
    ) => Promise<void>
  ) {
    try {
      const [spaceId, channelId] = conversationId.split('/');
      // Notify counterparty for direct conversations before local deletion
      if (spaceId && channelId && spaceId === channelId) {
        try {
          const counterparty = await this.apiClient.getUser(spaceId);

          if (currentPasskeyInfo?.address) {
            const self = await this.apiClient.getUser(
              currentPasskeyInfo?.address!
            );
            await submitMessage(
              spaceId,
              { type: 'delete-conversation' },
              self.data,
              counterparty.data,
              queryClient,
              currentPasskeyInfo,
              keyset,
              undefined,
              false
            );
          }
        } catch { /* Best effort notification - deletion still proceeds */ }
      }
      // Delete encryption states (keys) and latest state
      const states = await this.messageDB.getEncryptionStates({
        conversationId,
      });
      for (const state of states) {
        await this.messageDB.deleteEncryptionState(state);
        // Best-effort cleanup of inbox mapping for this inbox
        if (state.inboxId) {
          await this.messageDB.deleteInboxMapping(state.inboxId);
        }
      }
      await this.messageDB.deleteLatestState(conversationId);

      // Delete all messages for this conversation and remove from indices
      await this.messageDB.deleteMessagesForConversation(conversationId);

      // Delete conversation users mapping and metadata
      await this.messageDB.deleteConversationUsers(conversationId);
      await this.messageDB.deleteConversation(conversationId);

      // Best-effort: remove cached user profile for counterparty
      if (spaceId && spaceId === channelId) {
        await this.messageDB.deleteUser(spaceId);
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
    } catch {
      // no-op
    }
  }
}
