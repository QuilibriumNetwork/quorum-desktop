/**
 * A space frame we could not OPEN must stay on the relay.
 *
 * ── Why this test exists ────────────────────────────────────────────────────
 *
 * The relay holds a frame until the client deletes it, and that delete IS the
 * ack. So deleting a frame we never opened destroys the only copy — permanently,
 * and silently, because the error goes to `console.error` which is a no-op in
 * production builds.
 *
 * The space path did exactly that: its whole unseal/dispatch block is wrapped in
 * `try { … } catch (e) { console.error(…) }` with no `return`, and execution then
 * fell through to an unconditional `dispatchInboxDelete`. The DM path has had the
 * opposite discipline since 2026-07-25, when replaying real captured frames
 * proved 5 of 6 frames desktop had deleted were decryptable against a state
 * desktop itself held ~35 s later.
 *
 * ⚠️ The assertion that matters is `deleteInboxMessages` NOT being called.
 * "It didn't crash" is not the property — a frame can be lost with no error at
 * all, which is precisely how this survived.
 *
 * See issues/.open/2026-08-03-a-space-frame-that-fails-to-decrypt-is-deleted-from-the-relay.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageService } from '../../../services/MessageService';
import { FRAME_RETRY_MAX_ATTEMPTS } from '../../../utils/frameRetry';

const SPACE_ID = 'QmSpaceAddressAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const SPACE_INBOX = 'QmSpaceInboxBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const DEVICE_INBOX = 'QmDeviceInboxCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
const SELF = 'QmSelfAddressDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';

/** Flip to make the envelope refuse to open, as a rotated/absent key would. */
let unsealThrows = false;
/** What a SUCCESSFUL unseal decodes to. */
let unsealedPayload = '';

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {
    UnsealHubEnvelope: vi.fn(async () => {
      if (unsealThrows) throw new Error('aead::Error: decryption failed');
      return Array.from(new TextEncoder().encode(unsealedPayload));
    }),
    UnsealSyncEnvelope: vi.fn(async () => {
      if (unsealThrows) throw new Error('aead::Error: decryption failed');
      return Array.from(new TextEncoder().encode(unsealedPayload));
    }),
  },
  channel_raw: {
    js_sign_ed448: vi.fn().mockReturnValue(JSON.stringify('mock-signature')),
    js_verify_ed448: vi.fn().mockReturnValue(true),
  },
}));

const keyset = {
  deviceKeyset: {
    inbox_keyset: {
      inbox_address: DEVICE_INBOX,
      inbox_key: { public_key: [1, 2, 3], private_key: [4, 5, 6] },
    },
    identity_key: { public_key: [7, 8, 9] },
  },
  userKeyset: {},
} as any;

const spaceKey = {
  publicKey: '00'.repeat(57),
  privateKey: '00'.repeat(57),
  address: SPACE_INBOX,
};

/**
 * A hub-broadcast space frame. `encryptedContent` is deliberately anything but
 * `type: 'sync'`, so the handler takes the hub path.
 *
 * `ts` distinguishes frames: the retry tracker keys off inbox + content, so two
 * frames with different content are tracked independently.
 */
function spaceFrame(ts: number, marker = 'x') {
  return {
    inboxAddress: SPACE_INBOX,
    encryptedContent: JSON.stringify({ type: 'group', marker }),
    timestamp: ts,
  } as any;
}

