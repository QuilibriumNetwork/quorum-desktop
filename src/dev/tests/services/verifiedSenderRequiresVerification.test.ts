/**
 * INSTRUMENT for the verify/resolve fusion.
 *
 * THE INVARIANT: a sender identity may only be derived from a signing key whose
 * signature this client actually checked. `resolveVerifiedSender` is a REVERSE
 * LOOKUP (key -> inbox address -> member) and runs no cryptography of its own —
 * it trusts that its caller already verified. That trust is currently carried by
 * a comment (`MessageService.ts`, above `resolveSpaceSender`) rather than by the
 * types, so a handler that calls the lookup without satisfying the distant
 * verify gate gets an identity that merely looks proven.
 *
 * WHY update-profile IS THE PROBE. The verify gate opens for non-repudiable
 * spaces, for `CONTROL_MESSAGE_TYPES`, and for @everyone posts. `update-profile`
 * is none of those, so in a REPUDIABLE space the gate never runs and
 * `isUpdateProfileAuthorized` resolves a key nothing checked. Its blast radius is
 * bounded today — the handler refuses to write `inbox_address`, so the residual
 * is the cosmetic display-name spoof accepted in
 * `.done/2026-07-19-update-profile-inbox-poisoning-control-msg-impersonation.md`
 * — but the *shape* is the bug, and it is the shape that generalises.
 *
 * CONTROL ARM, ON PURPOSE. Two cases differing in exactly one variable: whether
 * ed448 verification succeeds. A correct implementation separates them. If both
 * arms move together the harness is measuring something else — fix the harness
 * before trusting either result.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Controllable ed448 verdict. The WASM primitive returns the STRING 'true'. */
const verifyEd448 = vi.fn<(...args: string[]) => string>();

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {
    TripleRatchetEncrypt: vi.fn(),
    DoubleRatchetInboxEncrypt: vi.fn().mockReturnValue([]),
    DoubleRatchetInboxEncryptForceSenderInit: vi.fn().mockReturnValue([]),
  },
  channel_raw: {
    js_sign_ed448: vi.fn().mockReturnValue(JSON.stringify('mock-signature')),
    js_verify_ed448: (...args: string[]) => verifyEd448(...args),
  },
}));

import {
  MessageService,
  type MessageServiceDependencies,
} from '@/services/MessageService';
import {
  buildMessageFingerprint,
  computeMessageIdHex,
  deriveInboxAddress,
} from '@quilibrium/quorum-shared';

const SPACE = 'space-1';
const VICTIM = 'victim-address';

/**
 * The victim's ed448 public key. Public by construction: it rides on every
 * signed message they send, so possessing it proves nothing. Only a signature
 * over this specific message does.
 */
const VICTIM_PUB =
  '2222222222222222222222222222222222222222222222222222222222222222';
const VICTIM_INBOX = deriveInboxAddress(VICTIM_PUB);

/** An update-profile whose messageId genuinely matches its own fingerprint. */
const buildProfileMessage = () => {
  const nonce = 'nonce-probe';
  const content = {
    type: 'update-profile' as const,
    senderId: VICTIM,
    displayName: 'Name The Victim Did Not Choose',
  };
  return {
    spaceId: SPACE,
    channelId: SPACE,
    nonce,
    messageId: computeMessageIdHex(
      buildMessageFingerprint({
        nonce,
        content: content as never,
        senderId: VICTIM,
        spaceId: SPACE,
        channelId: SPACE,
      })
    ),
    digestAlgorithm: 'SHA-256' as const,
    createdDate: Date.now(),
    modifiedDate: Date.now(),
    lastModifiedHash: '',
    content,
    publicKey: VICTIM_PUB,
    // Well-formed hex, wrong bytes: what an attacker without the private key
    // can produce. Distinguishing this from a real signature is the whole job.
    signature: 'ab'.repeat(114),
  };
};

