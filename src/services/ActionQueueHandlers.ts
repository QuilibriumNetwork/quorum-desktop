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
import type { QueryClient } from '@tanstack/react-query';
import type { ActionType } from '../types/actionQueue';

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
   * Send a message to a channel
   * No toast - inline message indicator handles feedback
   */
  private sendMessage: TaskHandler = {
    execute: async (context) => {
      // Check if space/channel still exists
      const space = await this.deps.messageDB.getSpace(context.spaceId as string);
      if (!space) {
        console.log(
          `[ActionQueue] Discarding message for deleted space: ${context.spaceId}`
        );
        return;
      }

      const channel = space.groups
        ?.flatMap((g) => g.channels)
        .find((c) => c.channelId === context.channelId);
      if (!channel) {
        console.log(
          `[ActionQueue] Discarding message for deleted channel: ${context.channelId}`
        );
        return;
      }

      // Context contains all params needed for submitChannelMessage
      await this.deps.messageService.submitChannelMessage(
        context.spaceId as string,
        context.channelId as string,
        context.pendingMessage as string | object,
        this.deps.queryClient,
        context.currentPasskeyInfo as any,
        context.inReplyTo as string | undefined,
        context.skipSigning as boolean | undefined,
        context.isSpaceOwner as boolean | undefined,
        context.parentMessage as any
      );
    },
    isPermanentError: (error) => {
      return (
        error.message.includes('400') ||
        error.message.includes('403') ||
        error.message.includes('404') ||
        error.message.toLowerCase().includes('not found')
      );
    },
    // NO toast - inline message indicator handles feedback
    successMessage: undefined,
    failureMessage: undefined,
  };

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
    successMessage: t`Space settings saved`,
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
        (m) => m.user_address === context.targetUserId
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
    successMessage: t`User removed`,
    failureMessage: t`Failed to remove user`,
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
    successMessage: t`User muted`,
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
    successMessage: t`User unmuted`,
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
      const message = await this.deps.messageDB.getMessageById(
        context.messageId as string
      );
      if (!message) return; // Message deleted - skip silently

      await this.deps.messageService.submitChannelMessage(
        context.spaceId as string,
        context.channelId as string,
        context.editMessage as any,
        this.deps.queryClient,
        context.currentPasskeyInfo as any
      );
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

  /**
   * Get handler for a specific task type
   */
  getHandler(taskType: ActionType | string): TaskHandler | undefined {
    const handlers: Record<string, TaskHandler> = {
      'send-message': this.sendMessage,
      'save-user-config': this.saveUserConfig,
      'update-space': this.updateSpace,
      'kick-user': this.kickUser,
      'mute-user': this.muteUser,
      'unmute-user': this.unmuteUser,
      reaction: this.reaction,
      'pin-message': this.pinMessage,
      'unpin-message': this.unpinMessage,
      'edit-message': this.editMessage,
      'delete-message': this.deleteMessage,
    };
    return handlers[taskType];
  }
}
