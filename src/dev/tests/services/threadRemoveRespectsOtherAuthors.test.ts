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
import { describe, it, expect, vi } from 'vitest';
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

    it('ATTACK: a remove cannot name one thread while targeting another thread’s root', async () => {
      // The bypass this closes. Nothing required a `remove` frame's threadId to
      // be the thread the TARGET ROOT actually carries, and the two values are
      // then used by different code:
      //
      //   authorization  reads the ROOT's createdBy  (targetMessage.threadMeta)
      //   the reply check and the deletion loop read the FRAME's threadId
      //
      // So Mallory, legitimate creator of a thread on Alice's post that is now
      // full of Alice's replies, points `targetMessageId` at Alice's post and
      // `threadId` at some other empty thread of their own. Authorization sees
      // "creator", the reply check sees an empty thread and permits, and the
      // applier then strips the threadMeta off Alice's post — un-threading it
      // and orphaning every reply, which is the outcome the new rule exists to
      // refuse.
      mockDB = createMockMessageDB([]); // the DECOY thread is empty
      threadService = new ThreadService(mockDB);

      const honored = await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        threadMsg: {
          ...removeFrame(MALLORY),
          targetMessageId: 'msg-root', // Alice's post, carrying thread-1
          threadMeta: { threadId: 'thread-DECOY', createdBy: MALLORY },
        } as ThreadMessage,
        verifiedSender: MALLORY,
      });

      expect(honored).toBe(false);
      // The root must keep its threadMeta: stripping it is the damage here,
      // not the (harmless, self-owned) decoy thread being torn down.
      expect(mockDB.saveMessage).not.toHaveBeenCalled();
      expect(mockDB.deleteMessage).not.toHaveBeenCalled();
      expect(mockDB.deleteChannelThread).not.toHaveBeenCalled();
    });

    it('ATTACK: a remove cannot hard-delete an unrelated message that has no thread at all', async () => {
      // The severe form of the same decoupling, and it needs NO victim reply to
      // exist. `remove`'s root handling hard-deletes the target outright when
      // `isSoftDeleted` — which is computed as "content.text is empty" and is
      // therefore TRUE for every image-only post, embed, sticker, and every
      // message already soft-deleted by an ordinary `remove-message`.
      //
      // Mallory opens a throwaway thread on their OWN post (always permitted,
      // no role needed), then points `targetMessageId` at the victim's
      // caption-less image while naming that throwaway thread. Authorization
      // resolves the creator from `channel_threads`, which is keyed by bare
      // threadId, sees Mallory, and allows. The applier then hard-deletes a
      // message that was never part of any thread, on every device, with a
      // tombstone that also suppresses re-sync.
      mockDB = createMockMessageDB([]);
      (mockDB.getMessage as any).mockResolvedValue({
        messageId: 'msg-victim-image',
        // No `text`, and no `threadMeta` — never threaded by anyone.
        content: { type: 'post', senderId: ALICE, embeddedMedia: ['pic'] },
      } as unknown as Message);
      (mockDB.getChannelThread as any).mockResolvedValue({
        threadId: 'thread-mallorys-own',
        createdBy: MALLORY,
      });
      threadService = new ThreadService(mockDB);

      const honored = await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        threadMsg: {
          ...removeFrame(MALLORY),
          targetMessageId: 'msg-victim-image',
          threadMeta: { threadId: 'thread-mallorys-own', createdBy: MALLORY },
        } as ThreadMessage,
        verifiedSender: MALLORY,
      });

      expect(honored).toBe(false);
      expect(mockDB.deleteMessage).not.toHaveBeenCalled();
    });

    it('CONTROL: a remove naming the root’s own thread is unaffected by that check', async () => {
      withReplies([reply('msg-r1', MALLORY)]);

      const honored = await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        threadMsg: removeFrame(MALLORY), // threadId matches the root's
        verifiedSender: MALLORY,
      });

      expect(honored).toBe(true);
      expect(mockDB.deleteChannelThread).toHaveBeenCalledWith('thread-1');
    });

    it('CONTROL: a remove still works when the root is already gone', async () => {
      // `handleThreadReceive` deliberately allows `remove` with no target
      // (`ThreadService.ts`: "allow proceeding even if root was already
      // deleted"). The consistency check must not turn that into a denial —
      // there is no root to disagree with.
      withReplies([reply('msg-r1', MALLORY)]);
      (mockDB.getMessage as any).mockResolvedValue(null);
      (mockDB.getChannelThread as any).mockResolvedValue({
        threadId: 'thread-1',
        createdBy: MALLORY,
      });

      const honored = await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        threadMsg: removeFrame(MALLORY),
        verifiedSender: MALLORY,
      });

      expect(honored).toBe(true);
      expect(mockDB.deleteChannelThread).toHaveBeenCalledWith('thread-1');
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

    it('the root author’s own permission over the root does not extend to the replies', async () => {
      // ⚠️ NOT a test of `mayRemoveThread`, and it passes against code with no
      // reply-authorship rule at all. Alice is not the thread's creator, so
      // `authorizeThreadAction` refuses her before the new gate is reached.
      //
      // Kept deliberately, as a regression pin rather than coverage: it fails if
      // a future refactor reorders these checks, or reintroduces the own-message
      // shortcut that `canDeleteMessage` has and `hasChannelPermission`
      // deliberately does not. Labelled honestly so it is not counted as
      // evidence the fix works.
      withReplies([reply('msg-reply-mallory', MALLORY)]);

      const honored = await threadService.handleThreadReceive({
        ...RECEIVE_CONTEXT,
        threadMsg: removeFrame(ALICE),
        verifiedSender: ALICE,
      });

      expect(honored).toBe(false);
      expect(mockDB.deleteMessage).not.toHaveBeenCalled();
    });

    describe('read-only channels keep their isolated rule', () => {
      // `hasChannelPermission` ignores the ordinary role/permission list
      // entirely in a read-only channel and asks only "are you one of this
      // channel's managers" (channelPermissions.ts:169-181). Every other case
      // in this file leaves `channel` undefined, so without these two the
      // read-only branch of `mayRemoveThread`'s fallback is never executed.
      const readOnlySpace = (managerRoleIds: string[]) => ({
        roles: [
          // Mallory holds `message:delete` the ORDINARY way. In a read-only
          // channel that must count for nothing.
          {
            roleId: 'role-mod',
            members: [MALLORY],
            permissions: ['message:delete'],
          },
          { roleId: 'role-mgr', members: [MALLORY], permissions: [] },
        ],
        groups: [
          {
            channels: [
              { channelId: 'channel-1', isReadOnly: true, managerRoleIds },
            ],
          },
        ],
      });

      // Both arms send as MALLORY, the thread's CREATOR, so
      // `authorizeThreadAction` allows and the verdict genuinely turns on
      // `mayRemoveThread`'s fallback. Sending as a non-creator would be refused
      // by the older check first and would exercise none of this.
      it('ATTACK: an ordinary message:delete role does not survive into a read-only channel', async () => {
        withReplies([reply('msg-reply-alice', ALICE)]);
        (mockDB.getSpace as any).mockResolvedValue(readOnlySpace([]));

        const honored = await threadService.handleThreadReceive({
          ...RECEIVE_CONTEXT,
          threadMsg: removeFrame(MALLORY),
          verifiedSender: MALLORY,
        });

        // Would be TRUE if the fallback used the traditional role list, since
        // Mallory does hold `message:delete` there.
        expect(honored).toBe(false);
        expect(mockDB.deleteMessage).not.toHaveBeenCalled();
      });

      it('CONTROL: a manager of that read-only channel may still remove it', async () => {
        withReplies([reply('msg-reply-alice', ALICE)]);
        (mockDB.getSpace as any).mockResolvedValue(readOnlySpace(['role-mgr']));

        const honored = await threadService.handleThreadReceive({
          ...RECEIVE_CONTEXT,
          threadMsg: removeFrame(MALLORY),
          verifiedSender: MALLORY,
        });

        expect(honored).toBe(true);
        expect(mockDB.deleteMessage).toHaveBeenCalledWith('msg-reply-alice');
      });
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

    it('undoes the caller’s optimistic wipe when it refuses', async () => {
      // `Channel.tsx:906-937` strips the thread from three caches BEFORE
      // submitting, and never looks at the result. That was safe while no
      // refusal was reachable from that button; this refusal IS reachable (the
      // stale-modal race), so a refusal that stayed silent would leave the
      // remover looking at a thread the UI says is gone and the store says is
      // not. Refetching is the repair, because the store is right.
      const mockDB = createMockMessageDB([reply('msg-reply-alice', ALICE)]);
      const threadService = new ThreadService(mockDB);
      const queryClient = new QueryClient();
      const invalidated = vi.spyOn(queryClient, 'invalidateQueries');

      const { shouldProceed } = await threadService.handleThreadSend({
        ...SEND_CONTEXT,
        queryClient,
        threadMsg: removeFrame(MALLORY),
        currentUserAddress: MALLORY,
      });

      expect(shouldProceed).toBe(false);
      const keys = invalidated.mock.calls.map((c) =>
        JSON.stringify((c[0] as { queryKey: unknown[] }).queryKey)
      );
      // All three of the caches the caller wiped, or the view stays stale in
      // whichever one was missed.
      expect(keys).toContainEqual(
        JSON.stringify(['Messages', 'space-1', 'channel-1'])
      );
      expect(keys).toContainEqual(
        JSON.stringify(['thread-messages', 'space-1', 'channel-1', 'thread-1'])
      );
      expect(keys).toContainEqual(
        JSON.stringify(['channel-threads', 'space-1', 'channel-1'])
      );
    });

    it('CONTROL: a permitted remove does NOT invalidate — the caller’s optimistic wipe was right', async () => {
      // Invalidating here would refetch from the store before the post-broadcast
      // handler has deleted anything, resurrecting the thread on screen. That is
      // the reason `Channel.tsx:927-929` deliberately does not invalidate.
      const mockDB = createMockMessageDB([reply('msg-r1', MALLORY)]);
      const threadService = new ThreadService(mockDB);
      const queryClient = new QueryClient();
      const invalidated = vi.spyOn(queryClient, 'invalidateQueries');

      const { shouldProceed } = await threadService.handleThreadSend({
        ...SEND_CONTEXT,
        queryClient,
        threadMsg: removeFrame(MALLORY),
        currentUserAddress: MALLORY,
      });

      expect(shouldProceed).toBe(true);
      expect(invalidated).not.toHaveBeenCalled();
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
