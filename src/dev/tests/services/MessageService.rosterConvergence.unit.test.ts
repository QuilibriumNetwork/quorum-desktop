/**
 * The WIRING: a `sync-info` frame must arm the roster convergence check, and
 * that check must actually re-broadcast a `sync-request`.
 *
 * ── Why this test exists ────────────────────────────────────────────────────
 *
 * `rosterConvergence.ts` is a pure decision function with its own 39 tests, and
 * `selectBestCandidate` has its own 15. Both were green while the feature was
 * completely unreachable, because everything that makes it reachable is two
 * lines inside the ~6,000-line `handleNewMessage` switch. Nothing failed if
 * those two lines were deleted.
 *
 * So this test drives the REAL entry point — `handleNewMessage` with a hub
 * control frame — rather than calling the scheduler directly. It is the only
 * test in either repo that proves the feature is connected to anything.
 *
 * It pins these things:
 *   1. a `sync-info` advertising more members than we hold leads to a re-ask;
 *   2. several `sync-info` answers to ONE request collapse into ONE re-ask
 *      (the debounce — without it every peer that replies arms its own timer);
 *   3. a client that is already converged asks for nothing;
 *   4. an EXPIRED or absent sync session still arms the check — see below, this
 *      is the case the whole mechanism exists for and it was the one case that
 *      did not work;
 *   5. arming the check does NOT mean syncing from an offer we are no longer
 *      entitled to use. The expiry gate is untouched; only the tracker moved
 *      out from behind it.
 *
 * See 2026-08-02-roster-pull-delivers-nothing-to-a-new-joiner.md under
 * .agents/issues/ — issues are filed by state and move, so grep the filename.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageService } from '../../../services/MessageService';

const SPACE_ID = 'QmSpaceAddressAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const SPACE_INBOX = 'QmSpaceInboxBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const DEVICE_INBOX = 'QmDeviceInboxCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
const SELF = 'QmSelfAddressDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';

/** Whatever `UnsealHubEnvelope` should decode to on the next call. */
let unsealedPayload = '';

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {
    // The handler does `Buffer.from(new Uint8Array(await UnsealHubEnvelope(...)))`,
    // so this has to be a byte array, not a string.
    UnsealHubEnvelope: vi.fn(async () =>
      Array.from(new TextEncoder().encode(unsealedPayload))
    ),
    UnsealSyncEnvelope: vi.fn(async () =>
      Array.from(new TextEncoder().encode(unsealedPayload))
    ),
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

const spaceKey = { publicKey: '00'.repeat(57), privateKey: '00'.repeat(57), address: SPACE_INBOX };

/** A `sync-info` from a peer claiming to hold `memberCount` members. */
function syncInfoFrame(memberCount: number) {
  unsealedPayload = JSON.stringify({
    type: 'control',
    message: {
      type: 'sync-info',
      inboxAddress: 'QmPeerInboxEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE',
      summary: {
        memberCount,
        messageCount: 5,
        newestMessageTimestamp: 0,
        oldestMessageTimestamp: 0,
      },
    },
  });
  return {
    inboxAddress: SPACE_INBOX,
    // Anything but `type: 'sync'`, so the handler takes the hub-broadcast path.
    encryptedContent: JSON.stringify({ type: 'group' }),
    timestamp: 1785323281580,
  } as any;
}

describe('sync-info arms the roster convergence check', () => {
  let messageService: MessageService;
  let mockDeps: any;

  /** How many member rows this client currently holds for the space. */
  let localMembers: unknown[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    localMembers = [];

    mockDeps = {
      messageDB: {
        getAllEncryptionStates: vi.fn().mockResolvedValue([
          {
            inboxId: SPACE_INBOX,
            conversationId: `${SPACE_ID}/${SPACE_ID}`,
            // No `sending_inbox` — that is what selects the SPACE path over
            // the DM ratchet path.
            state: JSON.stringify({}),
          },
        ]),
        getEncryptionStates: vi.fn().mockResolvedValue([]),
        getConversation: vi.fn().mockResolvedValue({ conversation: null }),
        getSpaceKey: vi.fn().mockResolvedValue(spaceKey),
        getSpaceMembers: vi.fn(async () => localMembers),
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
      // An OPEN sync session, which is what lets a `sync-info` be admitted.
      syncInfo: {
        current: {
          [SPACE_ID]: { expiry: Date.now() + 30_000, candidates: [] },
        },
      },
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

  afterEach(() => {
    vi.useRealTimers();
  });

  const deliver = (memberCount: number) =>
    messageService.handleNewMessage(SELF, keyset, syncInfoFrame(memberCount), {
      refetchQueries: vi.fn(),
      setQueryData: vi.fn(),
      invalidateQueries: vi.fn(),
      getQueryData: vi.fn(),
    } as any);

  it('re-asks when a peer advertises far more members than we hold', async () => {
    localMembers = [{ user_address: SELF }]; // just ourselves

    await deliver(90);
    expect(mockDeps.requestSync).not.toHaveBeenCalled(); // not yet — it is debounced

    await vi.advanceTimersByTimeAsync(20_000);

    expect(mockDeps.requestSync).toHaveBeenCalledWith(SPACE_ID);
  });

  // Several peers answer ONE `sync-request`. Without the per-space debounce
  // each of their replies would arm its own timer and we would broadcast a
  // burst of redundant requests.
  it('collapses several peer answers into a single re-ask', async () => {
    localMembers = [{ user_address: SELF }];

    await deliver(72);
    await deliver(79);
    await deliver(90);

    await vi.advanceTimersByTimeAsync(20_000);

    expect(mockDeps.requestSync).toHaveBeenCalledTimes(1);
  });

  it('asks for nothing when the roster is already converged', async () => {
    localMembers = Array.from({ length: 88 }, (_, i) => ({ user_address: `addr-${i}` }));

    await deliver(90);
    await vi.advanceTimersByTimeAsync(20_000);

    expect(mockDeps.requestSync).not.toHaveBeenCalled();
  });

  // ── The case this whole mechanism exists for ─────────────────────────────
  //
  // A client reconnecting onto a long backlog drains its inbound queue serially.
  // Its `sync-request` goes out, peers answer, and by the time those answers are
  // processed the 30s window has closed. Measured 2026-08-02 at a 300-message
  // backlog: twelve answers, every one advertising 80 members, every one
  // discarded on `isExpired: true`.
  //
  // The tracker used to live INSIDE that gate, so this exact client — the one
  // holding 1 row of 80, with no session left and nothing else to try — learned
  // no target and armed no check. The repair was silent in the only failure it
  // was written for.
  it('still arms the check when our request window has already expired', async () => {
    localMembers = [{ user_address: SELF }]; // 1 row, against an advertised 90
    // The session exists, but its window closed while we drained the backlog.
    mockDeps.syncInfo.current[SPACE_ID].expiry = Date.now() - 1;

    await deliver(90);
    await vi.advanceTimersByTimeAsync(20_000);

    expect(mockDeps.requestSync).toHaveBeenCalledWith(SPACE_ID);
  });

  // The counterpart to the test above, and the reason it is safe: hoisting the
  // tracker out of the gate must NOT hoist the gate's actual decision with it.
  // An offer that arrived after our window closed is still an offer we may not
  // sync from — we bank what it advertises and ask again, nothing more.
  it('does not sync from an offer that arrived after the window closed', async () => {
    localMembers = [{ user_address: SELF }];
    mockDeps.syncInfo.current[SPACE_ID].expiry = Date.now() - 1;

    await deliver(90);

    expect(mockDeps.syncInfo.current[SPACE_ID].candidates).toHaveLength(0);
    expect(mockDeps.initiateSync).not.toHaveBeenCalled();
  });

  // The other half of the gate: no session at all, which is where a client sits
  // once its sync state has been torn down. A peer's answer is still true.
  it('still arms the check when there is no sync session at all', async () => {
    localMembers = [{ user_address: SELF }];
    delete mockDeps.syncInfo.current[SPACE_ID];

    await deliver(90);
    await vi.advanceTimersByTimeAsync(20_000);

    expect(mockDeps.requestSync).toHaveBeenCalledWith(SPACE_ID);
  });

  // A frame that teaches us nothing must not arm anything. Without a target
  // `shouldReAsk` can only answer `no-target`, so arming would buy a timer and
  // a database read to reach a foregone conclusion.
  it('arms nothing when the advertised count is unusable', async () => {
    localMembers = [{ user_address: SELF }];
    mockDeps.syncInfo.current[SPACE_ID].expiry = Date.now() - 1;

    await deliver(0);
    await vi.advanceTimersByTimeAsync(20_000);

    expect(mockDeps.requestSync).not.toHaveBeenCalled();
  });

  // Cancelling the timer is the whole point of `forgetRosterConvergence`: a
  // check armed just before a kick would otherwise fire against a space that no
  // longer exists and broadcast into a space we were removed from.
  it('does not re-ask for a space that was left before the check fired', async () => {
    localMembers = [{ user_address: SELF }];

    await deliver(90);
    messageService.forgetRosterConvergence(SPACE_ID);
    await vi.advanceTimersByTimeAsync(20_000);

    expect(mockDeps.requestSync).not.toHaveBeenCalled();
  });
});
