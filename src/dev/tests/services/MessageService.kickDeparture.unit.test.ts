/**
 * Being kicked from a Space must RECORD the departure, not just delete the Space.
 *
 * ── Why this test exists ────────────────────────────────────────────────────
 *
 * `departed_spaces` (DB v15) is what stops a backup restore re-adding a Space the
 * user is no longer in. The restore gate is well covered in
 * `backupSpaceRestore.test.ts`, but those tests drive `MessageDB` directly — they
 * write the tombstone themselves. Nothing exercised the two places that write it
 * for real.
 *
 * The `left` site is asserted in `SpaceService.unit.test.tsx`. This is the other
 * one, and the more dangerous of the two: leaving is voluntary, being kicked is
 * adversarial. If this line were dropped in a refactor, the whole suite would stay
 * green and a kicked user's next backup restore would silently re-add the Space
 * and `postHubAdd` them back into it — re-announcing them to the Space that just
 * removed them, months later, with no signal at either end.
 *
 * The kick handler is ~150 lines of sequential cleanup buried inside
 * `handleNewMessage`, which is exactly the shape a refactor disturbs.
 *
 * See `.agents/issues/.open/2026-08-09-backup-restore-overhaul-design.md` §4.1.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageService } from '../../../services/MessageService';

const SPACE_ID = 'QmSpaceAddressAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const SPACE_INBOX = 'QmSpaceInboxBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const DEVICE_INBOX = 'QmDeviceInboxCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
const SELF = 'QmSelfAddressDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';
const SOMEONE_ELSE = 'QmOtherMemberEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';

const OWNER_PUBLIC_KEY = 'ab'.repeat(57);

/** Who the kick names. Varied per test to cover "not me". */
let kickTarget = SELF;
/** Whether the owner signature over the envelope verifies. */
let signatureVerifies = true;

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {
    // The space frame opens to a kick control message.
    UnsealHubEnvelope: vi.fn(async () =>
      Array.from(
        new TextEncoder().encode(
          JSON.stringify({
            type: 'control',
            message: { type: 'kick', kick: kickTarget },
          })
        )
      )
    ),
    UnsealSyncEnvelope: vi.fn(async () =>
      Array.from(
        new TextEncoder().encode(
          JSON.stringify({
            type: 'control',
            message: { type: 'kick', kick: kickTarget },
          })
        )
      )
    ),
  },
  channel_raw: {
    js_sign_ed448: vi.fn().mockReturnValue(JSON.stringify('mock-signature')),
    // Returned through JSON.parse by the handler, so this must be JSON.
    js_verify_ed448: vi.fn(() => JSON.stringify(signatureVerifies)),
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
 * A hub-broadcast space frame. `encryptedContent` IS the exterior envelope
 * (`MessageService` does `JSON.parse(message.encryptedContent)`), so the owner
 * fields the kick branch authenticates against live here.
 */
function kickFrame(ts = 1000) {
  return {
    inboxAddress: SPACE_INBOX,
    encryptedContent: JSON.stringify({
      type: 'group',
      owner_public_key: OWNER_PUBLIC_KEY,
      envelope: 'sealed-envelope-bytes',
      owner_signature: 'cd'.repeat(57),
    }),
    timestamp: ts,
  } as any;
}

describe('being kicked from a Space records the departure', () => {
  let messageService: MessageService;
  let mockDeps: any;

  beforeEach(() => {
    kickTarget = SELF;
    signatureVerifies = true;

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
        deleteEncryptionState: vi.fn().mockResolvedValue(undefined),
        getConversation: vi.fn().mockResolvedValue({ conversation: null }),
        getSpace: vi.fn().mockResolvedValue({ spaceId: SPACE_ID, spaceName: 'Alpha' }),
        getSpaceKey: vi.fn().mockResolvedValue(spaceKey),
        getSpaceKeys: vi.fn().mockResolvedValue([]),
        deleteSpaceKey: vi.fn().mockResolvedValue(undefined),
        getSpaceMembers: vi.fn().mockResolvedValue([]),
        deleteSpaceMember: vi.fn().mockResolvedValue(undefined),
        getSpaceMember: vi.fn().mockResolvedValue(null),
        saveSpaceMember: vi.fn().mockResolvedValue(undefined),
        getAllSpaceMessages: vi.fn().mockResolvedValue([]),
        deleteMessage: vi.fn().mockResolvedValue(undefined),
        getUserConfig: vi.fn().mockResolvedValue({ address: SELF, spaceIds: [SPACE_ID] }),
        saveEncryptionState: vi.fn().mockResolvedValue(undefined),
        saveMessage: vi.fn().mockResolvedValue(undefined),
        getMessage: vi.fn().mockResolvedValue(null),
        getMessages: vi.fn().mockResolvedValue({ messages: [], hasMore: false }),
        isMessageDeleted: vi.fn().mockResolvedValue(false),
        updateMessage: vi.fn().mockResolvedValue(undefined),
        // The two under test.
        deleteSpace: vi.fn().mockResolvedValue(undefined),
        deleteSpaceAsDeparture: vi.fn().mockResolvedValue(undefined),
      },
      enqueueOutbound: vi.fn(),
      addOrUpdateConversation: vi.fn(),
      apiClient: {
        // The owner key the kick is signed with must be one the Space registration
        // vouches for, or the handler rejects the kick before doing anything.
        getSpace: vi.fn().mockResolvedValue({
          data: { owner_public_keys: [OWNER_PUBLIC_KEY] },
        }),
        postHubDelete: vi.fn().mockResolvedValue({ data: {} }),
      },
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

  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('records the departure as `removed`, atomically with the delete', async () => {
    await deliver(kickFrame());
    await settle();

    expect(mockDeps.messageDB.deleteSpaceAsDeparture).toHaveBeenCalledWith({
      spaceId: SPACE_ID,
      reason: 'removed',
    });
    // The non-atomic pair must not be used here: a bare deleteSpace would leave
    // the Space gone with no record of why, which a later restore reads as
    // "never had it".
    expect(mockDeps.messageDB.deleteSpace).not.toHaveBeenCalled();
  });

  it('CONTROL: a kick naming someone else records nothing', async () => {
    // Without this the test above could pass on a handler that tombstoned every
    // kick it saw, including other people's.
    kickTarget = SOMEONE_ELSE;

    await deliver(kickFrame());
    await settle();

    expect(mockDeps.messageDB.deleteSpaceAsDeparture).not.toHaveBeenCalled();
  });

  it('CONTROL: an unverified kick records nothing', async () => {
    // The owner signature is what makes a kick authentic. If a forged frame could
    // drive this path, an attacker could evict a user from their own Space —
    // and, with the tombstone written, block them restoring it from a backup.
    signatureVerifies = false;

    await deliver(kickFrame());
    await settle();

    expect(mockDeps.messageDB.deleteSpaceAsDeparture).not.toHaveBeenCalled();
  });
});
