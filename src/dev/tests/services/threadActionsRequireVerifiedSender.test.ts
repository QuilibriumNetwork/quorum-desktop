/**
 * Thread control frames must be authorized against the ed448-VERIFIED signer,
 * never against `threadMsg.senderId` — a plaintext field the sending client
 * writes and any space member can set to anyone's address.
 *
 * Every ATTACK ARM here fails against the pre-fix code, and each is paired with
 * a CONTROL ARM performing the same action as its legitimate owner. Without the
 * pairing, deleting the feature outright would score as a fix.
 *
 * These are unit tests over ThreadService because that is where the decision is
 * made. What feeds it — MessageService resolving the signer via
 * `verifySpaceSender` before calling in — is covered by the shared
 * `verifyAndResolveSender` tests and by MessageService.unit.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QueryClient } from '@tanstack/react-query';
import { ThreadService } from '@/services/ThreadService';
import type { MessageDB } from '@/db/messages';
import type { Message, ThreadMessage } from '@quilibrium/quorum-shared';

// Invented addresses. Never use a real account address in a fixture.
const ALICE = 'QmAliceVictimAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const MALLORY = 'QmMalloryAttackerMMMMMMMMMMMMMMMMMMMMMMMMMMMM';
const MODERATOR = 'QmModeratorMoOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO';

/** Alice's post, carrying a thread Alice opened on it. */
function aliceRootWithThread(): Message {
  return {
    messageId: 'msg-root',
    content: { type: 'post', senderId: ALICE, text: 'a message worth keeping' },
    threadMeta: { threadId: 'thread-1', createdBy: ALICE },
  } as unknown as Message;
}

function threadFrame(overrides: Partial<ThreadMessage> = {}): ThreadMessage {
  return {
    type: 'thread',
    senderId: ALICE,
    targetMessageId: 'msg-root',
    action: 'remove',
    threadMeta: { threadId: 'thread-1', createdBy: ALICE },
    ...overrides,
  } as ThreadMessage;
}

function createMockMessageDB(overrides: Partial<MessageDB> = {}): MessageDB {
  return {
    getMessage: vi.fn().mockResolvedValue(null),
    getSpace: vi.fn().mockResolvedValue({ roles: [] }),
    getChannelThread: vi.fn().mockResolvedValue(null),
    getChannelThreads: vi.fn().mockResolvedValue([]),
    getThreadMessages: vi
      .fn()
      .mockResolvedValue({ messages: [], replyCount: 0 }),
    saveMessage: vi.fn().mockResolvedValue(undefined),
    saveChannelThread: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    deleteChannelThread: vi.fn().mockResolvedValue(undefined),
    getConversation: vi.fn().mockResolvedValue({ conversation: null }),
    ...overrides,
  } as unknown as MessageDB;
}

const RECEIVE_CONTEXT = {
  spaceId: 'space-1',
  channelId: 'channel-1',
  currentUserAddress: 'QmLocalReaderRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
  conversationType: 'group',
  updatedUserProfile: { user_icon: '', display_name: '' },
};