describe('a sender identity is never derived from an unverified key', () => {
  let messageService: MessageService;
  let mockDeps: MessageServiceDependencies;

  beforeEach(() => {
    verifyEd448.mockReset();
    mockDeps = {
      messageDB: {
        saveMessage: vi.fn().mockResolvedValue(undefined),
        getMessage: vi.fn().mockResolvedValue(null),
        getSpace: vi.fn().mockResolvedValue({
          spaceId: SPACE,
          // The gate's blind spot: repudiable, so a non-control type is never
          // routed through the verify block at all.
          isRepudiable: true,
          groups: [],
          roles: [],
        }),
        getSpaceMember: vi.fn().mockResolvedValue({
          user_address: VICTIM,
          address: VICTIM,
          inbox_address: VICTIM_INBOX,
        }),
        getSpaceMembers: vi.fn().mockResolvedValue([
          { user_address: VICTIM, address: VICTIM, inbox_address: VICTIM_INBOX },
        ]),
        getSpaceMemberDevices: vi.fn().mockResolvedValue([]),
        saveSpaceMember: vi.fn().mockResolvedValue(undefined),
        isMessageDeleted: vi.fn().mockResolvedValue(false),
        updateMessage: vi.fn().mockResolvedValue(undefined),
      } as unknown as MessageServiceDependencies['messageDB'],
      enqueueOutbound: vi.fn(),
      addOrUpdateConversation: vi.fn(),
      apiClient: {} as never,
      deleteEncryptionStates: vi.fn().mockResolvedValue(undefined),
      deleteInboxMessages: vi.fn().mockResolvedValue(undefined),
      navigate: vi.fn(),
      spaceInfo: { current: {} } as never,
      syncInfo: { current: {} } as never,
      synchronizeAll: vi.fn().mockResolvedValue(undefined),
      informSyncData: vi.fn().mockResolvedValue(undefined),
      initiateSync: vi.fn().mockResolvedValue(undefined),
      requestSync: vi.fn().mockResolvedValue(undefined),
      directSync: vi.fn().mockResolvedValue(undefined),
      saveConfig: vi.fn().mockResolvedValue(undefined),
      sendHubMessage: vi.fn().mockResolvedValue('message-id'),
    } as unknown as MessageServiceDependencies;

    messageService = new MessageService(mockDeps);
  });

  const receive = () =>
    messageService.saveMessage(
      buildProfileMessage() as never,
      mockDeps.messageDB,
      SPACE,
      SPACE,
      'group',
      {},
      null,
      undefined
    );

  it('ATTACK ARM: a forged signature over a real member key is rejected', async () => {
    verifyEd448.mockReturnValue('false');

    await receive();

    expect(
      mockDeps.messageDB.saveSpaceMember,
      'the victim profile was rewritten by a message carrying a signature nobody checked'
    ).not.toHaveBeenCalled();
  });

  it('CONTROL ARM: a genuine signature over the same key is still accepted', async () => {
    verifyEd448.mockReturnValue('true');

    await receive();

    expect(
      mockDeps.messageDB.saveSpaceMember,
      'the fix over-rejected: a legitimately signed profile update stopped applying'
    ).toHaveBeenCalled();
  });

  it('the ed448 verifier is actually consulted on this path', async () => {
    verifyEd448.mockReturnValue('true');

    await receive();

    // The directest statement of the invariant. Zero calls means the identity
    // came from a reverse lookup over a key no cryptography ever touched.
    expect(
      verifyEd448,
      'no ed448 verification ran, so any sender this path resolved is unproven'
    ).toHaveBeenCalled();
  });

  /**
   * SCOPE BINDING. A control-message signature covers the space and channel it
   * was signed for. The question is which scope the receiver checks against:
   * the one the message CLAIMS (attacker-controlled) or the one the action will
   * actually land in.
   *
   * Checking the claimed scope is self-defeating: the attacker picks both the
   * claim and the signature, so they always agree, and the signature ends up
   * attesting one place while the delete/pin/mute happens somewhere else.
   * Mobile binds the context scope on purpose (`spaceMessageAuth.ts:70-73`);
   * these tests hold desktop to the same rule.
   */
  describe('a control message acts only in the scope its signature names', () => {
    const CHANNEL = 'chan-1';
    const OTHER_SPACE = 'space-2';
    const OTHER_CHANNEL = 'chan-2';

    /** A remove-message genuinely signed for `spaceId`/`channelId`. */
    const controlSignedFor = (spaceId: string, channelId: string) => {
      const nonce = 'nonce-scope';
      const content = {
        type: 'remove-message' as const,
        senderId: VICTIM,
        removeMessageId: 'target-1',
      };
      return {
        spaceId,
        channelId,
        nonce,
        messageId: computeMessageIdHex(
          buildMessageFingerprint({
            nonce,
            content: content as never,
            senderId: VICTIM,
            spaceId,
            channelId,
          })
        ),
        digestAlgorithm: 'SHA-256' as const,
        createdDate: Date.now(),
        modifiedDate: Date.now(),
        lastModifiedHash: '',
        content,
        publicKey: VICTIM_PUB,
        signature: 'ab'.repeat(114),
      };
    };

    /** Their own message, so permissions never enter into the verdict. */
    const target = { content: { senderId: VICTIM, type: 'post' } };

    /** Always delivered into SPACE / CHANNEL, whatever the message claims. */
    const authorizeHere = (msg: unknown) =>
      (
        messageService as unknown as {
          isSpaceControlAuthorized: (
            ...a: unknown[]
          ) => Promise<boolean>;
        }
      ).isSpaceControlAuthorized(
        msg,
        mockDeps.messageDB,
        SPACE,
        CHANNEL,
        target
      );

    it('CONTROL ARM: signed for THIS scope, and honoured', async () => {
      verifyEd448.mockReturnValue('true');
      expect(
        await authorizeHere(controlSignedFor(SPACE, CHANNEL)),
        'a correctly scoped control message stopped working'
      ).toBe(true);
    });

    it('signed for ANOTHER space, so it must not act here', async () => {
      verifyEd448.mockReturnValue('true');
      expect(
        await authorizeHere(controlSignedFor(OTHER_SPACE, CHANNEL)),
        'a signature naming a different space authorized an action in this one'
      ).toBe(false);
    });

    it('signed for ANOTHER channel, so it must not act here', async () => {
      verifyEd448.mockReturnValue('true');
      expect(
        await authorizeHere(controlSignedFor(SPACE, OTHER_CHANNEL)),
        'a signature naming a different channel authorized an action in this one'
      ).toBe(false);
    });
  });
});

