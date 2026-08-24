/**
 * An init envelope for a session we ALREADY hold must not replace it.
 *
 * ── Why this test exists ────────────────────────────────────────────────────
 *
 * Both clients re-announce an existing, still-advancing DM session by wrapping
 * it in a fresh InitializationEnvelope, on EVERY send, until the peer's reply
 * confirms it (desktop: `DoubleRatchetInboxEncryptForceSenderInit`; mobile:
 * `buildReinitEnvelopeSend`). The device-inbox receive path could not tell that
 * apart from a genuinely new session, so it tore the session down and rebuilt it
 * every time — minting a new receiving inbox the peer had never been told about
 * and deleting the row the peer was still writing to.
 *
 * MEASURED 2026-08-24, one 3-round cross-client run: 8 replacements, 7 distinct
 * receiving inboxes, and the peer's next message logged as
 * "DM frame for unknown inbox — no encryption state, retained unread".
 *
 * The discriminator is the X3DH ephemeral, and it is exact rather than
 * heuristic: the same ephemeral necessarily derives the same session key.
 *
 * ⚠️ THE CONTROL ARM IS THE POINT. A test that only proves "we kept the
 * session" would also pass if the code kept EVERY session, which would break a
 * peer reinstall — the failure mode a whole separate issue exists about. So the
 * different-ephemeral case is asserted just as hard as the same-ephemeral one.
 *
 * See `.agents/issues/.open/2026-08-24-cross-client-dm-loses-the-first-desktop-to-mobile-message.md`
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  unseal: vi.fn(),
  recipientSession: vi.fn(),
  newInboxKeyset: vi.fn(),
}));

vi.mock('@quilibrium/quilibrium-js-sdk-channels', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    channel: {
      ...actual.channel,
      UnsealInitializationEnvelope: (...a: unknown[]) => sdk.unseal(...a),
      NewDoubleRatchetRecipientSession: (...a: unknown[]) =>
        sdk.recipientSession(...a),
      NewInboxKeyset: (...a: unknown[]) => sdk.newInboxKeyset(...a),
    },
  };
});

const { MessageService } = await import('../../../services/MessageService');

const SELF = 'QmSelfAddressCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
const PARTNER = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imAAAA';
const CONVERSATION = `${PARTNER}/${PARTNER}`;
const OUR_DEVICE_INBOX = 'QmOurDeviceInboxAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
/** The peer's device inbox — the `tag` every row for this peer is keyed by. */
const PEER_TAG = 'QmPeerDeviceInboxBBBBBBBBBBBBBBBBBBBBBBBBBBB';
/** The receiving inbox we already advertised, and the peer is writing to. */
const ADVERTISED_INBOX = 'QmAdvertisedInboxDDDDDDDDDDDDDDDDDDDDDDDDDD';
/** What a rebuild would mint instead. */
const FRESH_INBOX = 'QmFreshlyMintedInboxEEEEEEEEEEEEEEEEEEEEEEEE';

const EPHEMERAL_A = 'aa11bb22cc33dd44ee55ff66';
const EPHEMERAL_B = '9988776655443322110099aa';

const keyset = {
  deviceKeyset: {
    inbox_keyset: {
      inbox_address: OUR_DEVICE_INBOX,
      inbox_key: { public_key: [1, 2, 3], private_key: [4, 5, 6] },
    },
    identity_key: { public_key: [7, 8, 9] },
  },
} as any;

const existingRow = (timestamp: number) => ({
  state: JSON.stringify({
    ratchet_state: 'RATCHET-WE-ALREADY-HOLD',
    receiving_inbox: {
      inbox_address: ADVERTISED_INBOX,
      inbox_key: { public_key: [11], private_key: [12] },
    },
    tag: PEER_TAG,
    sending_inbox: {
      inbox_address: 'QmPeerConversationInboxFFFFFFFFFFFFFFFFFFFFF',
      inbox_encryption_key: 'enc',
      inbox_public_key: 'peer-pub',
      inbox_private_key: 'peer-priv',
    },
  }),
  timestamp,
  inboxId: ADVERTISED_INBOX,
  conversationId: CONVERSATION,
  sentAccept: true,
});

