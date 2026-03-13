import { logger } from '@quilibrium/quorum-shared';
import type { MessageDB } from '../db/messages';
import type {
  Message,
  ThreadMessage,
  ThreadMeta,
  ChannelThread,
} from '../api/quorumApi';
import {
  buildChannelThreadFromCreate,
  updateChannelThreadOnReply,
} from './channelThreadHelpers';

export class ThreadService {
  constructor(private messageDB: MessageDB) {}

  /**
   * Unified thread authorization: thread creator OR message:delete permission.
   * Replaces 6 duplicate auth checks across MessageService's three code paths.
   */
  async isThreadAuthorized(params: {
    senderId: string;
    createdBy: string | undefined;
    spaceId: string;
  }): Promise<boolean> {
    if (params.senderId === params.createdBy) return true;

    const space = await this.messageDB.getSpace(params.spaceId);
    return (
      space?.roles?.some(
        (role: { members: string[]; permissions: string[] }) =>
          role.members.includes(params.senderId) &&
          role.permissions.includes('message:delete')
      ) ?? false
    );
  }

  /**
   * Handles incoming thread-type messages (receive path).
   * Extracted from MessageService.processMessage lines 801–940.
   *
   * @returns true if the message was processed, false if rejected/skipped.
   */
  async handleThreadReceive(params: {
    threadMsg: ThreadMessage;
    spaceId: string;
    channelId: string;
    currentUserAddress: string;
    conversationType: string;
    updatedUserProfile: { user_icon: string; display_name: string };
  }): Promise<boolean> {
    const { threadMsg, spaceId, channelId, currentUserAddress, conversationType, updatedUserProfile } = params;

    // Reject DMs
    if (spaceId === channelId) return false;

    const targetMessage = await this.messageDB.getMessage({
      spaceId,
      channelId,
      messageId: threadMsg.targetMessageId,
    });

    // For 'remove' action, allow proceeding even if root was already deleted
    if (!targetMessage && threadMsg.action !== 'remove') return false;

    // --- Action routing ---

    if (threadMsg.action === 'create') {
      // Idempotent — skip if threadId already set
      if (targetMessage!.threadMeta?.threadId === threadMsg.threadMeta.threadId) return false;

      const rootText = (targetMessage!.content as { text?: string })?.text ?? '';
      const newThread = buildChannelThreadFromCreate({
        spaceId,
        channelId,
        rootMessageId: threadMsg.targetMessageId,
        threadMeta: threadMsg.threadMeta,
        rootMessageText: typeof rootText === 'string' ? rootText : '',
        currentUserAddress: currentUserAddress ?? '',
        now: Date.now(),
      });
      await this.messageDB.saveChannelThread(newThread);
    } else if (threadMsg.action === 'updateTitle') {
      if (threadMsg.senderId !== targetMessage!.threadMeta?.createdBy) return false;
    } else if (
      threadMsg.action === 'close' ||
      threadMsg.action === 'reopen' ||
      threadMsg.action === 'updateSettings'
    ) {
      const authorized = await this.isThreadAuthorized({
        senderId: threadMsg.senderId,
        createdBy: targetMessage!.threadMeta?.createdBy,
        spaceId,
      });
      if (!authorized) return false;
    } else if (threadMsg.action === 'remove') {
      return this.handleThreadRemoveReceive({
        threadMsg,
        targetMessage,
        spaceId,
        channelId,
        currentUserAddress,
        conversationType,
        updatedUserProfile,
      });
    }

    // All non-remove actions require targetMessage
    if (!targetMessage) return false;

    // Merge threadMeta and save
    const updatedMessage: Message = {
      ...targetMessage,
      threadMeta: { ...targetMessage.threadMeta, ...threadMsg.threadMeta },
    };
    await this.messageDB.saveMessage(
      updatedMessage, 0, spaceId, conversationType,
      updatedUserProfile.user_icon, updatedUserProfile.display_name,
      currentUserAddress
    );

    // Sync channel_threads registry for settings/close/reopen
    if (
      threadMsg.action === 'close' ||
      threadMsg.action === 'reopen' ||
      threadMsg.action === 'updateSettings'
    ) {
      const threads = await this.messageDB.getChannelThreads({ spaceId, channelId });
      const entry = threads.find((t: ChannelThread) => t.threadId === threadMsg.threadMeta.threadId);
      if (entry) {
        await this.messageDB.saveChannelThread({
          ...entry,
          isClosed: threadMsg.action === 'close'
            ? true
            : threadMsg.action === 'reopen'
              ? false
              : entry.isClosed,
          customTitle: threadMsg.threadMeta.customTitle ?? entry.customTitle,
        });
      }
    }

    return true;
  }

