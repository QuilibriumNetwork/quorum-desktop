import type { QueryClient, InfiniteData } from '@tanstack/react-query';
import type { MessageDB } from '../db/messages';
import type {
  Channel,
  Message,
  ThreadMessage,
  ChannelThread,
  VerifiedSender,
} from '@quilibrium/quorum-shared';
import { authorizeThreadAction } from '@quilibrium/quorum-shared';
import {
  buildChannelThreadFromCreate,
  updateChannelThreadOnReply,
} from './channelThreadHelpers';
import { buildMessagesKeyPrefix } from '../hooks/queries/messages/buildMessagesKey';

/**
 * Thread control frames (`create` / `close` / `reopen` / `updateSettings` /
 * `updateTitle` / `remove`) reach across to other users' content — `remove`
 * hard-deletes the root message and every reply.
 *
 * Every authorization input here is therefore the VERIFIED signer, resolved by
 * the receive path before it calls in. `threadMsg.senderId` is a plaintext field
 * the sending client writes, and it is never consulted for a decision; it stayed
 * usable as a display value only.
 */
export class ThreadService {
  constructor(private messageDB: MessageDB) {}

  /** The channel row, needed so read-only channels keep their isolated rules. */
  private async resolveChannel(
    spaceId: string,
    channelId: string
  ): Promise<{ space: Awaited<ReturnType<MessageDB['getSpace']>>; channel: Channel | undefined }> {
    const space = await this.messageDB.getSpace(spaceId);
    const channel = space?.groups
      ?.find((g: { channels: Channel[] }) =>
        g.channels.find((c: Channel) => c.channelId === channelId)
      )
      ?.channels.find((c: Channel) => c.channelId === channelId);
    return { space, channel };
  }

  /**
   * Who owns this thread, per STORED state — the root's `threadMeta`, or the
   * registry when the root is already gone (a `remove` following a delete).
   *
   * Never the incoming frame. That value is only trustworthy because `create`
   * pins it to the verified creator; reading it off the wire here would undo
   * that in one line.
   */
  private async resolveThreadCreator(
    threadMsg: ThreadMessage,
    targetMessage: Message | undefined
  ): Promise<string | undefined> {
    if (targetMessage?.threadMeta?.createdBy) {
      return targetMessage.threadMeta.createdBy;
    }
    if (threadMsg.action === 'create') return undefined;
    const record = await this.messageDB.getChannelThread(
      threadMsg.threadMeta.threadId
    );
    return record?.createdBy;
  }

