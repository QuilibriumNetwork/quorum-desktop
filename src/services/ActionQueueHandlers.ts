/**
 * ActionQueueHandlers - Task Handlers for Background Queue
 *
 * Each handler defines:
 * - execute: The actual work to perform
 * - isPermanentError: Determines if error is retryable
 * - successMessage/failureMessage: Optional toast feedback
 *
 * Toast Strategy:
 * - Messages use inline indicator (no toast)
 * - Config saves are silent on success
 * - Space updates show success/failure
 * - Moderation shows success/failure
 *
 * See: .agents/tasks/background-action-queue.md
 */

import { t } from '@lingui/core/macro';
import type { MessageDB } from '../db/messages';
import type { MessageService } from './MessageService';
import type { ConfigService } from './ConfigService';
import type { SpaceService } from './SpaceService';
import type { QueryClient, InfiniteData } from '@tanstack/react-query';
import type { ActionType } from '../types/actionQueue';
import { buildMessagesKey } from '../hooks/queries/messages/buildMessagesKey';
import { channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import type { Message } from '../api/quorumApi';
import { DefaultImages } from '../utils';

export interface HandlerDependencies {
  messageDB: MessageDB;
  messageService: MessageService;
  configService: ConfigService;
  spaceService: SpaceService;
  queryClient: QueryClient;
}

export interface TaskHandler {
  execute: (context: Record<string, unknown>) => Promise<void>;
  isPermanentError: (error: Error) => boolean;
  /** Called when task fails permanently (after all retries or permanent error) */
  onFailure?: (context: Record<string, unknown>, error: Error) => void;
  successMessage?: string; // Only show toast if defined
  failureMessage?: string; // Only show toast if defined
}

/**
 * Class-based handlers for action queue tasks.
 * Groups all handlers with shared dependencies.
 */
export class ActionQueueHandlers {
  constructor(private deps: HandlerDependencies) {}

  // === CORE ACTIONS ===

  /**
   * Save user config (folders, sidebar order, preferences)
   * Silent success, only show on failure
   */
  private saveUserConfig: TaskHandler = {
    execute: async (context) => {
      await this.deps.configService.saveConfig({
        config: context.config as any,
        keyset: context.keyset as any,
      });
    },
    isPermanentError: (error) => {
      return (
        error.message.toLowerCase().includes('validation') ||
        error.message.toLowerCase().includes('invalid')
      );
    },
    successMessage: undefined,
    failureMessage: t`Failed to save settings`,
  };

  /**
   * Update space settings (name, description, roles, emojis, stickers)
   */
  private updateSpace: TaskHandler = {
    execute: async (context) => {
      // Check if space still exists
      const space = await this.deps.messageDB.getSpace(context.spaceId as string);
      if (!space) {
        console.log(
          `[ActionQueue] Discarding update for deleted space: ${context.spaceId}`
        );
        return;
      }
      await this.deps.spaceService.updateSpace(
        context.space as any,
        this.deps.queryClient
      );
    },
    isPermanentError: (error) => {
      return (
        error.message.toLowerCase().includes('permission') ||
        error.message.includes('403') ||
        error.message.toLowerCase().includes('not found')
      );
    },
    successMessage: undefined, // Silent success
    failureMessage: t`Failed to save space settings`,
  };

  // === MODERATION ACTIONS ===

  /**
   * Kick a user from a space
   */
  private kickUser: TaskHandler = {
    execute: async (context) => {
      // Check if user still in space (may have left while offline)
      const members = await this.deps.messageDB.getSpaceMembers(
        context.spaceId as string
      );
      const userStillPresent = members?.some(
        (m) => m.user_address === context.userAddress
      );
      if (!userStillPresent) {
        console.log('[ActionQueue] User already left space, skipping kick');
        return;
      }
      await this.deps.spaceService.kickUser(
        context.spaceId as string,
        context.userAddress as string,
        context.user_keyset as any,
        context.device_keyset as any,
        context.registration as any,
        this.deps.queryClient
      );
      this.deps.queryClient.invalidateQueries({
        queryKey: ['space', context.spaceId],
      });
    },
    isPermanentError: (error) => {
      return (
        error.message.toLowerCase().includes('permission') ||
        error.message.includes('403') ||
        error.message.toLowerCase().includes('not found')
      );
    },
    successMessage: undefined, // Silent success
    failureMessage: t`Failed to kick user`,
  };

  /**
   * Mute a user in a space
   */
  private muteUser: TaskHandler = {
    execute: async (context) => {
      await this.deps.messageService.submitChannelMessage(
        context.spaceId as string,
        context.channelId as string,
        context.muteMessage as any,
        this.deps.queryClient,
        context.currentPasskeyInfo as any
      );
      this.deps.queryClient.invalidateQueries({
        queryKey: ['mutedUsers', context.spaceId],
      });
    },
    isPermanentError: (error) => {
      return (
        error.message.toLowerCase().includes('permission') ||
        error.message.includes('403')
      );
    },
    successMessage: undefined, // Silent success
    failureMessage: t`Failed to mute user`,
  };

  /**
   * Unmute a user in a space
   */
  private unmuteUser: TaskHandler = {
    execute: async (context) => {
      await this.deps.messageService.submitChannelMessage(
        context.spaceId as string,
        context.channelId as string,
        context.unmuteMessage as any,
        this.deps.queryClient,
        context.currentPasskeyInfo as any
      );
      this.deps.queryClient.invalidateQueries({
        queryKey: ['mutedUsers', context.spaceId],
      });
    },
    isPermanentError: (error) => {
      return (
        error.message.toLowerCase().includes('permission') ||
        error.message.includes('403')
      );
    },
    successMessage: undefined, // Silent success
    failureMessage: t`Failed to unmute user`,
  };

  // === MESSAGE ACTIONS ===

  /**
   * Add a reaction to a message
   * Silent - non-critical action
   */
  private reaction: TaskHandler = {
    execute: async (context) => {
      // Reactions are idempotent - re-adding same reaction is fine
      await this.deps.messageService.submitChannelMessage(
        context.spaceId as string,
        context.channelId as string,
        context.reactionMessage as any,
        this.deps.queryClient,
        context.currentPasskeyInfo as any
      );
    },
    isPermanentError: (error) => {
      return error.message.includes('404'); // Message deleted
    },
    successMessage: undefined,
    failureMessage: undefined,
  };

  /**
   * Pin a message
   */
  private pinMessage: TaskHandler = {
    execute: async (context) => {
      const message = await this.deps.messageDB.getMessageById(
        context.messageId as string
      );
      if (!message) return; // Message deleted - skip silently

      await this.deps.messageService.submitChannelMessage(
        context.spaceId as string,
        context.channelId as string,
        context.pinMessage as any,
        this.deps.queryClient,
        context.currentPasskeyInfo as any
      );
    },
    isPermanentError: (error) => error.message.includes('404'),
    successMessage: undefined,
    failureMessage: t`Failed to pin message`,
  };

  /**
   * Unpin a message
   */
  private unpinMessage: TaskHandler = {
    execute: async (context) => {
      await this.deps.messageService.submitChannelMessage(
        context.spaceId as string,
        context.channelId as string,
        context.unpinMessage as any,
        this.deps.queryClient,
        context.currentPasskeyInfo as any
      );
    },
    isPermanentError: (error) => error.message.includes('404'),
    successMessage: undefined,
    failureMessage: t`Failed to unpin message`,
  };

  /**
   * Edit a message
   */
  private editMessage: TaskHandler = {
    execute: async (context) => {
      const editMsg = context.editMessage as { editedAt: number; editedText: string | string[] };
      console.log(`[ActionQueue:editMessage] START - messageId=${context.messageId}, editedAt=${editMsg.editedAt}`);

      const message = await this.deps.messageDB.getMessageById(
        context.messageId as string
      );

      if (!message) {
        console.log(`[ActionQueue:editMessage] Message not found, skipping`);
        return;
      }

      console.log(`[ActionQueue:editMessage] Current message state:`, {
        modifiedDate: message.modifiedDate,
        lastModifiedHash: message.lastModifiedHash,
        editsCount: message.edits?.length || 0,
        currentText: message.content.type === 'post' ? String(message.content.text).substring(0, 50) : 'N/A',
      });

      console.log(`[ActionQueue:editMessage] Processing edit, calling submitChannelMessage`);
      await this.deps.messageService.submitChannelMessage(
        context.spaceId as string,
        context.channelId as string,
        context.editMessage as any,
        this.deps.queryClient,
        context.currentPasskeyInfo as any
      );
      console.log(`[ActionQueue:editMessage] END`);
    },
    isPermanentError: (error) => error.message.includes('404'),
    successMessage: undefined,
    failureMessage: t`Failed to edit message`,
  };

  /**
   * Delete a message
   * Idempotent - if already deleted, that's success
   */
  private deleteMessage: TaskHandler = {
    execute: async (context) => {
      try {
        await this.deps.messageService.submitChannelMessage(
          context.spaceId as string,
          context.channelId as string,
          context.deleteMessage as any,
          this.deps.queryClient,
          context.currentPasskeyInfo as any
        );
      } catch (err: any) {
        if (err.message?.includes('404')) return; // Already deleted
        throw err;
      }
    },
    isPermanentError: () => false, // Always retry (or silently succeed)
    successMessage: undefined,
    failureMessage: t`Failed to delete message`,
  };

  // === NEW: Signed Message Handlers (for ActionQueue integration) ===

  /**
   * Send a channel message that's already signed.
   * Receives the complete signed Message object, encrypts with Triple Ratchet, and sends.
   * This handler is for messages where signing + optimistic display happened BEFORE queueing.
   *
   * Context expected:
   * - spaceId: string
   * - channelId: string
   * - signedMessage: Message (already signed, with sendStatus: 'sending')
   * - messageId: string
   * - replyMetadata?: { parentAuthor, parentChannelId }
   */
  private sendChannelMessage: TaskHandler = {
    execute: async (context) => {
      const spaceId = context.spaceId as string;
      const channelId = context.channelId as string;
      const signedMessage = context.signedMessage as Message;
      const messageId = context.messageId as string;

      // Check if space/channel still exists
      const space = await this.deps.messageDB.getSpace(spaceId);
      if (!space) {
        console.log(`[ActionQueue] Discarding message for deleted space: ${spaceId}`);
        // Update status to indicate failure (space deleted)
        this.deps.messageService.updateMessageStatus(
          this.deps.queryClient,
          spaceId,
          channelId,
          messageId,
          'failed',
          'Space was deleted'
        );
        return;
      }

      const channel = space.groups
        ?.flatMap((g) => g.channels)
        .find((c) => c.channelId === channelId);
      if (!channel) {
        console.log(`[ActionQueue] Discarding message for deleted channel: ${channelId}`);
        this.deps.messageService.updateMessageStatus(
          this.deps.queryClient,
          spaceId,
          channelId,
          messageId,
          'failed',
          'Channel was deleted'
        );
        return;
      }

      // Get encryption state
      const response = await this.deps.messageDB.getEncryptionStates({
        conversationId: spaceId + '/' + spaceId,
      });
      const sets = response.map((e) => JSON.parse(e.state));

      if (sets.length === 0) {
        throw new Error('No encryption state available');
      }

      // Strip ephemeral fields before encrypting
      const { sendStatus: _sendStatus, sendError: _sendError, ...messageToEncrypt } = signedMessage;

      // Triple Ratchet encrypt
      const msg = secureChannel.TripleRatchetEncrypt(
        JSON.stringify({
          ratchet_state: sets[0].state,
          message: [
            ...new Uint8Array(Buffer.from(JSON.stringify(messageToEncrypt), 'utf-8')),
          ],
        } as secureChannel.TripleRatchetStateAndMessage)
      );
      const result = JSON.parse(msg) as secureChannel.TripleRatchetStateAndEnvelope;

      // Send via hub
      const sendHubMessage = this.deps.messageService.getSendHubMessage();
      await sendHubMessage(
        spaceId,
        JSON.stringify({
          type: 'message',
          message: JSON.parse(result.envelope),
        })
      );

      // Save the updated Triple Ratchet state
      const newEncryptionState = {
        state: JSON.stringify({
          state: result.ratchet_state,
        }),
        timestamp: Date.now(),
        inboxId: spaceId,
        conversationId: spaceId + '/' + spaceId,
        sentAccept: false,
      };
      await this.deps.messageDB.saveEncryptionState(newEncryptionState, true);

      // Get conversation for user profile info
      const conversationId = spaceId + '/' + channelId;
      const conversation = await this.deps.messageDB.getConversation({
        conversationId,
      });

      // Save to IndexedDB (without sendStatus/sendError)
      await this.deps.messageService.saveMessage(
        messageToEncrypt as Message,
        this.deps.messageDB,
        spaceId,
        channelId,
        'group',
        {
          user_icon: conversation?.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
          display_name: conversation?.conversation?.displayName ?? 'Unknown User',
        }
      );

      // Ensure message is in React Query cache AND update status to 'sent' in a single atomic operation
      // This prevents race conditions between two separate setQueryData calls
      const messagesKey = buildMessagesKey({ spaceId, channelId });
      this.deps.queryClient.setQueryData(
        messagesKey,
        (oldData: InfiniteData<{ messages: Message[]; nextCursor?: number; prevCursor?: number }> | undefined) => {
          if (!oldData?.pages) return oldData;

          // Check if message already exists in cache
          const existingPageIndex = oldData.pages.findIndex((page) =>
            page.messages.some((m) => m.messageId === messageId)
          );

          if (existingPageIndex !== -1) {
            // Message exists - update its status to 'sent' (clear sendStatus/sendError)
            return {
              pageParams: oldData.pageParams,
              pages: oldData.pages.map((page, index) => {
                if (index !== existingPageIndex) return page;
                return {
                  ...page,
                  messages: page.messages.map((msg) => {
                    if (msg.messageId === messageId && msg.sendStatus !== undefined) {
                      // Clear sendStatus to mark as sent
                      const { sendStatus: _, sendError: __, ...rest } = msg;
                      return rest as Message;
                    }
                    return msg;
                  }),
                  nextCursor: page.nextCursor,
                  prevCursor: page.prevCursor,
                };
              }),
            };
          }

          // Message not in cache (likely removed by refetch) - re-add it
          // Only re-add post messages to cache (not remove-message, reaction, etc.)
          if (signedMessage.content.type !== 'post') {
            return oldData;
          }

          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page, index) => {
              // Add to the last page (most recent messages)
              if (index === oldData.pages.length - 1) {
                const newMessages = [...page.messages, messageToEncrypt as Message];
                // Sort by createdDate
                newMessages.sort((a, b) => a.createdDate - b.createdDate);
                return {
                  ...page,
                  messages: newMessages,
                };
              }
              return page;
            }),
          };
        }
      );

      // Invalidate reply notification caches if this is a reply
      if ((context.replyMetadata as any)?.parentAuthor) {
        await this.deps.queryClient.invalidateQueries({
          queryKey: ['reply-counts', 'channel', spaceId],
        });
        await this.deps.queryClient.invalidateQueries({
          queryKey: ['reply-notifications', spaceId],
        });
      }
    },
    isPermanentError: (error) => {
      // Permanent errors that shouldn't be retried
      return (
        error.message.includes('400') ||
        error.message.includes('403') ||
        error.message.includes('Space was deleted') ||
        error.message.includes('Channel was deleted')
      );
    },
    onFailure: (context, error) => {
      const spaceId = context.spaceId as string;
      const channelId = context.channelId as string;
      const messageId = context.messageId as string;
      this.deps.messageService.updateMessageStatus(
        this.deps.queryClient,
        spaceId,
        channelId,
        messageId,
        'failed',
        this.sanitizeError(error)
      );
    },
    // No toast - inline message indicator handles feedback
    successMessage: undefined,
    failureMessage: undefined,
  };

  /**
   * Send a direct message that's already signed.
   * Receives the complete signed Message object, encrypts with Double Ratchet, and sends.
   *
   * Context expected:
   * - address: string (the DM conversation address)
   * - signedMessage: Message (already signed)
   * - messageId: string
   * - self: UserRegistration
   * - counterparty: UserRegistration
   * - keyset: { deviceKeyset, userKeyset }
   * - senderDisplayName: string (optional, user's display name for identity revelation)
   * - senderUserIcon: string (optional, user's profile picture URL for identity revelation)
   */
  private sendDm: TaskHandler = {
    execute: async (context) => {
      const address = context.address as string;
      const signedMessage = context.signedMessage as Message;
      const messageId = context.messageId as string;
      const self = context.self as secureChannel.UserRegistration;
      const counterparty = context.counterparty as secureChannel.UserRegistration;
      const keyset = context.keyset as {
        deviceKeyset: secureChannel.DeviceKeyset;
        userKeyset: secureChannel.UserKeyset;
      };
      const senderDisplayName = context.senderDisplayName as string | undefined;
      const senderUserIcon = context.senderUserIcon as string | undefined;

      const traceId = `DM-${messageId.slice(0, 8)}`;
      console.log(`[${traceId}] send-dm START`, {
        address: address.slice(0, 16) + '...',
        messageId: messageId.slice(0, 16) + '...',
        contentType: signedMessage.content?.type,
        timestamp: new Date().toISOString(),
      });

      const conversationId = address + '/' + address;
      const conversation = await this.deps.messageDB.getConversation({
        conversationId,
      });

      // Get encryption states
      let response = await this.deps.messageDB.getEncryptionStates({
        conversationId,
      });

      const inboxes = (self?.device_registrations ?? [])
        .filter((d) => d.inbox_registration)
        .map((d) => d.inbox_registration.inbox_address)
        .concat(
          (counterparty?.device_registrations ?? [])
            .filter((d) => d.inbox_registration)
            .map((d) => d.inbox_registration.inbox_address)
        )
        .sort();

      // Clean up stale encryption states
      for (const res of response) {
        if (!inboxes.includes(JSON.parse(res.state).tag)) {
          await this.deps.messageDB.deleteEncryptionState(res);
        }
      }

      response = await this.deps.messageDB.getEncryptionStates({ conversationId });
      const sets = response.map((e) => JSON.parse(e.state));

      let sessions: secureChannel.SealedMessageAndMetadata[] = [];

      // Strip ephemeral fields before encrypting
      const { sendStatus: _sendStatus, sendError: _sendError, ...messageToEncrypt } = signedMessage;

      // Get target inboxes (excluding our own device)
      const targetInboxes = inboxes.filter(
        (i) => i !== keyset.deviceKeyset.inbox_keyset.inbox_address
      );

      // Validate we have recipients to send to
      if (targetInboxes.length === 0) {
        console.error(`[${traceId}] FAILED: No target inboxes available`);
        throw new Error('No target inboxes available for DM - counterparty may have no registered devices');
      }

      console.log(`[${traceId}] Encrypting for ${targetInboxes.length} target inbox(es)`, {
        encryptionStatesFound: sets.length,
      });

      // Encrypt for each inbox (Double Ratchet)
      for (let i = 0; i < targetInboxes.length; i++) {
        const inbox = targetInboxes[i];
        const set = sets.find((s) => s.tag === inbox);
        if (set) {
          if (set.sending_inbox.inbox_public_key === '') {
            const newSessions = secureChannel.DoubleRatchetInboxEncryptForceSenderInit(
              keyset.deviceKeyset,
              [set],
              JSON.stringify(messageToEncrypt),
              self,
              senderDisplayName,
              senderUserIcon
            );
            sessions = [...sessions, ...newSessions];
          } else {
            const newSessions = secureChannel.DoubleRatchetInboxEncrypt(
              keyset.deviceKeyset,
              [set],
              JSON.stringify(messageToEncrypt),
              self,
              senderDisplayName,
              senderUserIcon
            );
            sessions = [...sessions, ...newSessions];
          }
        } else {
          // Find the device registration for this inbox
          const targetDevice = self.device_registrations
            .concat(counterparty.device_registrations)
            .filter((d) => d.inbox_registration)
            .find((d) => d.inbox_registration.inbox_address === inbox);

          if (!targetDevice) {
            console.warn(`[${traceId}] Inbox ${i + 1}/${targetInboxes.length}: No device registration found for ${inbox.slice(0, 16)}...`);
            continue; // Skip this inbox
          }

          console.log(`[${traceId}] Inbox ${i + 1}/${targetInboxes.length}: Creating new session for ${inbox.slice(0, 16)}...`);
          try {
            const newSessions = await secureChannel.NewDoubleRatchetSenderSession(
              keyset.deviceKeyset,
              self.user_address,
              targetDevice,
              JSON.stringify(messageToEncrypt),
              senderDisplayName,
              senderUserIcon
            );
            sessions = [...sessions, ...newSessions];
            console.log(`[${traceId}] Inbox ${i + 1}/${targetInboxes.length}: Session created successfully`);
          } catch (err) {
            console.error(`[${traceId}] Inbox ${i + 1}/${targetInboxes.length}: Failed to create session`, err);
            // Continue to next inbox instead of failing entire send
          }
        }
      }

      // Save encryption states and collect messages to send
      const outboundMessages: string[] = [];

      for (const session of sessions) {
        if (!session.receiving_inbox) {
          continue;
        }

        const newEncryptionState = {
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
        await this.deps.messageDB.saveEncryptionState(newEncryptionState, true);

        // Collect messages to send: listen subscription + direct message
        outboundMessages.push(
          JSON.stringify({
            type: 'listen',
            inbox_addresses: [session.receiving_inbox.inbox_address],
          })
        );
        outboundMessages.push(
          JSON.stringify({ type: 'direct', ...session.sealed_message })
        );
      }

      // Send all messages via WebSocket
      console.log(`[${traceId}] Sending ${outboundMessages.length} outbound messages via WebSocket`, {
        sessionCount: sessions.length,
      });
      await this.deps.messageService.sendDirectMessages(outboundMessages);
      console.log(`[${traceId}] WebSocket send completed`);

      // Save to IndexedDB (without sendStatus/sendError)
      await this.deps.messageService.saveMessage(
        messageToEncrypt as Message,
        this.deps.messageDB,
        address,
        address,
        'direct',
        {
          user_icon: conversation?.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
          display_name: conversation?.conversation?.displayName ?? 'Unknown User',
        }
      );

      // Ensure message is in React Query cache AND update status to 'sent' in a single atomic operation
      // This prevents race conditions between two separate setQueryData calls
      const messagesKey = buildMessagesKey({ spaceId: address, channelId: address });
      this.deps.queryClient.setQueryData(
        messagesKey,
        (oldData: InfiniteData<{ messages: Message[]; nextCursor?: number; prevCursor?: number }> | undefined) => {
          if (!oldData?.pages) return oldData;

          // Check if message already exists in cache
          const existingPageIndex = oldData.pages.findIndex((page) =>
            page.messages.some((m) => m.messageId === messageId)
          );

          if (existingPageIndex !== -1) {
            // Message exists - update its status to 'sent' (clear sendStatus/sendError)
            return {
              pageParams: oldData.pageParams,
              pages: oldData.pages.map((page, index) => {
                if (index !== existingPageIndex) return page;
                return {
                  ...page,
                  messages: page.messages.map((msg) => {
                    if (msg.messageId === messageId && msg.sendStatus !== undefined) {
                      // Clear sendStatus to mark as sent
                      const { sendStatus: _, sendError: __, ...rest } = msg;
                      return rest as Message;
                    }
                    return msg;
                  }),
                  nextCursor: page.nextCursor,
                  prevCursor: page.prevCursor,
                };
              }),
            };
          }

          // Message not in cache - re-add it (already without sendStatus since messageToEncrypt was stripped)
          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page, index) => {
              if (index === oldData.pages.length - 1) {
                const newMessages = [...page.messages, messageToEncrypt as Message];
                newMessages.sort((a, b) => a.createdDate - b.createdDate);
                return {
                  ...page,
                  messages: newMessages,
                };
              }
              return page;
            }),
          };
        }
      );
      console.log(`[${traceId}] send-dm COMPLETE - message sent successfully`);
    },
    isPermanentError: (error) => {
      return (
        error.message.includes('400') ||
        error.message.includes('403')
      );
    },
    onFailure: (context, error) => {
      const address = context.address as string;
      const messageId = context.messageId as string;
      const traceId = `DM-${messageId.slice(0, 8)}`;
      console.error(`[${traceId}] send-dm FAILED`, {
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      this.deps.messageService.updateMessageStatus(
        this.deps.queryClient,
        address,
        address,
        messageId,
        'failed',
        this.sanitizeError(error)
      );
    },
    successMessage: undefined,
    failureMessage: undefined,
  };

  // === DM SECONDARY ACTION HANDLERS (Double Ratchet) ===

  /**
   * Shared helper to encrypt and send DM messages using Double Ratchet.
   * Used by send-dm, reaction-dm, delete-dm, edit-dm handlers.
   *
   * @param address - The DM conversation address
   * @param messageContent - The message content to encrypt and send (already a plain object)
   * @param self - Sender's UserRegistration
   * @param counterparty - Recipient's UserRegistration
   * @param keyset - Sender's device and user keysets
   * @param senderDisplayName - Optional sender display name for identity revelation
   * @param senderUserIcon - Optional sender profile picture URL
   * @param traceId - Optional trace ID for logging
   */
  private async encryptAndSendDm(
    address: string,
    messageContent: Record<string, unknown>,
    self: secureChannel.UserRegistration,
    counterparty: secureChannel.UserRegistration,
    keyset: {
      deviceKeyset: secureChannel.DeviceKeyset;
      userKeyset: secureChannel.UserKeyset;
    },
    senderDisplayName?: string,
    senderUserIcon?: string,
    traceId?: string
  ): Promise<void> {
    const conversationId = address + '/' + address;
    const log = traceId ? (msg: string, data?: object) => console.log(`[${traceId}] ${msg}`, data ?? '') : () => {};

    // Get encryption states
    let response = await this.deps.messageDB.getEncryptionStates({
      conversationId,
    });

    const inboxes = (self?.device_registrations ?? [])
      .filter((d) => d.inbox_registration)
      .map((d) => d.inbox_registration.inbox_address)
      .concat(
        (counterparty?.device_registrations ?? [])
          .filter((d) => d.inbox_registration)
          .map((d) => d.inbox_registration.inbox_address)
      )
      .sort();

    // Clean up stale encryption states
    for (const res of response) {
      if (!inboxes.includes(JSON.parse(res.state).tag)) {
        await this.deps.messageDB.deleteEncryptionState(res);
      }
    }

    response = await this.deps.messageDB.getEncryptionStates({ conversationId });
    const sets = response.map((e) => JSON.parse(e.state));

    let sessions: secureChannel.SealedMessageAndMetadata[] = [];

    // Get target inboxes (excluding our own device)
    const targetInboxes = inboxes.filter(
      (i) => i !== keyset.deviceKeyset.inbox_keyset.inbox_address
    );

    // Validate we have recipients to send to
    if (targetInboxes.length === 0) {
      log('FAILED: No target inboxes available');
      throw new Error('No target inboxes available for DM - counterparty may have no registered devices');
    }

    log('Encrypting for target inboxes', { targetCount: targetInboxes.length, encryptionStates: sets.length });

    // Encrypt for each inbox (Double Ratchet)
    for (const inbox of targetInboxes) {
      const set = sets.find((s) => s.tag === inbox);
      if (set) {
        if (set.sending_inbox.inbox_public_key === '') {
          const newSessions = secureChannel.DoubleRatchetInboxEncryptForceSenderInit(
            keyset.deviceKeyset,
            [set],
            JSON.stringify(messageContent),
            self,
            senderDisplayName,
            senderUserIcon
          );
          sessions = [...sessions, ...newSessions];
        } else {
          const newSessions = secureChannel.DoubleRatchetInboxEncrypt(
            keyset.deviceKeyset,
            [set],
            JSON.stringify(messageContent),
            self,
            senderDisplayName,
            senderUserIcon
          );
          sessions = [...sessions, ...newSessions];
        }
      } else {
        // Find the device registration for this inbox
        const targetDevice = self.device_registrations
          .concat(counterparty.device_registrations)
          .filter((d) => d.inbox_registration)
          .find((d) => d.inbox_registration.inbox_address === inbox);

        if (!targetDevice) {
          continue; // Skip this inbox
        }

        sessions = [
          ...sessions,
          ...(await secureChannel.NewDoubleRatchetSenderSession(
            keyset.deviceKeyset,
            self.user_address,
            targetDevice,
            JSON.stringify(messageContent),
            senderDisplayName,
            senderUserIcon
          )),
        ];
      }
    }

    // Save encryption states and collect messages to send
    const outboundMessages: string[] = [];

    for (const session of sessions) {
      if (!session.receiving_inbox) {
        continue;
      }

      const newEncryptionState = {
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
      await this.deps.messageDB.saveEncryptionState(newEncryptionState, true);

      // Collect messages to send: listen subscription + direct message
      outboundMessages.push(
        JSON.stringify({
          type: 'listen',
          inbox_addresses: [session.receiving_inbox.inbox_address],
        })
      );
      outboundMessages.push(
        JSON.stringify({ type: 'direct', ...session.sealed_message })
      );
    }

    // Send all messages via WebSocket
    log('Sending via WebSocket', { outboundCount: outboundMessages.length, sessions: sessions.length });
    await this.deps.messageService.sendDirectMessages(outboundMessages);
    log('WebSocket send completed');
  }

  /**
   * Add/remove a reaction to a DM message.
   * Uses Double Ratchet encryption.
   *
   * Context expected:
   * - address: string (DM conversation address)
   * - reactionMessage: ReactionMessage | RemoveReactionMessage
   * - self: UserRegistration
   * - counterparty: UserRegistration
   * - keyset: { deviceKeyset, userKeyset }
   * - senderDisplayName?: string
   * - senderUserIcon?: string
   */
  private reactionDm: TaskHandler = {
    execute: async (context) => {
      const address = context.address as string;
      const reactionMessage = context.reactionMessage as Record<string, unknown>;
      const self = context.self as secureChannel.UserRegistration;
      const counterparty = context.counterparty as secureChannel.UserRegistration;
      const keyset = context.keyset as {
        deviceKeyset: secureChannel.DeviceKeyset;
        userKeyset: secureChannel.UserKeyset;
      };
      const senderDisplayName = context.senderDisplayName as string | undefined;
      const senderUserIcon = context.senderUserIcon as string | undefined;

      const traceId = `DM-REACT-${(reactionMessage.messageId as string)?.slice(0, 8) ?? 'unknown'}`;
      console.log(`[${traceId}] reaction-dm START`, {
        type: reactionMessage.type,
        reaction: reactionMessage.reaction,
        messageId: (reactionMessage.messageId as string)?.slice(0, 16),
        timestamp: new Date().toISOString(),
      });

      try {
        await this.encryptAndSendDm(
          address,
          reactionMessage,
          self,
          counterparty,
          keyset,
          senderDisplayName,
          senderUserIcon,
          traceId
        );
        console.log(`[${traceId}] reaction-dm COMPLETE`);
      } catch (error) {
        console.error(`[${traceId}] reaction-dm FAILED`, { error: (error as Error).message });
        throw error;
      }
    },
    // Reactions are idempotent - re-adding same reaction is fine
    isPermanentError: (error) => {
      return error.message.includes('404'); // Message deleted
    },
    successMessage: undefined,
    failureMessage: undefined,
  };

  /**
   * Delete a DM message.
   * Uses Double Ratchet encryption.
   *
   * Context expected:
   * - address: string (DM conversation address)
   * - deleteMessage: RemoveMessage
   * - self: UserRegistration
   * - counterparty: UserRegistration
   * - keyset: { deviceKeyset, userKeyset }
   * - senderDisplayName?: string
   * - senderUserIcon?: string
   */
  private deleteDm: TaskHandler = {
    execute: async (context) => {
      const address = context.address as string;
      const deleteMessage = context.deleteMessage as Record<string, unknown>;
      const self = context.self as secureChannel.UserRegistration;
      const counterparty = context.counterparty as secureChannel.UserRegistration;
      const keyset = context.keyset as {
        deviceKeyset: secureChannel.DeviceKeyset;
        userKeyset: secureChannel.UserKeyset;
      };
      const senderDisplayName = context.senderDisplayName as string | undefined;
      const senderUserIcon = context.senderUserIcon as string | undefined;

      const traceId = `DM-DEL-${(deleteMessage.removeMessageId as string)?.slice(0, 8) ?? 'unknown'}`;
      console.log(`[${traceId}] delete-dm START`, {
        removeMessageId: (deleteMessage.removeMessageId as string)?.slice(0, 16),
        timestamp: new Date().toISOString(),
      });

      try {
        await this.encryptAndSendDm(
          address,
          deleteMessage,
          self,
          counterparty,
          keyset,
          senderDisplayName,
          senderUserIcon,
          traceId
        );
        console.log(`[${traceId}] delete-dm COMPLETE`);
      } catch (err: any) {
        // If message already deleted, treat as success
        if (err.message?.includes('404')) {
          console.log(`[${traceId}] delete-dm COMPLETE (already deleted)`);
          return;
        }
        console.error(`[${traceId}] delete-dm FAILED`, { error: err.message });
        throw err;
      }
    },
    // Idempotent - if already deleted, that's success
    isPermanentError: () => false,
    successMessage: undefined,
    failureMessage: t`Failed to delete message`,
  };

  /**
   * Edit a DM message.
   * Uses Double Ratchet encryption.
   *
   * Context expected:
   * - address: string (DM conversation address)
   * - editMessage: EditMessage
   * - messageId: string
   * - self: UserRegistration
   * - counterparty: UserRegistration
   * - keyset: { deviceKeyset, userKeyset }
   * - senderDisplayName?: string
   * - senderUserIcon?: string
   */
  private editDm: TaskHandler = {
    execute: async (context) => {
      const address = context.address as string;
      const editMessage = context.editMessage as Record<string, unknown>;
      const messageId = context.messageId as string;
      const self = context.self as secureChannel.UserRegistration;
      const counterparty = context.counterparty as secureChannel.UserRegistration;
      const keyset = context.keyset as {
        deviceKeyset: secureChannel.DeviceKeyset;
        userKeyset: secureChannel.UserKeyset;
      };
      const senderDisplayName = context.senderDisplayName as string | undefined;
      const senderUserIcon = context.senderUserIcon as string | undefined;

      const traceId = `DM-EDIT-${messageId.slice(0, 8)}`;
      console.log(`[${traceId}] edit-dm START`, {
        messageId: messageId.slice(0, 16),
        timestamp: new Date().toISOString(),
      });

      // Check if message still exists
      const message = await this.deps.messageDB.getMessageById(messageId);
      if (!message) {
        console.log(`[${traceId}] edit-dm SKIPPED - message not found`);
        return;
      }

      try {
        await this.encryptAndSendDm(
          address,
          editMessage,
          self,
          counterparty,
          keyset,
          senderDisplayName,
          senderUserIcon,
          traceId
        );
        console.log(`[${traceId}] edit-dm COMPLETE`);
      } catch (error) {
        console.error(`[${traceId}] edit-dm FAILED`, { error: (error as Error).message });
        throw error;
      }
    },
    isPermanentError: (error) => error.message.includes('404'),
    successMessage: undefined,
    failureMessage: t`Failed to edit message`,
  };

  /**
   * Sanitize error messages to avoid exposing internal details to the user
   */
  private sanitizeError(error: Error): string {
    const msg = error.message.toLowerCase();
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('offline')) {
      return t`Network error`;
    }
    if (msg.includes('encrypt') || msg.includes('ratchet') || msg.includes('key')) {
      return t`Encryption error`;
    }
    if (msg.includes('no target inboxes')) {
      return t`Recipient has no devices`;
    }
    return t`Send failed`;
  }

  /**
   * Get handler for a specific task type
   */
  getHandler(taskType: ActionType | string): TaskHandler | undefined {
    const handlers: Record<string, TaskHandler> = {
      'send-channel-message': this.sendChannelMessage,
      'send-dm': this.sendDm,
      'save-user-config': this.saveUserConfig,
      'update-space': this.updateSpace,
      'kick-user': this.kickUser,
      'mute-user': this.muteUser,
      'unmute-user': this.unmuteUser,
      // Space message actions (Triple Ratchet)
      reaction: this.reaction,
      'pin-message': this.pinMessage,
      'unpin-message': this.unpinMessage,
      'edit-message': this.editMessage,
      'delete-message': this.deleteMessage,
      // DM message actions (Double Ratchet)
      'reaction-dm': this.reactionDm,
      'delete-dm': this.deleteDm,
      'edit-dm': this.editDm,
    };
    return handlers[taskType];
  }
}