  /**
   * Handles thread removal on the receive path.
   * Separated for clarity — remove has complex root message handling.
   */
  private async handleThreadRemoveReceive(params: {
    threadMsg: ThreadMessage;
    targetMessage: Message | null;
    spaceId: string;
    channelId: string;
    currentUserAddress: string;
    conversationType: string;
    updatedUserProfile: { user_icon: string; display_name: string };
  }): Promise<boolean> {
    const { threadMsg, targetMessage, spaceId, channelId, currentUserAddress, conversationType, updatedUserProfile } = params;

    // Auth: fall back to channel_threads registry if root was already deleted
    const threadRecord = !targetMessage
      ? await this.messageDB.getChannelThread(threadMsg.threadMeta.threadId)
      : undefined;
    const createdBy = targetMessage?.threadMeta?.createdBy ?? threadRecord?.createdBy;

    const authorized = await this.isThreadAuthorized({
      senderId: threadMsg.senderId,
      createdBy,
      spaceId,
    });
    if (!authorized) return false;

    // Handle root message
    if (targetMessage) {
      const isRootSender = threadMsg.senderId === targetMessage.content.senderId;
      const rootText = (targetMessage.content as { text?: string })?.text;
      const isSoftDeleted = !rootText || (Array.isArray(rootText) && (rootText as string[]).every(s => !s));

      if (isRootSender || isSoftDeleted) {
        await this.messageDB.deleteMessage(targetMessage.messageId);
      } else {
        // Strip threadMeta — keep the other user's message
        const stripped: Message = { ...targetMessage };
        delete stripped.threadMeta;
        await this.messageDB.saveMessage(
          stripped, 0, spaceId, conversationType,
          updatedUserProfile.user_icon, updatedUserProfile.display_name,
          currentUserAddress
        );
      }
    }

    // Hard-delete all thread replies
    const { messages: threadReplies } = await this.messageDB.getThreadMessages({
      spaceId,
      channelId,
      threadId: threadMsg.threadMeta.threadId,
    });
    for (const reply of threadReplies) {
      await this.messageDB.deleteMessage(reply.messageId);
    }

    // Remove from channel_threads registry
    await this.messageDB.deleteChannelThread(threadMsg.threadMeta.threadId);
    return true;
  }

  /**
   * Marks incoming thread replies with isThreadReply flag and updates
   * the channel_threads registry. Called before the reply is saved to DB.
   *
   * Mutates the message object in place (sets isThreadReply).
   *
   * @returns true if the message was a thread reply and registry was updated.
   */
  async handleThreadReplyReceive(params: {
    message: Message;
    spaceId: string;
    channelId: string;
    currentUserAddress: string;
  }): Promise<boolean> {
    const { message, spaceId, channelId, currentUserAddress } = params;

    // Ensure thread replies are marked for filtering
    if (message.threadId && !message.isThreadReply) {
      message.isThreadReply = true;
    }

    if (!message.isThreadReply || !message.threadId) return false;

    // Update channel_threads registry
    const threads = await this.messageDB.getChannelThreads({ spaceId, channelId });
    const existingEntry = threads.find((t: ChannelThread) => t.threadId === message.threadId);

    if (existingEntry) {
      const updated = updateChannelThreadOnReply({
        existing: existingEntry,
        replySenderId: message.content.senderId,
        replyTimestamp: message.createdDate,
        currentUserAddress: currentUserAddress ?? '',
      });
      await this.messageDB.saveChannelThread(updated);
    }

    return true;
  }
}
