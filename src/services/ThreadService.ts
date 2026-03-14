import type { QueryClient, InfiniteData } from '@tanstack/react-query';
import type { MessageDB } from '../db/messages';
import type {
  Message,
  ThreadMessage,
  ChannelThread,
} from '../api/quorumApi';
import {
  buildChannelThreadFromCreate,
  updateChannelThreadOnReply,
} from './channelThreadHelpers';
import { buildMessagesKeyPrefix } from '../hooks/queries/messages/buildMessagesKey';

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
    targetMessage: Message | undefined;
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

  /**
   * Handles thread-type messages on the cache path (React Query updates).
   * Extracted from MessageService.addMessage lines 1458–1567.
   *
   * @returns true if processed, false if rejected.
   */
  async handleThreadCache(params: {
    threadMsg: ThreadMessage;
    spaceId: string;
    channelId: string;
    queryClient: QueryClient;
  }): Promise<boolean> {
    const { threadMsg, spaceId, channelId, queryClient } = params;

    if (spaceId === channelId) return false;

    const targetMessage = await this.messageDB.getMessage({
      spaceId, channelId, messageId: threadMsg.targetMessageId,
    });

    // Auth checks per action
    if (threadMsg.action === 'updateTitle') {
      if (!targetMessage || threadMsg.senderId !== targetMessage.threadMeta?.createdBy) return false;
    }

    if (threadMsg.action === 'close' || threadMsg.action === 'reopen' || threadMsg.action === 'updateSettings') {
      if (!targetMessage) return false;
      const authorized = await this.isThreadAuthorized({
        senderId: threadMsg.senderId,
        createdBy: targetMessage.threadMeta?.createdBy,
        spaceId,
      });
      if (!authorized) return false;
    }

    if (threadMsg.action === 'remove') {
      return this.handleThreadRemoveCache({
        threadMsg, targetMessage, spaceId, channelId, queryClient,
      });
    }

    // Non-remove: merge threadMeta into main feed cache
    queryClient.setQueriesData(
      { queryKey: buildMessagesKeyPrefix({ spaceId, channelId }) },
      (oldData: InfiniteData<any> | undefined) => {
        if (!oldData?.pages) return oldData;
        return {
          pageParams: oldData.pageParams,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            messages: page.messages.map((m: Message) =>
              m.messageId === threadMsg.targetMessageId
                ? { ...m, threadMeta: { ...m.threadMeta, ...threadMsg.threadMeta } }
                : m
            ),
          })),
        };
      }
    );
    queryClient.invalidateQueries({
      queryKey: ['thread-messages', spaceId, channelId, threadMsg.threadMeta.threadId],
    });
    queryClient.invalidateQueries({
      queryKey: ['channel-threads', spaceId, channelId],
    });
    return true;
  }

  /**
   * Handles thread removal cache updates.
   */
  private async handleThreadRemoveCache(params: {
    threadMsg: ThreadMessage;
    targetMessage: Message | undefined;
    spaceId: string;
    channelId: string;
    queryClient: QueryClient;
  }): Promise<boolean> {
    const { threadMsg, targetMessage, spaceId, channelId, queryClient } = params;
    const threadId = threadMsg.threadMeta.threadId;

    // Auth
    const threadRecord = !targetMessage
      ? await this.messageDB.getChannelThread(threadId)
      : undefined;
    const createdBy = targetMessage?.threadMeta?.createdBy ?? threadRecord?.createdBy;
    const authorized = await this.isThreadAuthorized({
      senderId: threadMsg.senderId, createdBy, spaceId,
    });
    if (!authorized) return false;

    const isRootSender = targetMessage
      ? threadMsg.senderId === targetMessage.content.senderId
      : false;

    // Update main feed cache
    queryClient.setQueriesData(
      { queryKey: buildMessagesKeyPrefix({ spaceId, channelId }) },
      (oldData: InfiniteData<any> | undefined) => {
        if (!oldData?.pages) return oldData;
        return {
          pageParams: oldData.pageParams,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            messages: page.messages.map((m: Message) => {
              if (m.messageId === threadMsg.targetMessageId) {
                const text = (m.content as { text?: string })?.text;
                if (!text || isRootSender) return null;
                const { threadMeta: _stripped, ...rest } = m;
                return rest as Message;
              }
              if (m.threadId === threadId) return null;
              return m;
            }).filter((m: Message | null): m is Message => m !== null),
          })),
        };
      }
    );

    queryClient.removeQueries({
      queryKey: ['thread-messages', spaceId, channelId, threadId],
    });
    queryClient.setQueryData(
      ['channel-threads', spaceId, channelId],
      (old: any[] | undefined) =>
        old ? old.filter((t: any) => t.threadId !== threadId) : old,
    );
    return true;
  }

  /**
   * Handles thread reply cache updates (invalidations + lastActivityAt bump).
   * Extracted from MessageService.addMessage lines 1673–1712.
   *
   * @returns true if the message was a thread reply.
   */
  handleThreadReplyCache(params: {
    message: Message;
    spaceId: string;
    channelId: string;
    queryClient: QueryClient;
  }): boolean {
    const { message, spaceId, channelId, queryClient } = params;

    if (!message.isThreadReply || !message.threadId) return false;

    queryClient.invalidateQueries({
      queryKey: ['thread-messages', spaceId, channelId, message.threadId],
    });
    queryClient.invalidateQueries({
      queryKey: ['thread-stats', spaceId, channelId, message.threadId],
    });

    // Update lastActivityAt on root message in main feed cache
    const now = message.createdDate ?? Date.now();
    queryClient.setQueriesData(
      { queryKey: buildMessagesKeyPrefix({ spaceId, channelId }) },
      (oldData: InfiniteData<any> | undefined) => {
        if (!oldData?.pages) return oldData;
        return {
          pageParams: oldData.pageParams,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            messages: page.messages.map((m: Message) => {
              if (m.threadMeta?.threadId === message.threadId) {
                return { ...m, threadMeta: { ...m.threadMeta, lastActivityAt: now } };
              }
              return m;
            }),
          })),
        };
      }
    );
    queryClient.invalidateQueries({
      queryKey: ['channel-threads', spaceId, channelId],
    });

    return true;
  }

  /**
   * Updates thread-messages cache when a thread reply is deleted.
   * Extracted from MessageService.addMessage lines 1345–1359.
   */
  handleThreadDeletedMessageCache(params: {
    targetMessage: Message | undefined;
    spaceId: string;
    channelId: string;
    queryClient: QueryClient;
  }): void {
    const { targetMessage, spaceId, channelId, queryClient } = params;

    if (!targetMessage?.isThreadReply || !targetMessage.threadId) return;

    const threadKey = ['thread-messages', spaceId, channelId, targetMessage.threadId];
    queryClient.setQueryData(threadKey, (oldData: any) => {
      if (!oldData?.messages) return oldData;
      return {
        ...oldData,
        messages: oldData.messages.filter((m: Message) => m.messageId !== targetMessage.messageId),
        replyCount: Math.max(0, (oldData.replyCount || 0) - 1),
      };
    });
  }

  /**
   * Pre-send validation for thread messages. Performs DM check, idempotency,
   * and auth checks. Returns the targetMessage so the caller doesn't need
   * to fetch it again.
   *
   * Returns { shouldProceed: false } if the message should not be sent.
   * Returns { shouldProceed: true, targetMessage } for valid messages.
   *
   * Extracted from MessageService.submitChannelMessage lines 4740–4764.
   */
  async handleThreadSend(params: {
    threadMsg: ThreadMessage;
    spaceId: string;
    channelId: string;
    queryClient: QueryClient;
    currentUserAddress: string;
  }): Promise<{ shouldProceed: boolean; targetMessage?: Message }> {
    const { threadMsg, spaceId, channelId } = params;

    if (spaceId === channelId) return { shouldProceed: false };

    const targetMessage = await this.messageDB.getMessage({
      spaceId, channelId, messageId: threadMsg.targetMessageId,
    });
    if (!targetMessage) return { shouldProceed: false };

    // Idempotent for 'create'
    if (threadMsg.action === 'create' && targetMessage.threadMeta?.threadId === threadMsg.threadMeta.threadId) {
      return { shouldProceed: false };
    }

    // updateTitle: only creator
    if (threadMsg.action === 'updateTitle' && threadMsg.senderId !== targetMessage.threadMeta?.createdBy) {
      return { shouldProceed: false };
    }

    return { shouldProceed: true, targetMessage };
  }

  /**
   * Post-send DB and cache operations for thread messages.
   * Called AFTER the message has been encrypted and sent.
   *
   * For 'remove': performs DB cleanup (root handling, reply deletion, registry removal).
   * For 'create'/'updateTitle'/etc: saves updated root message and updates caches.
   *
   * The `conversationProfile` parameter is resolved by the caller (MessageService)
   * since it depends on DefaultImages and i18n which ThreadService shouldn't import.
   */
  async handleThreadSendPostBroadcast(params: {
    threadMsg: ThreadMessage;
    targetMessage: Message;
    spaceId: string;
    channelId: string;
    queryClient: QueryClient;
    currentUserAddress: string;
    conversationProfile: { user_icon: string; display_name: string };
  }): Promise<{ earlyReturn: boolean }> {
    const { threadMsg, targetMessage, spaceId, channelId, queryClient, currentUserAddress, conversationProfile } = params;

    // Remove action: full cleanup
    if (threadMsg.action === 'remove') {
      const isRootSender = threadMsg.senderId === targetMessage.content.senderId;
      const rootText = (targetMessage.content as { text?: string })?.text;
      const isSoftDeleted = !rootText || (Array.isArray(rootText) && (rootText as string[]).every(s => !s));

      if (isRootSender || isSoftDeleted) {
        await this.messageDB.deleteMessage(targetMessage.messageId);
      } else {
        const stripped: Message = { ...targetMessage };
        delete stripped.threadMeta;
        await this.messageDB.saveMessage(
          stripped, 0, spaceId, 'group',
          conversationProfile.user_icon, conversationProfile.display_name,
          currentUserAddress
        );
      }

      const { messages: threadReplies } = await this.messageDB.getThreadMessages({
        spaceId, channelId, threadId: threadMsg.threadMeta.threadId,
      });
      for (const reply of threadReplies) {
        await this.messageDB.deleteMessage(reply.messageId);
      }
      await this.messageDB.deleteChannelThread(threadMsg.threadMeta.threadId);
      return { earlyReturn: true };
    }

    // Non-remove: save updated root
    const mergedMeta = threadMsg.action === 'updateTitle'
      ? { ...targetMessage.threadMeta, ...threadMsg.threadMeta }
      : threadMsg.threadMeta;
    const updatedTarget: Message = { ...targetMessage, threadMeta: mergedMeta };
    await this.messageDB.saveMessage(
      updatedTarget, 0, spaceId, 'group',
      conversationProfile.user_icon, conversationProfile.display_name,
      currentUserAddress
    );

    // Update main feed cache
    queryClient.setQueriesData(
      { queryKey: buildMessagesKeyPrefix({ spaceId, channelId }) },
      (oldData: InfiniteData<any> | undefined) => {
        if (!oldData?.pages) return oldData;
        return {
          pageParams: oldData.pageParams,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            messages: page.messages.map((m: Message) =>
              m.messageId === threadMsg.targetMessageId
                ? { ...m, threadMeta: threadMsg.action === 'updateTitle'
                    ? { ...m.threadMeta, ...threadMsg.threadMeta }
                    : threadMsg.threadMeta }
                : m
            ),
          })),
        };
      }
    );

    // Create: save to channel_threads registry
    if (threadMsg.action === 'create') {
      const rootText = (targetMessage.content as { text?: string })?.text ?? '';
      const newThread = buildChannelThreadFromCreate({
        spaceId, channelId,
        rootMessageId: threadMsg.targetMessageId,
        threadMeta: threadMsg.threadMeta,
        rootMessageText: typeof rootText === 'string' ? rootText : '',
        currentUserAddress,
        now: Date.now(),
      });
      await this.messageDB.saveChannelThread(newThread);
      queryClient.invalidateQueries({ queryKey: ['channel-threads', spaceId, channelId] });
    }

    // updateTitle: update channel_threads registry and invalidate thread-messages
    if (threadMsg.action === 'updateTitle') {
      const threads = await this.messageDB.getChannelThreads({ spaceId, channelId });
      const entry = threads.find((t: ChannelThread) => t.threadId === threadMsg.threadMeta.threadId);
      if (entry) {
        await this.messageDB.saveChannelThread({
          ...entry,
          customTitle: threadMsg.threadMeta.customTitle ?? entry.customTitle,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['channel-threads', spaceId, channelId] });
      queryClient.invalidateQueries({
        queryKey: ['thread-messages', spaceId, channelId, threadMsg.threadMeta.threadId],
      });
    }

    return { earlyReturn: false };
  }
}