describe('handleNewMessage — init envelope on our device inbox', () => {
  let messageService: any;
  let mockDeps: any;
  let now: number;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    now = Date.now();

    sdk.newInboxKeyset.mockResolvedValue({
      inbox_address: FRESH_INBOX,
      inbox_key: { public_key: [21], private_key: [22] },
    });

    mockDeps = {
      messageDB: {
        getEncryptionStates: vi.fn().mockResolvedValue([existingRow(now - 5_000)]),
        getAllEncryptionStates: vi
          .fn()
          .mockResolvedValue([existingRow(now - 5_000)]),
        saveEncryptionState: vi.fn().mockResolvedValue(undefined),
        deleteEncryptionState: vi.fn().mockResolvedValue(undefined),
        saveMessage: vi.fn().mockResolvedValue(undefined),
        getMessage: vi.fn().mockResolvedValue(null),
        getMessages: vi.fn().mockResolvedValue({ messages: [], hasMore: false }),
        isMessageDeleted: vi.fn().mockResolvedValue(false),
        getConversation: vi.fn().mockResolvedValue({ conversation: null }),
        getUserConfig: vi.fn().mockResolvedValue({}),
        updateMessage: vi.fn().mockResolvedValue(undefined),
      } as any,
      enqueueOutbound: vi.fn(),
      addOrUpdateConversation: vi.fn(),
      apiClient: {} as any,
      deleteEncryptionStates: vi.fn().mockResolvedValue(undefined),
      deleteInboxMessages: vi.fn().mockResolvedValue(undefined),
      navigate: vi.fn(),
      spaceInfo: { current: {} } as any,
      syncInfo: { current: {} } as any,
      synchronizeAll: vi.fn().mockResolvedValue(undefined),
      informSyncData: vi.fn().mockResolvedValue(undefined),
      initiateSync: vi.fn().mockResolvedValue(undefined),
      requestSync: vi.fn().mockResolvedValue(undefined),
      directSync: vi.fn().mockResolvedValue(undefined),
      saveConfig: vi.fn().mockResolvedValue(undefined),
      sendHubMessage: vi.fn().mockResolvedValue('message-id'),
    };
    messageService = new MessageService(mockDeps);
  });

  /** Drive one init-wrapped frame in, sealed with `ephemeral`. */
  const deliverInitEnvelope = async (ephemeral: string, timestamp: number) => {
    sdk.unseal.mockReturnValue({
      user_address: PARTNER,
      display_name: undefined,
      user_icon: undefined,
      return_inbox_address: 'QmPeerConversationInboxFFFFFFFFFFFFFFFFFFFFF',
      return_inbox_encryption_key: 'enc',
      return_inbox_public_key: 'peer-pub',
      return_inbox_private_key: 'peer-priv',
      identity_public_key: 'peer-identity',
      tag: PEER_TAG,
      message: 'inner-ciphertext',
      type: 'direct',
      ephemeral_public_key: ephemeral,
    });
    sdk.recipientSession.mockResolvedValue({
      state: 'REBUILT-RATCHET',
      message: JSON.stringify({
        messageId: `msg-${timestamp}`,
        channelId: PARTNER,
        createdDate: timestamp,
        content: { type: 'post', text: 'hello', senderId: PARTNER },
      }),
      tag: PEER_TAG,
      return_inbox_address: 'QmPeerConversationInboxFFFFFFFFFFFFFFFFFFFFF',
      return_inbox_encryption_key: 'enc',
      return_inbox_public_key: 'peer-pub',
      return_inbox_private_key: 'peer-priv',
      user_address: PARTNER,
      identity_public_key: 'peer-identity',
    });

    await messageService.handleNewMessage(
      SELF,
      keyset,
      {
        inboxAddress: OUR_DEVICE_INBOX,
        encryptedContent: JSON.stringify({ envelope: 'sealed' }),
        timestamp,
      } as any,
      undefined as any
    );
  };

  /** Every inbox address this run asked the relay to listen on. */
  const listenedAddresses = async (): Promise<string[]> => {
    const out: string[] = [];
    for (const [action] of mockDeps.enqueueOutbound.mock.calls) {
      const frames: string[] = await action();
      for (const f of frames) {
        const parsed = JSON.parse(f);
        if (parsed.type === 'listen') out.push(...parsed.inbox_addresses);
      }
    }
    return out;
  };

  describe('a genuinely new session (ephemeral we have never seen)', () => {
    it('replaces the session, mints a receiving inbox and listens on it', async () => {
      await deliverInitEnvelope(EPHEMERAL_B, now);

      expect(sdk.newInboxKeyset).toHaveBeenCalledTimes(1);
      expect(mockDeps.messageDB.deleteEncryptionState).toHaveBeenCalledTimes(1);
      const saved = mockDeps.messageDB.saveEncryptionState.mock.calls.at(-1)[0];
      expect(saved.inboxId).toBe(FRESH_INBOX);
      expect(JSON.parse(saved.state).ratchet_state).toBe('REBUILT-RATCHET');
      expect(await listenedAddresses()).toContain(FRESH_INBOX);
    });

    it('still delivers the message', async () => {
      await deliverInitEnvelope(EPHEMERAL_B, now);
      expect(mockDeps.messageDB.saveMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('a re-announcement of the session we already hold', () => {
    beforeEach(async () => {
      // The first envelope installs the session and records its ephemeral.
      await deliverInitEnvelope(EPHEMERAL_A, now - 2_000);

      // From here the row IS the one that first envelope installed — and the
      // store is STATEFUL, so a save the code performs is visible to the next
      // delivery. A fixed mock would hide exactly the behaviour the replay test
      // below depends on.
      const rows = [
        {
          ...existingRow(now - 2_000),
          inboxId: FRESH_INBOX,
          state: JSON.stringify({
            ...JSON.parse(existingRow(now - 2_000).state),
            receiving_inbox: {
              inbox_address: FRESH_INBOX,
              inbox_key: { public_key: [21], private_key: [22] },
            },
          }),
        },
      ];
      mockDeps.messageDB.getEncryptionStates.mockImplementation(async () => [
        ...rows,
      ]);
      mockDeps.messageDB.saveEncryptionState.mockImplementation(
        async (row: any) => {
          const i = rows.findIndex((r) => r.inboxId === row.inboxId);
          if (i >= 0) rows[i] = { ...rows[i], ...row };
          else rows.push(row);
        }
      );
      vi.clearAllMocks();
      sdk.newInboxKeyset.mockResolvedValue({
        inbox_address: 'QmShouldNeverBeMintedGGGGGGGGGGGGGGGGGGGGGG',
        inbox_key: { public_key: [31], private_key: [32] },
      });
    });

    it('does NOT mint a new receiving inbox', async () => {
      await deliverInitEnvelope(EPHEMERAL_A, now);
      expect(sdk.newInboxKeyset).not.toHaveBeenCalled();
    });

    it('does NOT delete the row the peer is writing to', async () => {
      await deliverInitEnvelope(EPHEMERAL_A, now);
      expect(mockDeps.messageDB.deleteEncryptionState).not.toHaveBeenCalled();
    });

    it('does NOT overwrite the ratchet our own replies are encrypted with', async () => {
      await deliverInitEnvelope(EPHEMERAL_A, now);
      // Rebuilding discards the sending chain the peer has already confirmed.
      for (const [row] of mockDeps.messageDB.saveEncryptionState.mock.calls) {
        expect(JSON.parse(row.state).ratchet_state).not.toBe('REBUILT-RATCHET');
      }
    });

    it('keeps listening on the address it already advertised', async () => {
      await deliverInitEnvelope(EPHEMERAL_A, now);
      expect(await listenedAddresses()).toEqual([FRESH_INBOX]);
    });

    it('still delivers the message the re-announcement carried', async () => {
      await deliverInitEnvelope(EPHEMERAL_A, now);
      expect(mockDeps.messageDB.saveMessage).toHaveBeenCalledTimes(1);
    });

    it('survives a burst of them without churning the session', async () => {
      // The measured shape: one re-announcement per send until confirmation.
      for (let i = 1; i <= 5; i++) {
        await deliverInitEnvelope(EPHEMERAL_A, now + i * 100);
      }
      expect(sdk.newInboxKeyset).not.toHaveBeenCalled();
      expect(mockDeps.messageDB.deleteEncryptionState).not.toHaveBeenCalled();
      expect(mockDeps.messageDB.saveMessage).toHaveBeenCalledTimes(5);
    });

    it('refuses an exact replay of a re-announcement it already accepted', async () => {
      // The relay redelivers any frame whose ack-by-delete failed, so a
      // re-announcement can arrive twice. `isStaleInitEnvelope` rule 2 catches
      // that by exact timestamp match against a row we hold — which only works
      // because the keep branch advances the row's timestamp. Without that, the
      // replay is accepted forever: a duplicate notification and a redundant
      // X3DH every time.
      const ts = now + 1_000;
      await deliverInitEnvelope(EPHEMERAL_A, ts);
      expect(mockDeps.messageDB.saveMessage).toHaveBeenCalledTimes(1);
      // The accept advanced the row's timestamp to this envelope's, which is
      // what arms rule 2 against the replay below.
      expect(mockDeps.messageDB.saveEncryptionState).toHaveBeenCalledTimes(1);
      expect(
        mockDeps.messageDB.saveEncryptionState.mock.calls[0][0].timestamp
      ).toBe(ts);

      vi.clearAllMocks();
      await deliverInitEnvelope(EPHEMERAL_A, ts); // byte-identical replay

      // ⚠️ The discriminating assertion. `saveEncryptionState` alone would NOT
      // discriminate: the stale path and an unbumped keep path both leave it
      // uncalled, so asserting on it passes whether or not the fix is present.
      // Only the stale path returns BEFORE re-subscribing, so the absence of a
      // listen frame is what distinguishes "refused" from "accepted again".
      expect(mockDeps.enqueueOutbound).not.toHaveBeenCalled();
      expect(mockDeps.messageDB.saveEncryptionState).not.toHaveBeenCalled();
      expect(sdk.newInboxKeyset).not.toHaveBeenCalled();
      expect(mockDeps.messageDB.deleteEncryptionState).not.toHaveBeenCalled();
    });

    it('a DIFFERENT ephemeral still replaces it — a peer reinstall must work', async () => {
      await deliverInitEnvelope(EPHEMERAL_B, now);
      expect(sdk.newInboxKeyset).toHaveBeenCalledTimes(1);
      expect(mockDeps.messageDB.deleteEncryptionState).toHaveBeenCalledTimes(1);
    });
  });
});
