import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { ThreadService } from '@/services/ThreadService';
import type { MessageDB } from '@/db/messages';
import type { ThreadMessage, ChannelThread } from '@/api/quorumApi';

// Minimal mock for MessageDB
function createMockMessageDB(overrides: Partial<MessageDB> = {}): MessageDB {
  return {
    getMessage: vi.fn().mockResolvedValue(null),
    getSpace: vi.fn().mockResolvedValue(null),
    getChannelThread: vi.fn().mockResolvedValue(null),
    getChannelThreads: vi.fn().mockResolvedValue([]),
    getThreadMessages: vi.fn().mockResolvedValue({ messages: [], replyCount: 0 }),
    saveMessage: vi.fn().mockResolvedValue(undefined),
    saveChannelThread: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    deleteChannelThread: vi.fn().mockResolvedValue(undefined),
    getConversation: vi.fn().mockResolvedValue({ conversation: null }),
    ...overrides,
  } as unknown as MessageDB;
}

describe('ThreadService', () => {
  let threadService: ThreadService;
  let mockDB: MessageDB;

  beforeEach(() => {
    mockDB = createMockMessageDB();
    threadService = new ThreadService(mockDB);
  });

  describe('isThreadAuthorized', () => {
    it('returns true when sender is thread creator', async () => {
      const result = await threadService.isThreadAuthorized({
        senderId: 'user-a',
        createdBy: 'user-a',
        spaceId: 'space-1',
      });
      expect(result).toBe(true);
      // Should NOT call getSpace — short-circuits on author match
      expect(mockDB.getSpace).not.toHaveBeenCalled();
    });

    it('returns true when sender has message:delete permission', async () => {
      (mockDB.getSpace as any).mockResolvedValue({
        roles: [{
          members: ['user-mod'],
          permissions: ['message:delete'],
        }],
      });
      const result = await threadService.isThreadAuthorized({
        senderId: 'user-mod',
        createdBy: 'user-other',
        spaceId: 'space-1',
      });
      expect(result).toBe(true);
    });

    it('returns false when sender is neither author nor has permission', async () => {
      (mockDB.getSpace as any).mockResolvedValue({
        roles: [{
          members: ['user-mod'],
          permissions: ['message:pin'],  // wrong permission
        }],
      });
      const result = await threadService.isThreadAuthorized({
        senderId: 'user-random',
        createdBy: 'user-other',
        spaceId: 'space-1',
      });
      expect(result).toBe(false);
    });

    it('returns false when space has no roles', async () => {
      (mockDB.getSpace as any).mockResolvedValue({ roles: undefined });
      const result = await threadService.isThreadAuthorized({
        senderId: 'user-random',
        createdBy: 'user-other',
        spaceId: 'space-1',
      });
      expect(result).toBe(false);
    });
  });

  describe('handleThreadReceive', () => {
    it('rejects DMs (spaceId === channelId)', async () => {
      const threadMsg: ThreadMessage = {
        type: 'thread',
        senderId: 'user-a',
        targetMessageId: 'msg-1',
        action: 'create',
        threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
      };
      const result = await threadService.handleThreadReceive({
        threadMsg,
        spaceId: 'same-id',
        channelId: 'same-id',
        currentUserAddress: 'user-a',
        conversationType: 'group',
        updatedUserProfile: { user_icon: '', display_name: '' },
      });
      expect(result).toBe(false);
    });

    it('creates thread and saves to channel_threads registry', async () => {
      const rootMessage = {
        messageId: 'msg-1',
        content: { type: 'post', senderId: 'user-a', text: 'Hello world' },
        threadMeta: undefined,
      };
      (mockDB.getMessage as any).mockResolvedValue(rootMessage);

      const threadMsg: ThreadMessage = {
        type: 'thread',
        senderId: 'user-a',
        targetMessageId: 'msg-1',
        action: 'create',
        threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
      };
      const result = await threadService.handleThreadReceive({
        threadMsg,
        spaceId: 'space-1',
        channelId: 'channel-1',
        currentUserAddress: 'user-a',
        conversationType: 'group',
        updatedUserProfile: { user_icon: '', display_name: '' },
      });
      expect(result).toBe(true);
      expect(mockDB.saveChannelThread).toHaveBeenCalledOnce();
      expect(mockDB.saveMessage).toHaveBeenCalledOnce();
    });

    it('skips create when threadId already set (idempotent)', async () => {
      const rootMessage = {
        messageId: 'msg-1',
        content: { type: 'post', senderId: 'user-a', text: 'Hello' },
        threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
      };
      (mockDB.getMessage as any).mockResolvedValue(rootMessage);

      const threadMsg: ThreadMessage = {
        type: 'thread',
        senderId: 'user-a',
        targetMessageId: 'msg-1',
        action: 'create',
        threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
      };
      const result = await threadService.handleThreadReceive({
        threadMsg,
        spaceId: 'space-1',
        channelId: 'channel-1',
        currentUserAddress: 'user-a',
        conversationType: 'group',
        updatedUserProfile: { user_icon: '', display_name: '' },
      });
      expect(result).toBe(false); // Idempotent skip
      expect(mockDB.saveChannelThread).not.toHaveBeenCalled();
    });

    it('rejects updateTitle from non-creator', async () => {
      const rootMessage = {
        messageId: 'msg-1',
        content: { type: 'post', senderId: 'user-a', text: 'Hello' },
        threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
      };
      (mockDB.getMessage as any).mockResolvedValue(rootMessage);

      const threadMsg: ThreadMessage = {
        type: 'thread',
        senderId: 'user-intruder',
        targetMessageId: 'msg-1',
        action: 'updateTitle',
        threadMeta: { threadId: 'thread-1', createdBy: 'user-a', customTitle: 'Hacked' },
      };
      const result = await threadService.handleThreadReceive({
        threadMsg,
        spaceId: 'space-1',
        channelId: 'channel-1',
        currentUserAddress: 'user-a',
        conversationType: 'group',
        updatedUserProfile: { user_icon: '', display_name: '' },
      });
      expect(result).toBe(false);
      expect(mockDB.saveMessage).not.toHaveBeenCalled();
    });

    it('remove action: hard-deletes root if sender is root author', async () => {
      const rootMessage = {
        messageId: 'msg-1',
        content: { type: 'post', senderId: 'user-a', text: 'Hello' },
        threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
      };
      (mockDB.getMessage as any).mockResolvedValue(rootMessage);
      (mockDB.getSpace as any).mockResolvedValue({ roles: [] });
      (mockDB.getThreadMessages as any).mockResolvedValue({ messages: [{ messageId: 'reply-1' }] });

      const threadMsg: ThreadMessage = {
        type: 'thread',
        senderId: 'user-a',
        targetMessageId: 'msg-1',
        action: 'remove',
        threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
      };
      const result = await threadService.handleThreadReceive({
        threadMsg,
        spaceId: 'space-1',
        channelId: 'channel-1',
        currentUserAddress: 'user-a',
        conversationType: 'group',
        updatedUserProfile: { user_icon: '', display_name: '' },
      });
      expect(result).toBe(true);
      // Root hard-deleted + 1 reply hard-deleted
      expect(mockDB.deleteMessage).toHaveBeenCalledTimes(2);
      expect(mockDB.deleteChannelThread).toHaveBeenCalledWith('thread-1');
    });

    it('close action: authorized by thread creator', async () => {
      const rootMessage = {
        messageId: 'msg-1',
        content: { type: 'post', senderId: 'user-a', text: 'Hello' },
        threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
      };
      (mockDB.getMessage as any).mockResolvedValue(rootMessage);
      (mockDB.getChannelThreads as any).mockResolvedValue([
        { threadId: 'thread-1', isClosed: false },
      ]);

      const threadMsg: ThreadMessage = {
        type: 'thread',
        senderId: 'user-a',
        targetMessageId: 'msg-1',
        action: 'close',
        threadMeta: { threadId: 'thread-1', createdBy: 'user-a', isClosed: true },
      };
      const result = await threadService.handleThreadReceive({
        threadMsg,
        spaceId: 'space-1',
        channelId: 'channel-1',
        currentUserAddress: 'user-a',
        conversationType: 'group',
        updatedUserProfile: { user_icon: '', display_name: '' },
      });
      expect(result).toBe(true);
      expect(mockDB.saveChannelThread).toHaveBeenCalledOnce();
      const saved = (mockDB.saveChannelThread as any).mock.calls[0][0];
      expect(saved.isClosed).toBe(true);
    });

    it('close action: rejected for unauthorized user', async () => {
      const rootMessage = {
        messageId: 'msg-1',
        content: { type: 'post', senderId: 'user-a', text: 'Hello' },
        threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
      };
      (mockDB.getMessage as any).mockResolvedValue(rootMessage);
      (mockDB.getSpace as any).mockResolvedValue({ roles: [] });

      const threadMsg: ThreadMessage = {
        type: 'thread',
        senderId: 'user-random',
        targetMessageId: 'msg-1',
        action: 'close',
        threadMeta: { threadId: 'thread-1', createdBy: 'user-a', isClosed: true },
      };
      const result = await threadService.handleThreadReceive({
        threadMsg,
        spaceId: 'space-1',
        channelId: 'channel-1',
        currentUserAddress: 'user-a',
        conversationType: 'group',
        updatedUserProfile: { user_icon: '', display_name: '' },
      });
      expect(result).toBe(false);
    });

    it('remove action: falls back to channel_threads registry when root is null', async () => {
      (mockDB.getMessage as any).mockResolvedValue(null);
      (mockDB.getChannelThread as any).mockResolvedValue({
        threadId: 'thread-1',
        createdBy: 'user-a',
      });
      (mockDB.getSpace as any).mockResolvedValue({ roles: [] });
      (mockDB.getThreadMessages as any).mockResolvedValue({ messages: [] });

      const threadMsg: ThreadMessage = {
        type: 'thread',
        senderId: 'user-a',
        targetMessageId: 'msg-1',
        action: 'remove',
        threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
      };
      const result = await threadService.handleThreadReceive({
        threadMsg,
        spaceId: 'space-1',
        channelId: 'channel-1',
        currentUserAddress: 'user-a',
        conversationType: 'group',
        updatedUserProfile: { user_icon: '', display_name: '' },
      });
      expect(result).toBe(true);
      expect(mockDB.getChannelThread).toHaveBeenCalledWith('thread-1');
      expect(mockDB.deleteChannelThread).toHaveBeenCalledWith('thread-1');
    });

    it('remove action: strips threadMeta when root belongs to another user', async () => {
      const rootMessage = {
        messageId: 'msg-1',
        content: { type: 'post', senderId: 'user-b', text: 'Their message' },
        threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
      };
      (mockDB.getMessage as any).mockResolvedValue(rootMessage);
      (mockDB.getSpace as any).mockResolvedValue({ roles: [] });
      (mockDB.getThreadMessages as any).mockResolvedValue({ messages: [] });

      const threadMsg: ThreadMessage = {
        type: 'thread',
        senderId: 'user-a',
        targetMessageId: 'msg-1',
        action: 'remove',
        threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
      };
      const result = await threadService.handleThreadReceive({
        threadMsg,
        spaceId: 'space-1',
        channelId: 'channel-1',
        currentUserAddress: 'user-a',
        conversationType: 'group',
        updatedUserProfile: { user_icon: '', display_name: '' },
      });
      expect(result).toBe(true);
      // Root NOT hard-deleted — saved with threadMeta stripped
      expect(mockDB.deleteMessage).not.toHaveBeenCalled();
      expect(mockDB.saveMessage).toHaveBeenCalledOnce();
      const savedMsg = (mockDB.saveMessage as any).mock.calls[0][0];
      expect(savedMsg.threadMeta).toBeUndefined();
    });
  });

  describe('handleThreadReplyReceive', () => {
    it('marks message as isThreadReply and updates channel_threads registry', async () => {
      const existingThread: ChannelThread = {
        threadId: 'thread-1', spaceId: 'space-1', channelId: 'channel-1',
        rootMessageId: 'msg-1', createdBy: 'user-a', createdAt: 1000,
        lastActivityAt: 1000, replyCount: 1, isClosed: false,
        hasParticipated: false,
      };
      (mockDB.getChannelThreads as any).mockResolvedValue([existingThread]);

      const message = {
        threadId: 'thread-1',
        isThreadReply: false,
        content: { senderId: 'user-b' },
        createdDate: 5000,
      } as any;

      const result = await threadService.handleThreadReplyReceive({
        message,
        spaceId: 'space-1',
        channelId: 'channel-1',
        currentUserAddress: 'user-local',
      });
      expect(result).toBe(true);
      expect(message.isThreadReply).toBe(true);
      expect(mockDB.saveChannelThread).toHaveBeenCalledOnce();
      const saved = (mockDB.saveChannelThread as any).mock.calls[0][0];
      expect(saved.replyCount).toBe(2);
      expect(saved.lastActivityAt).toBe(5000);
    });

    it('does nothing for non-thread messages', async () => {
      const message = { content: { senderId: 'user-a' } } as any;
      const result = await threadService.handleThreadReplyReceive({
        message,
        spaceId: 'space-1',
        channelId: 'channel-1',
        currentUserAddress: 'user-a',
      });
      expect(result).toBe(false);
    });
  });

  describe('handleThreadCache', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
      queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
    });

    it('rejects DMs', async () => {
      const threadMsg = {
        type: 'thread' as const,
        senderId: 'user-a',
        targetMessageId: 'msg-1',
        action: 'create' as const,
        threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
      };
      const result = await threadService.handleThreadCache({
        threadMsg,
        spaceId: 'same',
        channelId: 'same',
        queryClient,
      });
      expect(result).toBe(false);
    });

    it('updateTitle: rejects non-creator', async () => {
      (mockDB.getMessage as any).mockResolvedValue({
        messageId: 'msg-1',
        content: { senderId: 'user-a' },
        threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
      });
      const threadMsg = {
        type: 'thread' as const,
        senderId: 'user-intruder',
        targetMessageId: 'msg-1',
        action: 'updateTitle' as const,
        threadMeta: { threadId: 'thread-1', createdBy: 'user-a', customTitle: 'Hacked' },
      };
      const result = await threadService.handleThreadCache({
        threadMsg,
        spaceId: 'space-1',
        channelId: 'channel-1',
        queryClient,
      });
      expect(result).toBe(false);
    });

    it('remove: removes thread from channel-threads cache', async () => {
      (mockDB.getMessage as any).mockResolvedValue({
        messageId: 'msg-1',
        content: { senderId: 'user-a', text: 'Hello' },
        threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
      });
      (mockDB.getSpace as any).mockResolvedValue({ roles: [] });

      // Seed channel-threads cache
      queryClient.setQueryData(['channel-threads', 'space-1', 'channel-1'], [
        { threadId: 'thread-1' },
        { threadId: 'thread-2' },
      ]);

      const threadMsg = {
        type: 'thread' as const,
        senderId: 'user-a',
        targetMessageId: 'msg-1',
        action: 'remove' as const,
        threadMeta: { threadId: 'thread-1', createdBy: 'user-a' },
      };
      const result = await threadService.handleThreadCache({
        threadMsg,
        spaceId: 'space-1',
        channelId: 'channel-1',
        queryClient,
      });
      expect(result).toBe(true);
      const threads = queryClient.getQueryData(['channel-threads', 'space-1', 'channel-1']) as any[];
      expect(threads).toHaveLength(1);
      expect(threads[0].threadId).toBe('thread-2');
    });
  });

  describe('handleThreadReplyCache', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
      queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
    });

    it('invalidates thread-messages and thread-stats queries', () => {
      const spy = vi.spyOn(queryClient, 'invalidateQueries');

      threadService.handleThreadReplyCache({
        message: { threadId: 'thread-1', isThreadReply: true, createdDate: 5000 } as any,
        spaceId: 'space-1',
        channelId: 'channel-1',
        queryClient,
      });

      expect(spy).toHaveBeenCalledWith({
        queryKey: ['thread-messages', 'space-1', 'channel-1', 'thread-1'],
      });
      expect(spy).toHaveBeenCalledWith({
        queryKey: ['thread-stats', 'space-1', 'channel-1', 'thread-1'],
      });
      expect(spy).toHaveBeenCalledWith({
        queryKey: ['channel-threads', 'space-1', 'channel-1'],
      });
    });

    it('returns false for non-thread-reply messages', () => {
      const result = threadService.handleThreadReplyCache({
        message: { content: { senderId: 'user-a' } } as any,
        spaceId: 'space-1',
        channelId: 'channel-1',
        queryClient,
      });
      expect(result).toBe(false);
    });
  });

  describe('handleThreadDeletedMessageCache', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
      queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
    });

    it('updates thread-messages cache when a thread reply is deleted', () => {
      // Seed thread-messages cache
      queryClient.setQueryData(
        ['thread-messages', 'space-1', 'channel-1', 'thread-1'],
        { messages: [{ messageId: 'reply-1' }, { messageId: 'reply-2' }], replyCount: 2 }
      );

      threadService.handleThreadDeletedMessageCache({
        targetMessage: { messageId: 'reply-1', isThreadReply: true, threadId: 'thread-1' } as any,
        spaceId: 'space-1',
        channelId: 'channel-1',
        queryClient,
      });

      const data = queryClient.getQueryData(['thread-messages', 'space-1', 'channel-1', 'thread-1']) as any;
      expect(data.messages).toHaveLength(1);
      expect(data.replyCount).toBe(1);
    });

    it('does nothing for non-thread messages', () => {
      const spy = vi.spyOn(queryClient, 'setQueryData');
      threadService.handleThreadDeletedMessageCache({
        targetMessage: { messageId: 'msg-1' } as any,
        spaceId: 'space-1',
        channelId: 'channel-1',
        queryClient,
      });
      // Only called if targetMessage is a thread reply
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
