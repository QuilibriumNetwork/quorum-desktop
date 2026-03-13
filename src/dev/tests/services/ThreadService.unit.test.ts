import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThreadService } from '@/services/ThreadService';
import type { MessageDB } from '@/db/messages';

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
});