describe('thread actions are authorized against the verified signer', () => {
  let threadService: ThreadService;
  let mockDB: MessageDB;

  beforeEach(() => {
    mockDB = createMockMessageDB();
    threadService = new ThreadService(mockDB);
  });

  describe('remove — the destructive one', () => {
    it('ATTACK: a member claiming to be the creator cannot delete the root message', async () => {
      (mockDB.getMessage as any).mockResolvedValue(aliceRootWithThread());

      const honored = await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        // Mallory writes ALICE into the payload. Free to do: the address is
        // public, and pre-fix this field alone decided the outcome.
        threadMsg: threadFrame({ senderId: ALICE, action: 'remove' }),
        verifiedSender: MALLORY,
      });

      expect(honored).toBe(false);
      expect(mockDB.deleteMessage).not.toHaveBeenCalled();
      expect(mockDB.deleteChannelThread).not.toHaveBeenCalled();
    });

    it('CONTROL: the real creator still removes their own thread and root', async () => {
      (mockDB.getMessage as any).mockResolvedValue(aliceRootWithThread());

      const honored = await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        threadMsg: threadFrame({ senderId: ALICE, action: 'remove' }),
        verifiedSender: ALICE,
      });

      expect(honored).toBe(true);
      expect(mockDB.deleteMessage).toHaveBeenCalledWith('msg-root');
      expect(mockDB.deleteChannelThread).toHaveBeenCalledWith('thread-1');
    });

    it('CONTROL: a moderator removes the thread but does NOT hard-delete a message they did not write', async () => {
      (mockDB.getMessage as any).mockResolvedValue(aliceRootWithThread());
      (mockDB.getSpace as any).mockResolvedValue({
        roles: [{ members: [MODERATOR], permissions: ['message:delete'] }],
      });

      const honored = await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        threadMsg: threadFrame({ senderId: MODERATOR, action: 'remove' }),
        verifiedSender: MODERATOR,
      });

      expect(honored).toBe(true);
      // Alice's post survives with its threadMeta stripped.
      expect(mockDB.deleteMessage).not.toHaveBeenCalled();
      expect(mockDB.saveMessage).toHaveBeenCalled();
      const saved = (mockDB.saveMessage as any).mock.calls[0][0] as Message;
      expect(saved.threadMeta).toBeUndefined();
    });

    it('ATTACK: a moderator cannot hard-delete the root by claiming to be its author', async () => {
      (mockDB.getMessage as any).mockResolvedValue(aliceRootWithThread());
      (mockDB.getSpace as any).mockResolvedValue({
        roles: [{ members: [MODERATOR], permissions: ['message:delete'] }],
      });

      // Authorized to act on the thread, but claims ALICE so the hard-delete
      // branch (`isRootSender`) fires instead of the strip branch.
      await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        threadMsg: threadFrame({ senderId: ALICE, action: 'remove' }),
        verifiedSender: MODERATOR,
      });

      expect(mockDB.deleteMessage).not.toHaveBeenCalled();
    });
  });

  describe('close / updateTitle', () => {
    it('ATTACK: a member claiming to be the creator cannot close the thread', async () => {
      (mockDB.getMessage as any).mockResolvedValue(aliceRootWithThread());

      const honored = await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        threadMsg: threadFrame({
          senderId: ALICE,
          action: 'close',
          threadMeta: { threadId: 'thread-1', createdBy: ALICE, isClosed: true },
        }),
        verifiedSender: MALLORY,
      });

      expect(honored).toBe(false);
      expect(mockDB.saveMessage).not.toHaveBeenCalled();
    });

    it('CONTROL: the real creator closes their own thread', async () => {
      (mockDB.getMessage as any).mockResolvedValue(aliceRootWithThread());

      const honored = await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        threadMsg: threadFrame({
          senderId: ALICE,
          action: 'close',
          threadMeta: { threadId: 'thread-1', createdBy: ALICE, isClosed: true },
        }),
        verifiedSender: ALICE,
      });

      expect(honored).toBe(true);
      expect(mockDB.saveMessage).toHaveBeenCalled();
    });

    it('ATTACK: a member claiming to be the creator cannot rename the thread', async () => {
      (mockDB.getMessage as any).mockResolvedValue(aliceRootWithThread());

      const honored = await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        threadMsg: threadFrame({
          senderId: ALICE,
          action: 'updateTitle',
          threadMeta: {
            threadId: 'thread-1',
            createdBy: ALICE,
            customTitle: 'renamed by the attacker',
          },
        }),
        verifiedSender: MALLORY,
      });

      expect(honored).toBe(false);
      expect(mockDB.saveMessage).not.toHaveBeenCalled();
    });
  });

  describe('createdBy is owned by the verifier, not by the wire', () => {
    it('ATTACK: create cannot install someone else as the thread creator', async () => {
      (mockDB.getMessage as any).mockResolvedValue({
        messageId: 'msg-root',
        content: { type: 'post', senderId: ALICE, text: 'a message' },
        threadMeta: undefined,
      } as unknown as Message);

      await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        threadMsg: threadFrame({
          senderId: MALLORY,
          action: 'create',
          // Mallory names ALICE as creator, which pre-fix was copied verbatim
          // and then became the anchor for every later authorization check.
          threadMeta: { threadId: 'thread-1', createdBy: ALICE },
        }),
        verifiedSender: MALLORY,
      });

      expect(mockDB.saveChannelThread).toHaveBeenCalled();
      const savedThread = (mockDB.saveChannelThread as any).mock.calls[0][0];
      expect(savedThread.createdBy).toBe(MALLORY);

      const savedMessage = (mockDB.saveMessage as any).mock
        .calls[0][0] as Message;
      expect(savedMessage.threadMeta?.createdBy).toBe(MALLORY);
    });

    it('ATTACK: a later frame cannot rewrite createdBy to seize the thread', async () => {
      (mockDB.getMessage as any).mockResolvedValue(aliceRootWithThread());
      (mockDB.getSpace as any).mockResolvedValue({
        roles: [{ members: [MODERATOR], permissions: ['message:delete'] }],
      });

      // Legitimately authorized to close, but smuggles a new createdBy in the
      // merged threadMeta — which would make them the permanent owner.
      await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        threadMsg: threadFrame({
          senderId: MODERATOR,
          action: 'close',
          threadMeta: {
            threadId: 'thread-1',
            createdBy: MODERATOR,
            isClosed: true,
          },
        }),
        verifiedSender: MODERATOR,
      });

      expect(mockDB.saveMessage).toHaveBeenCalled();
      const saved = (mockDB.saveMessage as any).mock.calls[0][0] as Message;
      expect(saved.threadMeta?.createdBy).toBe(ALICE);
    });
  });

  describe('an unverifiable frame is never honored', () => {
    it.each(['remove', 'close', 'reopen', 'updateSettings', 'updateTitle', 'create'] as const)(
      'drops %s when no sender could be verified',
      async (action) => {
        (mockDB.getMessage as any).mockResolvedValue(aliceRootWithThread());

        const honored = await threadService.handleThreadReceive({
          ...RECEIVE_CONTEXT,
          threadMsg: threadFrame({
            senderId: ALICE,
            action,
            // A NEW threadId for 'create', or the idempotency short-circuit
            // returns false before authorization is ever consulted and the
            // case passes without testing anything.
            threadMeta: {
              threadId: action === 'create' ? 'thread-2' : 'thread-1',
              createdBy: ALICE,
            },
          }),
          verifiedSender: null,
        });

        expect(honored).toBe(false);
        expect(mockDB.deleteMessage).not.toHaveBeenCalled();
        expect(mockDB.saveMessage).not.toHaveBeenCalled();
        expect(mockDB.saveChannelThread).not.toHaveBeenCalled();
      }
    );
  });

  describe('the cache path enforces the same rule', () => {
    it('ATTACK: a forged remove does not strip the thread from the cache', async () => {
      (mockDB.getMessage as any).mockResolvedValue(aliceRootWithThread());

      const honored = await threadService.handleThreadCache({
        threadMsg: threadFrame({ senderId: ALICE, action: 'remove' }),
        spaceId: 'space-1',
        channelId: 'channel-1',
        queryClient: new QueryClient(),
        verifiedSender: MALLORY,
      });

      expect(honored).toBe(false);
    });

    it('ATTACK: a close frame cannot rewrite createdBy in the live cache', async () => {
      // The DB path pins ownership; if the cache path does not, the attacker's
      // chosen name is what every participant SEES as the thread creator, even
      // though authorization keeps re-reading the correct value from storage.
      (mockDB.getMessage as any).mockResolvedValue(aliceRootWithThread());
      (mockDB.getSpace as any).mockResolvedValue({
        roles: [{ members: [MODERATOR], permissions: ['message:delete'] }],
      });
      const queryClient = new QueryClient();
      // Must match buildMessagesKeyPrefix (['Messages', spaceId, channelId])
      // plus the variant segment, or setQueriesData writes nothing and this
      // test passes while exercising none of the code it names.
      const CACHE_KEY = ['Messages', 'space-1', 'channel-1', 'with-threads'];
      queryClient.setQueryData(CACHE_KEY, {
        pageParams: [undefined],
        pages: [{ messages: [aliceRootWithThread()] }],
      });

      await threadService.handleThreadCache({
        threadMsg: threadFrame({
          senderId: MODERATOR,
          action: 'close',
          threadMeta: {
            threadId: 'thread-1',
            createdBy: MODERATOR,
            isClosed: true,
          },
        }),
        spaceId: 'space-1',
        channelId: 'channel-1',
        queryClient,
        verifiedSender: MODERATOR,
      });

      const cached: any = queryClient.getQueryData(CACHE_KEY);
      const root = cached.pages[0].messages[0];
      expect(root.threadMeta.isClosed).toBe(true); // the action DID apply
      expect(root.threadMeta.createdBy).toBe(ALICE); // ownership did NOT move
    });

    it('CONTROL: the real creator still removes it from the cache', async () => {
      (mockDB.getMessage as any).mockResolvedValue(aliceRootWithThread());

      const honored = await threadService.handleThreadCache({
        threadMsg: threadFrame({ senderId: ALICE, action: 'remove' }),
        spaceId: 'space-1',
        channelId: 'channel-1',
        queryClient: new QueryClient(),
        verifiedSender: ALICE,
      });

      expect(honored).toBe(true);
    });
  });
});