describe('a space frame that cannot be opened is kept on the relay', () => {
  let messageService: MessageService;
  let mockDeps: any;

  beforeEach(() => {
    unsealThrows = false;
    unsealedPayload = JSON.stringify({
      type: 'control',
      message: { type: 'sync-info' },
    });

    mockDeps = {
      messageDB: {
        getAllEncryptionStates: vi.fn().mockResolvedValue([
          {
            inboxId: SPACE_INBOX,
            conversationId: `${SPACE_ID}/${SPACE_ID}`,
            // No `sending_inbox` — this is what selects the SPACE path.
            state: JSON.stringify({}),
          },
        ]),
        getEncryptionStates: vi.fn().mockResolvedValue([]),
        getConversation: vi.fn().mockResolvedValue({ conversation: null }),
        getSpaceKey: vi.fn().mockResolvedValue(spaceKey),
        getSpaceMembers: vi.fn().mockResolvedValue([]),
        getSpaceMember: vi.fn().mockResolvedValue(null),
        saveSpaceMember: vi.fn().mockResolvedValue(undefined),
        saveEncryptionState: vi.fn().mockResolvedValue(undefined),
        saveMessage: vi.fn().mockResolvedValue(undefined),
        getMessage: vi.fn().mockResolvedValue(null),
        getMessages: vi.fn().mockResolvedValue({ messages: [], hasMore: false }),
        isMessageDeleted: vi.fn().mockResolvedValue(false),
        updateMessage: vi.fn().mockResolvedValue(undefined),
        getSpace: vi.fn().mockResolvedValue({ spaceId: SPACE_ID }),
      },
      enqueueOutbound: vi.fn(),
      addOrUpdateConversation: vi.fn(),
      apiClient: {},
      deleteEncryptionStates: vi.fn().mockResolvedValue(undefined),
      deleteInboxMessages: vi.fn().mockResolvedValue(undefined),
      navigate: vi.fn(),
      spaceInfo: { current: {} },
      syncInfo: { current: {} },
      synchronizeAll: vi.fn().mockResolvedValue(undefined),
      informSyncData: vi.fn().mockResolvedValue(undefined),
      initiateSync: vi.fn().mockResolvedValue(undefined),
      requestSync: vi.fn().mockResolvedValue(true),
      directSync: vi.fn().mockResolvedValue(undefined),
      saveConfig: vi.fn().mockResolvedValue(undefined),
      sendHubMessage: vi.fn().mockResolvedValue('message-id'),
      handleSyncInitiateV2: vi.fn().mockResolvedValue(undefined),
      handleSyncManifest: vi.fn().mockResolvedValue(undefined),
    };

    messageService = new MessageService(mockDeps);
  });

  const deliver = (frame: any) =>
    messageService.handleNewMessage(SELF, keyset, frame, {
      refetchQueries: vi.fn(),
      setQueryData: vi.fn(),
      invalidateQueries: vi.fn(),
      getQueryData: vi.fn(),
    } as any);

  /** `dispatchInboxDelete` defers through a resolved promise. */
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('does NOT delete a frame it could not open', async () => {
    unsealThrows = true;

    await deliver(spaceFrame(1111));
    await settle();

    expect(mockDeps.deleteInboxMessages).not.toHaveBeenCalled();
  });

  // The counterpart, and the reason the test above is not just "deletes are
  // broken": a frame that opens normally must still be acked, or every processed
  // frame would be redelivered forever.
  it('still deletes a frame that opened normally', async () => {
    unsealThrows = false;

    await deliver(spaceFrame(2222));
    await settle();

    expect(mockDeps.deleteInboxMessages).toHaveBeenCalled();
  });

  // Retention must be bounded. A frame that can NEVER open would otherwise be
  // redelivered on every reconnect for the lifetime of the account — its own
  // denial of service, and the reason the original unconditional delete existed.
  it('gives up and deletes once the retry budget is exhausted', async () => {
    unsealThrows = true;
    const frame = spaceFrame(3333, 'poison');

    // One short of the ceiling: still retained.
    for (let i = 0; i < FRAME_RETRY_MAX_ATTEMPTS - 1; i++) {
      await deliver(frame);
    }
    await settle();
    expect(mockDeps.deleteInboxMessages).not.toHaveBeenCalled();

    // The attempt that spends the budget.
    await deliver(frame);
    await settle();
    expect(mockDeps.deleteInboxMessages).toHaveBeenCalled();
  });

  // The budget is per frame, not global — one poisonous frame must not spend
  // another frame's allowance.
  it('tracks frames independently', async () => {
    unsealThrows = true;

    for (let i = 0; i < FRAME_RETRY_MAX_ATTEMPTS - 1; i++) {
      await deliver(spaceFrame(4444, 'first'));
    }
    // A DIFFERENT frame, arriving with the other one's budget nearly spent.
    await deliver(spaceFrame(5555, 'second'));
    await settle();

    expect(mockDeps.deleteInboxMessages).not.toHaveBeenCalled();
  });
});