  /**
   * The single authorization gate for an incoming thread frame. Both the DB and
   * the cache path funnel through it so they cannot reach different verdicts
   * about the same frame.
   */
  private async isThreadFrameAuthorized(params: {
    threadMsg: ThreadMessage;
    targetMessage: Message | undefined;
    spaceId: string;
    channelId: string;
    verifiedSender: VerifiedSender | null;
  }): Promise<boolean> {
    const { threadMsg, targetMessage, spaceId, channelId, verifiedSender } =
      params;
    // Cheap denial first: an unverifiable frame needs no space lookup at all.
    if (!verifiedSender) return false;

    const [{ space, channel }, threadCreatedBy] = await Promise.all([
      this.resolveChannel(spaceId, channelId),
      this.resolveThreadCreator(threadMsg, targetMessage),
    ]);

    return authorizeThreadAction({
      action: threadMsg.action,
      verifiedSender,
      threadCreatedBy,
      space: space ?? undefined,
      channel,
    }).allowed;
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
    /** The ed448-proven signer, or null when nothing could be proven. */
    verifiedSender: VerifiedSender | null;
    currentUserAddress: string;
    conversationType: string;
    updatedUserProfile: { user_icon: string; display_name: string };
  }): Promise<boolean> {
    const { threadMsg, spaceId, channelId, verifiedSender, currentUserAddress, conversationType, updatedUserProfile } = params;

    // Reject DMs
    if (spaceId === channelId) return false;

    const targetMessage = await this.messageDB.getMessage({
      spaceId,
      channelId,
      messageId: threadMsg.targetMessageId,
    });

    // For 'remove' action, allow proceeding even if root was already deleted
    if (!targetMessage && threadMsg.action !== 'remove') return false;

    // Idempotency sits AHEAD of authorization on purpose: a duplicate create is
    // a no-op we already applied, not an access decision to re-litigate.
    if (
      threadMsg.action === 'create' &&
      targetMessage!.threadMeta?.threadId === threadMsg.threadMeta.threadId
    ) {
      return false;
    }

    if (
      !(await this.isThreadFrameAuthorized({
        threadMsg,
        targetMessage,
        spaceId,
        channelId,
        verifiedSender,
      }))
    ) {
      return false;
    }
    // Past the gate, so a sender was proven; safe to treat as the actor.
    const actor = verifiedSender as string;

    // --- Action routing ---

    if (threadMsg.action === 'create') {
      const rootText = (targetMessage!.content as { text?: string })?.text ?? '';
      const newThread = buildChannelThreadFromCreate({
        spaceId,
        channelId,
        rootMessageId: threadMsg.targetMessageId,
        // createdBy comes from the signature, not the payload. Pre-fix the wire
        // value was copied verbatim and then became the anchor every later
        // authorization check compared against — so naming a victim here was
        // enough to hand them the blame and yourself the access.
        threadMeta: { ...threadMsg.threadMeta, createdBy: actor },
        rootMessageText: typeof rootText === 'string' ? rootText : '',
        currentUserAddress: currentUserAddress ?? '',
        now: Date.now(),
      });
      await this.messageDB.saveChannelThread(newThread);
    } else if (threadMsg.action === 'remove') {
      return this.handleThreadRemoveReceive({
        threadMsg,
        targetMessage,
        spaceId,
        channelId,
        actor,
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
      threadMeta: {
        ...targetMessage.threadMeta,
        ...threadMsg.threadMeta,
        // Ownership is set once, at create, and is not a field later frames may
        // carry. Without this pin, anyone authorized to close a thread could
        // also seize it by attaching a new createdBy to that same frame.
        createdBy: targetMessage.threadMeta?.createdBy ?? actor,
      },
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
    /** Already authorized by the caller's gate; the proven signer. */
    actor: string;
    currentUserAddress: string;
    conversationType: string;
    updatedUserProfile: { user_icon: string; display_name: string };
  }): Promise<boolean> {
    const { threadMsg, targetMessage, spaceId, channelId, actor, currentUserAddress, conversationType, updatedUserProfile } = params;

    // Handle root message
    if (targetMessage) {
      // Deciding hard-delete vs strip, so it must be the proven signer: this is
      // the branch that destroys someone else's message outright, and pre-fix
      // both sides of the comparison were attacker-writable.
      const isRootSender = actor === targetMessage.content.senderId;
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
    /** The ed448-proven signer, or null when nothing could be proven. */
    verifiedSender: VerifiedSender | null;
    queryClient: QueryClient;
  }): Promise<boolean> {
    const { threadMsg, spaceId, channelId, verifiedSender, queryClient } = params;

    if (spaceId === channelId) return false;

    const targetMessage = await this.messageDB.getMessage({
      spaceId, channelId, messageId: threadMsg.targetMessageId,
    });

    // Every action except 'remove' needs the root present to act on. The DB
    // path has always required this; the cache path did not, so a 'create'
    // could update the view where the store refused it. Matching them is the
    // point — a decision that differs between the two is the bug class here.
    if (!targetMessage && threadMsg.action !== 'remove') return false;

    // Same gate as the DB path — one verdict, so the two views cannot diverge.
    if (
      !(await this.isThreadFrameAuthorized({
        threadMsg,
        targetMessage,
        spaceId,
        channelId,
        verifiedSender,
      }))
    ) {
      return false;
    }
    const actor = verifiedSender as string;

    if (threadMsg.action === 'remove') {
      return this.handleThreadRemoveCache({
        threadMsg, targetMessage, spaceId, channelId, actor, queryClient,
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
    /** Already authorized by the caller's gate; the proven signer. */
    actor: string;
    queryClient: QueryClient;
  }): Promise<boolean> {
    const { threadMsg, targetMessage, spaceId, channelId, actor, queryClient } = params;
    const threadId = threadMsg.threadMeta.threadId;

    // Mirrors handleThreadRemoveReceive: the proven signer decides whether the
    // root disappears or merely loses its threadMeta.
    const isRootSender = targetMessage
      ? actor === targetMessage.content.senderId
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
    const { threadMsg, spaceId, channelId, currentUserAddress } = params;

    if (spaceId === channelId) return { shouldProceed: false };

    const targetMessage = await this.messageDB.getMessage({
      spaceId, channelId, messageId: threadMsg.targetMessageId,
    });
    if (!targetMessage) return { shouldProceed: false };

    // Idempotent for 'create'
    if (threadMsg.action === 'create' && targetMessage.threadMeta?.threadId === threadMsg.threadMeta.threadId) {
      return { shouldProceed: false };
    }

    // updateTitle: only creator. Send-side, so the actor is simply us — reading
    // it off the outgoing payload would be checking our own claim about
    // ourselves, which proves nothing and drifts from the receive-side rule.
    if (threadMsg.action === 'updateTitle' && currentUserAddress !== targetMessage.threadMeta?.createdBy) {
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
      // Send-side: the actor is the local user, not whatever the payload says.
      const isRootSender = currentUserAddress === targetMessage.content.senderId;
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
