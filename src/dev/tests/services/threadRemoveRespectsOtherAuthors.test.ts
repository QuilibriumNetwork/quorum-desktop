/**
 * `thread` / `action: 'remove'` hard-deletes every reply in the thread, so the
 * creator's authority over a thread they opened stops where other members'
 * content begins.
 *
 * The product rule is: the creator may remove a thread that holds nothing but
 * their own replies; past that it takes `message:delete` — the same permission
 * that would let them delete those replies one at a time anyway.
 *
 * That rule already existed, but only in `ThreadSettingsModal.tsx:194`, which
 * hides the Delete button and explains why. A missing button decides what an
 * HONEST client offers; it decides nothing about what a receiver accepts. These
 * tests cover the rule where it is actually a boundary — on the receive path,
 * which runs on every recipient's device.
 *
 * A refused frame is DROPPED WHOLE, never partially applied. A client asking for
 * something an honest one will not offer gets nothing, and "nothing happened" is
 * a state the sender's device and everyone else's can agree on.
 *
 * Every ATTACK ARM here fails against the pre-fix code. Each is paired with a
 * CONTROL ARM doing the legitimate version of the same thing, so deleting the
 * feature outright cannot score as a fix.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { ThreadService } from '@/services/ThreadService';
import type { MessageDB } from '@/db/messages';
import type { Message, ThreadMessage } from '@quilibrium/quorum-shared';

// Invented addresses. Never use a real account address in a fixture.
const ALICE = 'QmAliceVictimAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const MALLORY = 'QmMalloryAttackerMMMMMMMMMMMMMMMMMMMMMMMMMMMM';
const MODERATOR = 'QmModeratorMoOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO';

/**
 * Alice's post, carrying a thread MALLORY opened on it.
 *
 * This shape is the whole setup: opening a thread on someone else's message is
 * ordinary, permitted behaviour, and it makes Mallory the thread's creator.
 */
function aliceRootWithMallorysThread(): Message {
  return {
    messageId: 'msg-root',
    content: { type: 'post', senderId: ALICE, text: 'a message worth keeping' },
    threadMeta: { threadId: 'thread-1', createdBy: MALLORY },
  } as unknown as Message;
}

function reply(messageId: string, senderId: string): Message {
  return {
    messageId,
    threadId: 'thread-1',
    isThreadReply: true,
    content: { type: 'post', senderId, text: 'a reply' },
  } as unknown as Message;
}

function removeFrame(senderId: string): ThreadMessage {
  return {
    type: 'thread',
    senderId,
    targetMessageId: 'msg-root',
    action: 'remove',
    threadMeta: { threadId: 'thread-1', createdBy: MALLORY },
  } as ThreadMessage;
}

function createMockMessageDB(replies: Message[]): MessageDB {
  return {
    getMessage: vi.fn().mockResolvedValue(aliceRootWithMallorysThread()),
    getSpace: vi.fn().mockResolvedValue({ roles: [] }),
    getChannelThread: vi.fn().mockResolvedValue(null),
    getChannelThreads: vi.fn().mockResolvedValue([]),
    getThreadMessages: vi
      .fn()
      .mockResolvedValue({ messages: replies, replyCount: replies.length }),
    saveMessage: vi.fn().mockResolvedValue(undefined),
    saveChannelThread: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    deleteChannelThread: vi.fn().mockResolvedValue(undefined),
    getConversation: vi.fn().mockResolvedValue({ conversation: null }),
  } as unknown as MessageDB;
}

const RECEIVE_CONTEXT = {
  spaceId: 'space-1',
  channelId: 'channel-1',
  currentUserAddress: 'QmLocalReaderRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
  conversationType: 'group',
  updatedUserProfile: { user_icon: '', display_name: '' },
};

/** A space where MODERATOR holds `message:delete` by role. */
const MODERATED_SPACE = {
  roles: [{ members: [MODERATOR], permissions: ['message:delete'] }],
};

