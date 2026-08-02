/**
 * A DM frame for an inbox we hold no encryption state for must be RETAINED,
 * never deleted from the relay.
 *
 * ── Why this test exists ────────────────────────────────────────────────────
 *
 * The receive path routes an inbound frame by a single keyed lookup,
 * `states[message.inboxAddress]`. When a session is replaced the old receiving
 * inbox is orphaned, and frames the peer had already addressed to it arrive with
 * no state to decrypt them.
 *
 * The old code responded by asking the relay to delete the frame — using the
 * DEVICE inbox keyset, while the frame sits in a SESSION inbox. That request
 * names a mailbox the frame is not in, so it succeeded and removed nothing:
 * an operator capture on 2026-07-29 logged 366 such drops with ZERO delete
 * failures. The frames were stranded, not destroyed.
 *
 * The important part is what must NOT be "fixed": making that delete name the
 * right inbox would convert a recoverable stranding into permanent data loss,
 * because the relay is the only copy. It is also impossible — the delete payload
 * needs the inbox's public key and a signature over its address, and both live in
 * the encryption state we just failed to find.
 *
 * So the correct behaviour is to retain, and this test pins it. If someone later
 * "restores" a delete here, this fails.
 *
 * Full analysis: `.agents/bugs/.solved/2026-07-29-session-replacement-strands-in-flight-frames.md`
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageService } from '../../../services/MessageService';

describe('handleNewMessage — frame for an inbox with no encryption state', () => {
  let messageService: MessageService;
  let mockDeps: any;

  const DEVICE_INBOX = 'QmDeviceInboxAddressAAAAAAAAAAAAAAAAAAAAAAAA';
  const ORPHANED_SESSION_INBOX = 'QmOrphanedSessionInboxBBBBBBBBBBBBBBBBBBBBB';

  const keyset = {
    deviceKeyset: {
      inbox_keyset: {
        inbox_address: DEVICE_INBOX,
        inbox_key: { public_key: [1, 2, 3], private_key: [4, 5, 6] },
      },
      identity_key: { public_key: [7, 8, 9] },
    },
  } as any;

  beforeEach(() => {
    mockDeps = {
      messageDB: {
        // The heart of the scenario: no state exists for the inbox this frame
        // arrived on, because a session replacement orphaned it.
        getEncryptionStates: vi.fn().mockResolvedValue([]),
        getAllEncryptionStates: vi.fn().mockResolvedValue([]),
        saveEncryptionState: vi.fn().mockResolvedValue(undefined),
        deleteEncryptionState: vi.fn().mockResolvedValue(undefined),
        saveMessage: vi.fn().mockResolvedValue(undefined),
        getMessage: vi.fn().mockResolvedValue(null),
        getMessages: vi.fn().mockResolvedValue({ messages: [], hasMore: false }),
        isMessageDeleted: vi.fn().mockResolvedValue(false),
        getConversation: vi.fn().mockResolvedValue({ conversation: null }),
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
    vi.clearAllMocks();
  });

  const frameOnOrphanedInbox = () => ({
    inboxAddress: ORPHANED_SESSION_INBOX,
    encryptedContent: JSON.stringify({ envelope: 'ciphertext-we-cannot-open' }),
    timestamp: 1785323281580,
  });

  it('does NOT ask the relay to delete a frame it cannot place', async () => {
    await messageService.handleNewMessage(
      'QmSelfAddressCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      keyset,
      frameOnOrphanedInbox() as any
    );

    // The whole point. The relay is the only copy of this frame; deleting it
    // would be unrecoverable, and the only delete we COULD construct names the
    // device inbox, where this frame is not.
    expect(mockDeps.deleteInboxMessages).not.toHaveBeenCalled();
  });

  it('never deletes against the DEVICE inbox for a frame on a session inbox', async () => {
    await messageService.handleNewMessage(
      'QmSelfAddressCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      keyset,
      frameOnOrphanedInbox() as any
    );

    // Pins the specific defect rather than only the general rule: every call, if
    // any ever returns, must at least not be aimed at the wrong mailbox.
    for (const call of mockDeps.deleteInboxMessages.mock.calls) {
      expect(call[0]?.inbox_address).not.toBe(DEVICE_INBOX);
    }
  });

  it('does not persist the message, and does not throw', async () => {
    // Retained means "kept on the server for later", NOT "delivered". The frame
    // still cannot be decrypted, so nothing may be saved — and the inbound loop
    // must keep running for the frames behind it.
    await expect(
      messageService.handleNewMessage(
        'QmSelfAddressCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
        keyset,
        frameOnOrphanedInbox() as any
      )
    ).resolves.not.toThrow();

    expect(mockDeps.messageDB.saveMessage).not.toHaveBeenCalled();
  });

  it('stays retained across a redelivery of the same frame', async () => {
    // An un-deleted frame comes back on every re-listen. Repeated arrivals must
    // not eventually trigger a delete — there is no give-up action that would not
    // destroy the message.
    for (let i = 0; i < 12; i++) {
      await messageService.handleNewMessage(
        'QmSelfAddressCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
        keyset,
        frameOnOrphanedInbox() as any
      );
    }

    expect(mockDeps.deleteInboxMessages).not.toHaveBeenCalled();
    expect(mockDeps.messageDB.saveMessage).not.toHaveBeenCalled();
  });
});