/**
 * SOURCE GUARD. The behavioural tests above cover the paths a fixture can
 * reach; this covers the ones it cannot, and it is the cheaper half of the
 * defence. It matches text, so a reformat defeats it — what it can do is make
 * reintroducing the unsafe shape loud instead of silent.
 */
describe('the unverified resolver cannot come back', () => {
  const SOURCE = readFileSync(
    resolve(process.cwd(), 'src/services/MessageService.ts'),
    'utf8'
  );

  it('MessageService neither imports nor calls the raw reverse lookup', () => {
    // `resolveVerifiedSender` runs no cryptography. Reaching it directly means
    // some path can obtain an identity without a signature check — the defect
    // the fused primitive exists to make unrepresentable.
    //
    // Matches an import entry or a call, NOT the name in prose: several
    // comments legitimately explain what the reverse lookup is and why it must
    // be fed a verified key, and those should stay.
    expect(
      /^\s*resolveVerifiedSender,\s*$/m.test(SOURCE),
      'MessageService imported the no-crypto reverse lookup again; use verifySpaceSender'
    ).toBe(false);
    expect(
      /\bresolveVerifiedSender\s*\(/.test(SOURCE),
      'MessageService called the no-crypto reverse lookup again; use verifySpaceSender'
    ).toBe(false);
  });

  it('the sync gate asks a membership question and never keeps the identity', () => {
    // `syncFrameAuth.ts` is the ONE place outside the fused primitive allowed to
    // touch the raw reverse lookup, and this test is the price of that. It is an
    // EXTENSION of the guard above, not an exemption from it: the invariant being
    // protected is "no sender identity without a signature check", and that holds
    // here only because the resolved identity is discarded on the spot.
    //
    // The sync gate genuinely needs a different question from the auth paths —
    // "is this signing key one the space already knows", answered as a boolean,
    // with the ed448 check run against the same key immediately afterwards. If a
    // future edit starts returning, storing or passing on what the lookup
    // returns, that question quietly becomes "who is this", and this fails.
    const SYNC_AUTH = readFileSync(
      resolve(process.cwd(), 'src/services/syncFrameAuth.ts'),
      'utf8'
    );

    const calls = SYNC_AUTH.match(/\bresolveVerifiedSender\s*\(/g) ?? [];
    expect(
      calls.length,
      'syncFrameAuth should call the reverse lookup exactly once'
    ).toBe(1);

    // THE STRUCTURAL ASSERTION, and it is the only one here with real teeth.
    //
    // Used ONLY as an `if` condition, the resolved identity never becomes a
    // value in that module — so there is nothing to leak, by construction. That
    // is what makes the guarantee hold rather than merely be policed.
    //
    // ⚠️ This was briefly replaced with softer checks (count the exports, match
    // the declared return type) when the implementation needed a local to
    // re-screen the resolved row. An independent review then demonstrated TWO
    // low-effort constructions that leaked the identity — via `globalThis`, and
    // via a separate `export { … }` statement the export regex never matches —
    // while passing every one of those checks. A regex cannot follow data flow;
    // it can only observe shape. So the implementation was restructured to
    // filter kicked rows BEFORE the lookup, which removed the need for the local
    // and let this assertion come back. Do not trade it away again: if a change
    // needs the resolved value, the right move is to find a shape that does not.
    //
    // MEASURED after restoring it — five constructions that genuinely move the
    // resolver's return value somewhere observable were run against these
    // assertions, and all five are caught: assign to a local; assign inside the
    // condition; pass it to a function; store it in a module-level variable that
    // is exported; call the resolver a second time. The only shape that passes is
    // the one where the value is never bound to anything.
    expect(
      /\bif\s*\(\s*resolveVerifiedSender\s*\(/.test(SYNC_AUTH),
      'the reverse lookup is no longer used purely as an `if` condition, so the ' +
        'resolved identity now exists as a value that could escape the module. ' +
        'Restructure so it does not, rather than relaxing this check.'
    ).toBe(true);

    expect(
      /(?:return|=)\s*resolveVerifiedSender\s*\(/.test(SYNC_AUTH),
      'syncFrameAuth returned or stored the resolved identity; it must only ever ' +
        'answer a membership question'
    ).toBe(false);
  });

  it('every sender resolution goes through verifySpaceSender', () => {
    // One definition, and at least the four auth paths consuming it: control
    // messages, update-profile, read-only posts, and the @everyone gate.
    const uses = SOURCE.match(/\bverifySpaceSender\b/g) ?? [];
    expect(
      uses.length,
      'a sender-resolution call site was added or removed — re-check that each one verifies'
    ).toBeGreaterThanOrEqual(5);
  });
});

/**
 * THE WIRING, not the rule.
 *
 * `ThreadService` decides correctly when handed a verified signer, and its own
 * tests prove that. What they cannot see is whether MessageService actually
 * hands it one — the two call sites that resolve the signer and pass it in.
 *
 * That gap was MEASURED, not hypothesised: reverting those two call sites to
 * the forgeable `threadMsg.senderId` left all 506 service tests green. Every
 * test was checking the rule; none was checking that the rule was wired up.
 *
 * So this drives a thread frame through `MessageService.saveMessage` end to
 * end. The frame claims to be from the victim and is signed by a key belonging
 * to someone else — the whole attack in one message.
 */
describe('a thread frame is authorized on its signer, end to end', () => {
  const CHANNEL = 'chan-1';
  const ATTACKER = 'attacker-address';
  const ATTACKER_PUB =
    '3333333333333333333333333333333333333333333333333333333333333333';
  const ATTACKER_INBOX = deriveInboxAddress(ATTACKER_PUB);
  const ROOT_ID = 'root-msg-1';

  /**
   * A `thread`/`remove` naming the VICTIM as sender, signed with the ATTACKER's
   * key. The messageId is computed over the CLAIMED senderId, exactly as a real
   * sender would — so nothing here is malformed; only the key betrays it.
   */
  const forgedThreadRemove = (signingKey: string) => {
    const nonce = 'nonce-thread';
    const content = {
      type: 'thread' as const,
      senderId: VICTIM,
      targetMessageId: ROOT_ID,
      action: 'remove' as const,
      threadMeta: { threadId: 'thread-1', createdBy: VICTIM },
    };
    return {
      spaceId: SPACE,
      channelId: CHANNEL,
      nonce,
      messageId: computeMessageIdHex(
        buildMessageFingerprint({
          nonce,
          content: content as never,
          senderId: VICTIM,
          spaceId: SPACE,
          channelId: CHANNEL,
        })
      ),
      digestAlgorithm: 'SHA-256' as const,
      createdDate: Date.now(),
      modifiedDate: Date.now(),
      lastModifiedHash: '',
      content,
      publicKey: signingKey,
      signature: 'ab'.repeat(114),
    };
  };

  let messageService: MessageService;
  let deps: MessageServiceDependencies;

  beforeEach(() => {
    verifyEd448.mockReset();
    verifyEd448.mockReturnValue('true'); // the signature itself is genuine
    deps = {
      messageDB: {
        // The victim's post, carrying a thread the victim opened.
        getMessage: vi.fn().mockResolvedValue({
          messageId: ROOT_ID,
          content: { type: 'post', senderId: VICTIM, text: 'keep me' },
          threadMeta: { threadId: 'thread-1', createdBy: VICTIM },
        }),
        getSpace: vi.fn().mockResolvedValue({
          spaceId: SPACE,
          isRepudiable: true,
          groups: [{ channels: [{ channelId: CHANNEL }] }],
          roles: [], // attacker holds no moderation role
        }),
        getChannelThread: vi.fn().mockResolvedValue(null),
        getChannelThreads: vi.fn().mockResolvedValue([]),
        getThreadMessages: vi
          .fn()
          .mockResolvedValue({ messages: [], replyCount: 0 }),
        getSpaceMembers: vi.fn().mockResolvedValue([
          { user_address: VICTIM, address: VICTIM, inbox_address: VICTIM_INBOX },
          {
            user_address: ATTACKER,
            address: ATTACKER,
            inbox_address: ATTACKER_INBOX,
          },
        ]),
        getSpaceMemberDevices: vi.fn().mockResolvedValue([]),
        getSpaceMember: vi.fn().mockResolvedValue(null),
        saveMessage: vi.fn().mockResolvedValue(undefined),
        saveChannelThread: vi.fn().mockResolvedValue(undefined),
        deleteMessage: vi.fn().mockResolvedValue(undefined),
        deleteChannelThread: vi.fn().mockResolvedValue(undefined),
        isMessageDeleted: vi.fn().mockResolvedValue(false),
        updateMessage: vi.fn().mockResolvedValue(undefined),
        saveSpaceMember: vi.fn().mockResolvedValue(undefined),
        getConversation: vi.fn().mockResolvedValue({ conversation: null }),
      } as unknown as MessageServiceDependencies['messageDB'],
      enqueueOutbound: vi.fn(),
      addOrUpdateConversation: vi.fn(),
      apiClient: {} as never,
      deleteEncryptionStates: vi.fn().mockResolvedValue(undefined),
      deleteInboxMessages: vi.fn().mockResolvedValue(undefined),
      navigate: vi.fn(),
      spaceInfo: { current: {} } as never,
      syncInfo: { current: {} } as never,
      synchronizeAll: vi.fn().mockResolvedValue(undefined),
      informSyncData: vi.fn().mockResolvedValue(undefined),
      initiateSync: vi.fn().mockResolvedValue(undefined),
      requestSync: vi.fn().mockResolvedValue(undefined),
      directSync: vi.fn().mockResolvedValue(undefined),
      saveConfig: vi.fn().mockResolvedValue(undefined),
      sendHubMessage: vi.fn().mockResolvedValue('message-id'),
    } as unknown as MessageServiceDependencies;

    messageService = new MessageService(deps);
  });

  const receive = (msg: unknown) =>
    messageService.saveMessage(
      msg as never,
      deps.messageDB,
      SPACE,
      CHANNEL,
      'group',
      {},
      null,
      undefined
    );

  it('ATTACK ARM: signed by someone else, so the victim\'s message survives', async () => {
    await receive(forgedThreadRemove(ATTACKER_PUB));

    expect(
      deps.messageDB.deleteMessage,
      "the verified signer never reached ThreadService: a thread frame claiming " +
        "the victim's address deleted the victim's message"
    ).not.toHaveBeenCalled();
  });

  it('CONTROL ARM: signed by the thread creator, and still honoured', async () => {
    await receive(forgedThreadRemove(VICTIM_PUB));

    expect(
      deps.messageDB.deleteMessage,
      'the fix over-rejected: the real creator can no longer remove their own thread'
    ).toHaveBeenCalledWith(ROOT_ID);
  });

  it('the ed448 verifier is consulted before any thread action', async () => {
    await receive(forgedThreadRemove(ATTACKER_PUB));

    expect(
      verifyEd448,
      'no signature check ran on the thread path, so its sender is unproven'
    ).toHaveBeenCalled();
  });
});