describe('a thread removal may not destroy other members’ replies', () => {
  describe('receive path (runs on every recipient’s device)', () => {
    let mockDB: MessageDB;
    let threadService: ThreadService;

    const withReplies = (replies: Message[]) => {
      mockDB = createMockMessageDB(replies);
      threadService = new ThreadService(mockDB);
    };

    it('ATTACK: the thread creator cannot wipe a reply written by someone else', async () => {
      withReplies([reply('msg-reply-alice', ALICE)]);

      const honored = await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        threadMsg: removeFrame(MALLORY),
        // No identity lie anywhere: Mallory really is the verified sender and
        // really is the thread's creator. The frame is refused because of what
        // the THREAD contains, not because of who sent it.
        verifiedSender: MALLORY,
      });

      expect(honored).toBe(false);
      // Dropped whole. Not "Mallory's own replies deleted, Alice's kept" — the
      // root must keep its threadMeta and the registry row must survive too.
      expect(mockDB.deleteMessage).not.toHaveBeenCalled();
      expect(mockDB.deleteChannelThread).not.toHaveBeenCalled();
      expect(mockDB.saveMessage).not.toHaveBeenCalled();
    });

    it('ATTACK: one foreign reply among the creator’s own is still enough to refuse it', async () => {
      // The rule is "any reply I did not write", not "a thread that is mostly
      // someone else's". A filter that checked only the first or last reply
      // would pass the test above and fail this one.
      withReplies([
        reply('msg-r1', MALLORY),
        reply('msg-r2', ALICE),
        reply('msg-r3', MALLORY),
      ]);

      const honored = await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        threadMsg: removeFrame(MALLORY),
        verifiedSender: MALLORY,
      });

      expect(honored).toBe(false);
      expect(mockDB.deleteMessage).not.toHaveBeenCalled();
    });

    it('CONTROL: the creator still removes a thread holding only their own replies', async () => {
      withReplies([reply('msg-r1', MALLORY), reply('msg-r2', MALLORY)]);

      const honored = await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        threadMsg: removeFrame(MALLORY),
        verifiedSender: MALLORY,
      });

      expect(honored).toBe(true);
      expect(mockDB.deleteMessage).toHaveBeenCalledWith('msg-r1');
      expect(mockDB.deleteMessage).toHaveBeenCalledWith('msg-r2');
      expect(mockDB.deleteChannelThread).toHaveBeenCalledWith('thread-1');
    });

    it('CONTROL: an empty thread is removable — no replies means no foreign ones', async () => {
      withReplies([]);

      const honored = await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        threadMsg: removeFrame(MALLORY),
        verifiedSender: MALLORY,
      });

      expect(honored).toBe(true);
      expect(mockDB.deleteChannelThread).toHaveBeenCalledWith('thread-1');
    });

    it('CONTROL: a holder of message:delete may still remove a thread others replied in', async () => {
      // Not a loophole: that permission already allows deleting each of those
      // replies individually via `remove-message`. Refusing it here would take
      // away a capability moderators have, without closing anything.
      withReplies([reply('msg-reply-alice', ALICE)]);
      (mockDB.getSpace as any).mockResolvedValue(MODERATED_SPACE);

      const honored = await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        threadMsg: removeFrame(MODERATOR),
        verifiedSender: MODERATOR,
      });

      expect(honored).toBe(true);
      expect(mockDB.deleteMessage).toHaveBeenCalledWith('msg-reply-alice');
    });

    it('fails CLOSED on a reply whose author cannot be read', async () => {
      // No live reply has this shape — the send path always writes senderId and
      // soft-delete preserves it — so this costs nothing in practice. It is
      // pinned because the opposite default (unknown author counts as mine)
      // silently widens a destructive action, and reads identically in a diff.
      withReplies([
        { messageId: 'msg-mystery', content: {} } as unknown as Message,
      ]);

      const honored = await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        threadMsg: removeFrame(MALLORY),
        verifiedSender: MALLORY,
      });

      expect(honored).toBe(false);
      expect(mockDB.deleteMessage).not.toHaveBeenCalled();
    });

    it('ATTACK: the root author’s own permission over the root does not extend to the replies', async () => {
      // `canDeleteMessage` says yes to "may I delete my own message". If the
      // guard reached for that instead of `hasChannelPermission`, Alice would
      // inherit authority over Mallory's replies purely by having written the
      // root. Alice is not the thread's creator, so this is refused earlier —
      // the case is here to pin that no own-message shortcut is introduced.
      withReplies([reply('msg-reply-mallory', MALLORY)]);

      const honored = await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        threadMsg: removeFrame(ALICE),
        verifiedSender: ALICE,
      });

      expect(honored).toBe(false);
      expect(mockDB.deleteMessage).not.toHaveBeenCalled();
    });
  });

  describe('the cache path reaches the same verdict', () => {
    // A verdict that differs between the store and the live view is the bug
    // class this whole area keeps producing: the screen says the thread is gone
    // while the database still holds every reply, or the reverse.
    it('ATTACK: a refused remove does not strip the thread from the cache either', async () => {
      const mockDB = createMockMessageDB([reply('msg-reply-alice', ALICE)]);
      const threadService = new ThreadService(mockDB);

      const honored = await threadService.handleThreadCache({
        threadMsg: removeFrame(MALLORY),
        spaceId: 'space-1',
        channelId: 'channel-1',
        queryClient: new QueryClient(),
        verifiedSender: MALLORY,
      });

      expect(honored).toBe(false);
    });

    it('CONTROL: a permitted remove still clears the cache', async () => {
      const mockDB = createMockMessageDB([reply('msg-r1', MALLORY)]);
      const threadService = new ThreadService(mockDB);

      const honored = await threadService.handleThreadCache({
        threadMsg: removeFrame(MALLORY),
        spaceId: 'space-1',
        channelId: 'channel-1',
        queryClient: new QueryClient(),
        verifiedSender: MALLORY,
      });

      expect(honored).toBe(true);
    });
  });

  describe('the send path will not broadcast a frame receivers must refuse', () => {
    // Not a security boundary — the sender's own client is the one place the
    // rule cannot be enforced against a determined user. It is here so an
    // HONEST client's local cleanup cannot diverge from everyone else's view:
    // `handleThreadSendPostBroadcast` deletes the replies on this device, and
    // it only runs when this gate says proceed.
    //
    // The reachable case is a race, not an attack: the settings modal decides
    // what to show when it opens, so a reply arriving while it is open leaves a
    // stale Delete button on screen.
    const SEND_CONTEXT = {
      spaceId: 'space-1',
      channelId: 'channel-1',
      queryClient: new QueryClient(),
    };

    it('refuses to send a remove for a thread others have replied in', async () => {
      const mockDB = createMockMessageDB([reply('msg-reply-alice', ALICE)]);
      const threadService = new ThreadService(mockDB);

      const { shouldProceed } = await threadService.handleThreadSend({
        ...SEND_CONTEXT,
        threadMsg: removeFrame(MALLORY),
        currentUserAddress: MALLORY,
      });

      expect(shouldProceed).toBe(false);
    });

    it('CONTROL: still sends a remove for a thread holding only our own replies', async () => {
      const mockDB = createMockMessageDB([reply('msg-r1', MALLORY)]);
      const threadService = new ThreadService(mockDB);

      const { shouldProceed } = await threadService.handleThreadSend({
        ...SEND_CONTEXT,
        threadMsg: removeFrame(MALLORY),
        currentUserAddress: MALLORY,
      });

      expect(shouldProceed).toBe(true);
    });

    it('CONTROL: a non-remove action is not gated by the reply check at all', async () => {
      // `close` / `updateSettings` touch metadata only. Gating them on reply
      // authorship would quietly break threads that are working as intended.
      const mockDB = createMockMessageDB([reply('msg-reply-alice', ALICE)]);
      const threadService = new ThreadService(mockDB);

      const { shouldProceed } = await threadService.handleThreadSend({
        ...SEND_CONTEXT,
        threadMsg: {
          ...removeFrame(MALLORY),
          action: 'close',
          threadMeta: {
            threadId: 'thread-1',
            createdBy: MALLORY,
            isClosed: true,
          },
        } as ThreadMessage,
        currentUserAddress: MALLORY,
      });

      expect(shouldProceed).toBe(true);
    });
  });
});
