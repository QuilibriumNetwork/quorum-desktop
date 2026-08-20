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
});