/**
 * SOURCE GUARD — catches a failure the behavioural tests above structurally
 * cannot see.
 *
 * The receive side refuses thread frames without a valid signature. The send
 * side must therefore never honor the "send unsigned" toggle for one. The first
 * attempt at that fix was placed in a branch thread messages never enter
 * (`if (isPostMessage)`, which explicitly excludes them), so it compiled,
 * type-checked, passed every test, and did nothing.
 *
 * Nothing above could have caught it: those tests inject `verifiedSender`
 * directly and never exercise the send path's signing decision. The failure
 * mode it leaves behind is the worst kind here — the sender's own client
 * applies a thread deletion, every other client discards the frame, and no
 * error is raised on either side.
 *
 * So this asserts the shape instead: no send branch may decide signing from the
 * raw toggle. They must all route through the shared `shouldSignOutbound`,
 * which derives the answer from the same list the receive side enforces.
 */
describe('the send path cannot silently emit an unsignable control frame', () => {
  const source = readFileSync(
    resolve(__dirname, '../../../services/MessageService.ts'),
    'utf-8'
  );

  it('decides outbound signing only through the shared helper', () => {
    // The pre-fix shape, verified present at HEAD~ before this guard existed.
    expect(source).not.toMatch(/isRepudiable\s*&&\s*!skipSigning/);
  });

  it('routes the thread and pin send branches through it', () => {
    const calls = source.match(/shouldSignOutbound\(\{/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(source).toMatch(/contentType: 'thread'/);
    expect(source).toMatch(/contentType: 'pin'/);
  });

  it('leaves edits on the inherit rule, which must NOT force-sign', () => {
    // An edit of a deliberately-unsigned message must stay unsigned, or
    // deniability is destroyed by the act of editing.
    expect(source).toMatch(/shouldSignEdit\(originalMessage\)/);
    expect(source).not.toMatch(/contentType: 'edit-message'/);
  });
});
