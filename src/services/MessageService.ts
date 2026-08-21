// MessageService.ts - Extracted from MessageDB.tsx with ZERO modifications
// This service handles message CRUD operations, encryption/decryption, and reactions

import {
  logger,
  int64ToBytes,
  getInviteUrlBase,
  canonicalize,
  extractMentionsFromText,
  isMentionedWithSettings,
  MAX_MENTIONS_PER_MESSAGE,
  MAX_MESSAGE_LENGTH,
  validateSpaceTagLetters,
  isValidSpaceTagUrl,
  hasPermission,
  SimpleRateLimiter,
  RATE_LIMITS,
  buildMessageFingerprint,
  verifyAndResolveSender,
  authorizeControlMessage,
  isControlMessageType,
  requiresVerifiedSignature,
  shouldSignEdit,
  canManageReadOnlyChannel,
  verifyDeviceKeyStatement,
  buildDeviceKeyStatementBytes,
  deriveInboxAddress,
  MESSAGE_EDIT_WINDOW_MS,
  applyEdit,
  getConversationSetting,
  type ControlMessageContent,
  type VerifiedSenderResult,
  type DeviceKeyStatement,
  type AnnounceKeysStatement,
  type RevokeDeviceStatement,
} from '@quilibrium/quorum-shared';
import { MessageDB, EncryptionState, EncryptedMessage } from '../db/messages';
import type { SpaceMemberRow } from '../db/messages';
import type {
  Message,
  ReactionMessage,
  RemoveReactionMessage,
  PostMessage,
  JoinMessage,
  LeaveMessage,
  KickMessage,
  MuteMessage,
  Space,
  Channel,
  EditMessage,
  PinMessage,
  ThreadMessage,
  ThreadMeta,
  UpdateProfileMessage,
  DMUpdateProfileMessage,
  BroadcastSpaceTag,
  Conversation,
} from '@quilibrium/quorum-shared';
import { sha256, base58btc, hexToSpreadArray } from '../utils/crypto';
import { QueryClient, InfiniteData } from '@tanstack/react-query';
import {
  buildMessagesKeyPrefix,
  buildSpaceMembersKey,
  buildSpaceKey,
  buildSpacesKey,
  buildConfigKey,
  buildConversationsKey,
} from '../hooks';
import { buildConversationKey } from '../hooks/queries/conversation/buildConversationKey';
import {
  channel as secureChannel,
  channel_raw as ch,
} from '@quilibrium/quilibrium-js-sdk-channels';
import { t } from '@lingui/core/macro';
import { DefaultImages } from '../utils';
import { QuorumApiClient } from '../api/baseTypes';
import { showWarning } from '../utils/toast';
import { notificationService } from './NotificationService';
import type { ActionQueueService } from './ActionQueueService';
import type { ReceiptService, ReceiptEnvelopeFields } from '@quilibrium/quorum-shared';
import { TypingService, type TypingMessage } from '@quilibrium/quorum-shared';
import { ENABLE_DM_ACTION_QUEUE } from '../config/features';
import { dmRatchetMutex } from '../utils/keyedMutex';
import { isStaleInitEnvelope } from '../utils/initEnvelopeGuard';
import { findStaleBucket, restoreStaleBucket } from '../utils/dmStaleBucketRetry';
import { orderSessionsForSend } from '../utils/sessionSelection';
import { legacySpaceOverrideClearDone } from '../utils/legacyOverrideClearGate';
import {
  dmProfileSignature,
  shouldSendDmProfile,
  recordDmProfileSend,
  claimDmProfileSend,
  releaseDmProfileSend,
  clearDmProfileSendState,
} from '../utils/dmProfileGate';
import {
  parseDmProfileUpdate,
  type DmProfileUpdatePayload,
} from '../utils/dmProfileWire';
import {
  ensureRevealBootstrap,
  hasRevealedTo,
  recordReveal,
} from '../utils/dmRevealLedger';
import {
  claimSpaceProfileAnnounce,
  recordSpaceProfileAnnounce,
  releaseSpaceProfileAnnounce,
  shouldAnnounceSpaceProfile,
  spaceProfileSignature,
} from '../utils/spaceProfileGate';
import {
  buildSpaceProfileWirePayload,
  hasAnnounceableIdentity,
  type GlobalProfileFields,
  type OwnSpaceMemberFields,
  type SpaceProfileWireFields,
} from '../utils/spaceProfilePayload';
import { preferIncomingProfileField } from '../utils/conversationProfile';
import { createRosterConvergenceTracker } from '../utils/rosterConvergence';
import { UndecryptableFrameTracker, frameKey } from '../utils/frameRetry';
import { ThreadService } from './ThreadService';
import type { Ref } from '../types/ref';
import type { SpaceInfoMap, SyncInfoMap } from '../types/spaceRefs';

// Visible-content types gated by read-only-channel enforcement. Control
// messages (reaction/pin/edit/remove/…) carry their own authorization.
const READ_ONLY_GATED_TYPES = new Set(['post', 'embed', 'sticker']);

// How young an embedded init payload must be for the stale-refuse branch to
// salvage it as a message. Bounds the recovery window for a frame retained
// after a persist failure without letting ancient zombie envelopes dump
// stale posts into the chat.
const INIT_PAYLOAD_SALVAGE_MAX_AGE_MS = 10 * 60 * 1000;
const isReadOnlyGatedType = (type: string): boolean =>
  READ_ONLY_GATED_TYPES.has(type);

/**
 * A failed Double Ratchet decrypt, reported as itself.
 *
 * The crypto core does NOT throw when a frame fails to authenticate. It returns
 * the plaintext slot filled with an error string ("Decryption failed:
 * aead::Error"), so the first thing that touches it is `JSON.parse`, which dies
 * with `SyntaxError: Unexpected token 'D', "Decryption"... is not valid JSON`.
 *
 * That message is actively misleading: it reads like a serialization bug in our
 * own code, and it has been the visible face of every DM decrypt failure in the
 * logs for months. Nothing downstream changes — the error still lands in the
 * same catch, the frame is still skipped, the session is still kept, and the
 * state is still never persisted (the throw happens before the save, per the
 * Double Ratchet spec's "discard changes on failure"). Only the diagnosis
 * improves.
 */
export class DmDecryptError extends Error {
  constructor(
    readonly detail: string,
    readonly branch: string
  ) {
    super(`DM frame failed to decrypt (${branch}): ${detail}`);
    this.name = 'DmDecryptError';
  }
}

/** The sentinel the crypto core returns in the message slot on AEAD failure. */
const DECRYPT_FAILURE_SENTINEL = 'Decryption failed';

/**
 * Parse a decrypted Double Ratchet payload, converting the core's
 * failure-as-plaintext into a `DmDecryptError` instead of a `SyntaxError`.
 */
export function parseDecryptedMessage(raw: string, branch: string): Message {
  if (typeof raw === 'string' && raw.startsWith(DECRYPT_FAILURE_SENTINEL)) {
    throw new DmDecryptError(raw.trim(), branch);
  }
  return JSON.parse(raw) as Message;
}

// Type definitions for the service
export interface MessageServiceDependencies {
  messageDB: MessageDB;
  enqueueOutbound: (action: () => Promise<string[]>) => void;
  addOrUpdateConversation: (
    queryClient: QueryClient,
    address: string,
    timestamp: number,
    lastReadTimestamp: number,
    updatedUserProfile?: Partial<secureChannel.UserProfile>
  ) => void;
  // Additional dependencies needed by handleNewMessage
  apiClient: QuorumApiClient;
  deleteEncryptionStates: (args: { conversationId: string }) => Promise<void>;
  deleteInboxMessages: (
    inboxKeyset: any,
    timestamps: number[],
    apiClient: QuorumApiClient
  ) => Promise<void>;
  navigate: (path: string, options?: any) => void;
  spaceInfo: Ref<SpaceInfoMap>;
  syncInfo: Ref<SyncInfoMap>;
  synchronizeAll: (spaceId: string, inboxAddress: string) => Promise<void>;
  informSyncData: (
    spaceId: string,
    inboxAddress: string,
    messageCount: number,
    memberCount: number,
    theirSummary?: any // New protocol: SyncSummary
  ) => Promise<void>;
  initiateSync: (spaceId: string) => Promise<void>;
  /**
   * Re-broadcast a `sync-request` for a space.
   *
   * Needed here — not just at connect — because the roster half of a sync is a
   * single payload with no retry, so a lost frame has to be noticed and asked
   * for again. See `scheduleRosterConvergenceCheck`.
   *
   * Resolves to whether the request was built and queued, so a re-ask that
   * never left the process is not charged against the retry budget.
   */
  requestSync: (spaceId: string) => Promise<boolean>;
  directSync: (spaceId: string, message: any) => Promise<void>;
  saveConfig: (args: { config: any; keyset: any }) => Promise<void>;
  sendHubMessage: (spaceId: string, message: string) => Promise<string>;
  // New protocol methods
  handleSyncInitiateV2: (spaceId: string, message: any) => Promise<void>;
  handleSyncManifest: (spaceId: string, targetInbox: string, payload: any) => Promise<void>;
}

// Apply an update-profile message onto a member row (two-slot model — see
// identity-resolution-and-profile-sync doc). The OVERRIDE fields
// (display_name/user_icon/bio) and the GLOBAL slot (global_*) are stored
// separately and each carry their own last-write-wins timestamp, so an
// out-of-order rebroadcast carrying an older value for one slot can't clobber a
// newer value in the other. Presence semantics: omitted = no change,
// '' = deliberate clear. Mirrors mobile WebSocketContext (applyOverride/
// applyGlobal). `createdDate` is the wire message's timestamp.
//
// NOTE: unlike mobile, this does NOT delete the inbox message when both slots
// are stale — desktop's P2P transport has no per-space inbox to acknowledge.
// That cleanup step belongs to the future hub-log migration, at the transport
// layer, not here. See project docs / the two-slot task file.
// Exported for unit testing (pure logic, no dependencies).
/**
 * Decide what an inbound `update-profile` means for a member's space tag.
 *
 * Three cases, and conflating the first two is a live bug in both directions:
 *
 * - **absent (`undefined`) → no change.** Most `update-profile` messages carry
 *   no tag at all: a global avatar save, the on-connect identity announce. If
 *   absence meant "clear", every one of those would strip every member's tag,
 *   and the on-connect announce would do it on every reconnect.
 * - **`null` → the TOMBSTONE.** The owner deleted the tag and the sender says
 *   so explicitly. Absence cannot carry that meaning (see above), so deletion
 *   needs a signal of its own. Older clients see a falsy value and behave as
 *   they always did, so this is additive on the wire.
 * - **an object → set it, if it validates.** A tag that FAILS validation is
 *   REJECTED, not treated as a clear: a malformed tag must not be able to strip
 *   a good one.
 *
 * The clear has to travel to the DB as an explicit `clearFields`, because
 * `saveSpaceMember` merges and drops `undefined`s — see that method's doc and
 * 2026-08-01-space-tag-can-no-longer-be-cleared-from-a-member-roster.md under .agents/issues/
 */
/**
 * Strip every field that belongs to a STORED row but must never reach the wire.
 *
 * ⚠️ USE THIS INSTEAD OF HAND-LISTING FIELDS AT EACH SEND SITE. Three separate
 * places used to destructure `{ sendStatus, sendError, ...rest }` inline, and
 * when `authenticatedSenderId` was added none of them learned about it — so a
 * retried DM re-serialized a stored row and put the marker on the wire. Not
 * exploitable (the receiver overwrites it after the spread, and the value was
 * the sender's own already-known address), but the shared type states
 * "PERSISTED, and NEVER TRANSMITTED" as an absolute, and a future field added
 * to this list would have leaked for real.
 *
 * The rule: a send site should not have to know WHICH fields are local-only.
 * Add new local-only fields here, once.
 */
export function stripNonTransmissibleFields(message: Message): Message {
  const {
    sendStatus: _sendStatus,
    sendError: _sendError,
    authenticatedSenderId: _authenticatedSenderId,
    ...transmissible
  } = message as Message & { authenticatedSenderId?: string };
  return transmissible as Message;
}

export function resolveInboundSpaceTag(
  inbound: BroadcastSpaceTag | null | undefined
): {
  /** Whether to touch `participant.spaceTag` at all. */
  write: boolean;
  tag?: BroadcastSpaceTag;
  options?: { clearFields: (keyof SpaceMemberRow)[] };
} {
  if (inbound === null) {
    return { write: true, tag: undefined, options: { clearFields: ['spaceTag'] } };
  }
  if (!inbound) return { write: false };
  if (!validateSpaceTagLetters(inbound.letters) || !isValidSpaceTagUrl(inbound.url)) {
    return { write: false };
  }
  return { write: true, tag: inbound };
}

export function applyProfileUpdate(
  participant: SpaceMemberRow,
  content: UpdateProfileMessage,
  createdDate: number
): void {
  const ts = createdDate || Date.now();

  const hasOverride =
    content.displayName !== undefined ||
    content.userIcon !== undefined ||
    content.bio !== undefined;
  const hasGlobal =
    content.globalDisplayName !== undefined ||
    content.globalUserIcon !== undefined ||
    content.globalBio !== undefined;

  const applyOverride =
    hasOverride &&
    !(participant.profileTimestamp && participant.profileTimestamp >= ts);
  const applyGlobal =
    hasGlobal &&
    !(participant.globalProfileTimestamp && participant.globalProfileTimestamp >= ts);

  // OVERRIDE slot — presence check ('' is a deliberate per-space clear).
  if (applyOverride) {
    if (content.displayName !== undefined) participant.display_name = content.displayName;
    if (content.userIcon !== undefined) participant.user_icon = content.userIcon;
    if (content.bio !== undefined) participant.bio = content.bio;
    participant.profileTimestamp = ts;
  }
  // GLOBAL slot — the sender's current global identity, never mistaken for an override.
  if (applyGlobal) {
    if (content.globalDisplayName !== undefined) participant.global_display_name = content.globalDisplayName;
    if (content.globalUserIcon !== undefined) participant.global_user_icon = content.globalUserIcon;
    if (content.globalBio !== undefined) participant.global_bio = content.globalBio;
    participant.globalProfileTimestamp = ts;
  }
}

/**
 * Which slots may a sync-delta member row write?
 *
 * The sync protocol compares DIGESTS, which carry no notion of newer or older, so
 * a peer holding a stale identity will happily push it back. For OUR OWN row that
 * is never acceptable — a peer is not authoritative about our per-space choice,
 * and `computeMemberDiff` has no self-exclusion of its own.
 *
 * For everyone else the per-slot timestamp guard applies, and a row with NO stored
 * timestamp accepts unconditionally: that is the deliberate bootstrap for a member
 * we have never heard of, pinned by saveSpaceMemberGlobalSlot.test.ts. Do not
 * "harden" it.
 */
export function resolveSyncDeltaSlots(input: {
  isSelf: boolean;
  existingOverrideTs?: number;
  existingGlobalTs?: number;
  incomingOverrideTs: number;
  incomingGlobalTs: number;
}): { applyOverride: boolean; applyGlobal: boolean } {
  const applyOverride =
    !input.isSelf &&
    !(input.existingOverrideTs && input.existingOverrideTs >= input.incomingOverrideTs);
  const applyGlobal = !(
    input.existingGlobalTs && input.existingGlobalTs >= input.incomingGlobalTs
  );
  return { applyOverride, applyGlobal };
}

/**
 * A `join` control carries the joiner's GLOBAL identity, not a per-space choice.
 *
 * Filing it in the OVERRIDE slot froze that member under whatever name they had at
 * join time: the override outranks every later global update, and the on-connect
 * announce reads it back off the row and re-stamps it on every connect, so it never
 * decays. Filed in the global slot with a `joinedAt` stamp instead, so ordinary
 * last-write-wins applies and a later rename reaches us.
 */
export function buildJoinedMemberRow(participant: {
  address: string;
  inboxAddress: string;
  userIcon?: string;
  displayName?: string;
  joinedAt: number;
}): SpaceMemberRow {
  return {
    user_address: participant.address,
    inbox_address: participant.inboxAddress,
    global_user_icon: participant.userIcon,
    global_display_name: participant.displayName,
    globalProfileTimestamp: participant.joinedAt,
    isKicked: false,
    joinedAt: participant.joinedAt,
  } as SpaceMemberRow;
}

export class MessageService {
  private messageDB: MessageDB;
  private enqueueOutbound: (action: () => Promise<string[]>) => void;
  private addOrUpdateConversation: (
    queryClient: QueryClient,
    address: string,
    timestamp: number,
    lastReadTimestamp: number,
    updatedUserProfile?: Partial<secureChannel.UserProfile>
  ) => void;
  // Additional dependencies for handleNewMessage
  private apiClient: QuorumApiClient;
  private deleteEncryptionStates: (args: {
    conversationId: string;
  }) => Promise<void>;
  private deleteInboxMessages: (
    inboxKeyset: any,
    timestamps: number[],
    apiClient: QuorumApiClient
  ) => Promise<void>;
  /** Retry budget for DM frames that fail to decrypt — see frameRetry.ts. */
  private undecryptableFrames = new UndecryptableFrameTracker();
  private navigate: (path: string, options?: any) => void;
  private spaceInfo: Ref<SpaceInfoMap>;
  private syncInfo: Ref<SyncInfoMap>;
  private synchronizeAll: (
    spaceId: string,
    inboxAddress: string
  ) => Promise<void>;
  private informSyncData: (
    spaceId: string,
    inboxAddress: string,
    messageCount: number,
    memberCount: number,
    theirSummary?: any
  ) => Promise<void>;
  private initiateSync: (spaceId: string) => Promise<void>;
  private requestSync: (spaceId: string) => Promise<boolean>;
  private directSync: (spaceId: string, message: any) => Promise<void>;
  private saveConfig: (args: { config: any; keyset: any }) => Promise<void>;
  private sendHubMessage: (spaceId: string, message: string) => Promise<string>;
  private handleSyncInitiateV2: (spaceId: string, message: any) => Promise<void>;
  private handleSyncManifest: (spaceId: string, targetInbox: string, payload: any) => Promise<void>;

  private threadService: ThreadService;

  // Did the roster pull actually deliver? The member half of a sync is one
  // payload with no retry, so a lost frame silently costs the entire roster.
  // Peers advertise `memberCount` on `sync-info`; this compares that against
  // what we hold and asks again when we are obviously short.
  private rosterConvergence = createRosterConvergenceTracker();

  // One pending convergence check per space. Several peers answer a single
  // request, so without this every `sync-info` would arm its own timer and the
  // same check would run N times for one exchange.
  private rosterConvergenceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // Per-sender rate limiters (receiving-side defense-in-depth)
  private receivingRateLimiters = new Map<string, SimpleRateLimiter>();

  // ActionQueueService for persistent queue (optional, set via setter)
  private actionQueueService?: ActionQueueService;

  // ReceiptService for DM delivery + read receipts (optional, set via setter)
  private receiptService: ReceiptService | null = null;

  // TypingService for ephemeral typing-indicator signaling (optional, set via setter)
  private typingService: TypingService | null = null;

  // Cooldown guard: prevents rapid re-broadcasts when a space owner spam-updates their tag
  private pendingTagRebroadcast = new Set<string>();

  /**
   * A DM frame failed to decrypt. Decide whether to keep it on the server for
   * another attempt, or give up and delete it.
   *
   * Frames routinely fail simply because our receiving chain has not yet
   * ratcheted into the sender's current chain; the DH ratchet then stores the
   * skipped message keys and the SAME frame decrypts. Deleting on the first
   * failure destroyed those frames permanently — verified 2026-07-25 by
   * replaying real captured frames against real captured states: 5 of 6
   * deleted frames were decryptable against a state this client held ~35s
   * later.
   *
   * Retaining is safe for the inbox: the inbound loop already catches handler
   * errors and continues, so a kept frame does not block the ones behind it.
   * The attempt/TTL budget preserves the original protection against a
   * genuinely poisonous frame lingering forever.
   */
  private retainOrDropUndecryptableFrame(
    branch: string,
    message: { inboxAddress?: string; encryptedContent: string; timestamp: number },
    receivingInbox: unknown
  ): void {
    const key = frameKey(message.inboxAddress, message.encryptedContent);
    if (!this.undecryptableFrames.recordFailure(key)) {
      // Keep it: the server redelivers anything not acked-by-delete, so the
      // frame comes back and is retried once the session has moved on.
      return;
    }
    logger.warn(
      '[MessageService] giving up on an undecryptable DM frame after the retry budget — deleting',
      {
        branch,
        inbox: message.inboxAddress?.slice(0, 16),
        frameTimestamp: message.timestamp,
      }
    );
    this.dispatchInboxDelete(
      receivingInbox,
      [message.timestamp],
      'give-up on an undecryptable frame'
    );
  }

  /**
   * Fire an inbox-delete at the relay WITHOUT holding the caller open on it.
   *
   * ── Why this exists ───────────────────────────────────────────────────────
   *
   * Every caller of this runs inside `dmRatchetMutex.runExclusive(conversationId,
   * …)`, and awaiting a relay POST in there holds the per-conversation lock for
   * the duration of the call. `defaultMutateTimeout` is 22s and mutations retry
   * twice, so one slow delete froze an entire conversation — both directions,
   * since a DM's two directions share one conversationId — for up to ~69s.
   *
   * That is measured, not theorised: stalling this POST by 30s on 1 call in 20
   * produced lock holds of 31.2s, messages queued 31.1s behind the lock, and
   * per-device persistence collapsing into CONTIGUOUS TAIL gaps while every frame
   * still arrived. See `bugs/.solved/2026-07-28-dm-receive-holds-ratchet-lock-across-http.md`
   * §5-CONFIRMED, reproducible with `HARNESS_FAULT_DELETE_DELAY_MS`.
   *
   * ── Why not awaiting is safe ──────────────────────────────────────────────
   *
   * The lock exists to serialize RATCHET STATE — read, advance, save. The delete
   * is not part of that: by the time it runs the encryption state is already
   * persisted, and the delete's only job is to stop the relay redelivering a
   * frame we have finished with. Its failure was already a no-op by design (the
   * frame simply comes back and is skipped again), so waiting up to a minute for
   * it bought nothing.
   *
   * This is the shape mobile already uses (`deleteProcessedEnvelope` returns void
   * and is dispatched `.catch(() => {})`, never awaited) and the shape desktop's
   * own SEND paths already use (they wrap the delivery promise as `{ sent }` so it
   * is not awaited inside the lock). The receive path was the odd one out.
   *
   * ⚠️ **Call this only AFTER the encryption state is persisted.** A crash between
   * the two would otherwise lose a frame the relay would have redelivered. Every
   * current caller satisfies this because the preceding `saveEncryptionState` /
   * `deleteEncryptionStates` is still awaited.
   *
   * ⚠️ Two of the callers used to RETHROW on failure (the delete-conversation
   * branches and the give-up path). They no longer can, so the `.catch` below is
   * the only remaining signal — keep it. Redelivery covers the functional case,
   * and `MessageDB.deleteInboxMessages` already logs loudly before it rejects.
   */
  private dispatchInboxDelete(
    receivingInbox: unknown,
    timestamps: number[],
    context: string
  ): void {
    // Deferred through a resolved promise so a SYNCHRONOUS throw from the
    // dependency lands in the same .catch as a rejection, rather than escaping
    // into the critical section this exists to keep short.
    void Promise.resolve()
      .then(() => this.deleteInboxMessages(receivingInbox, timestamps, this.apiClient))
      .catch((err) => {
        logger.warn(
          `[MessageService] inbox-delete failed (${context}) — the frame will be redelivered`,
          err
        );
      });
  }

  /**
   * Acknowledge a DM frame we have successfully decrypted, by deleting it from
   * the server inbox.
   *
   * The confirmed-session path never did this: it relied on the
   * delete-on-first-decrypt-failure above to clear the inbox, so a frame that
   * SUCCEEDED was simply left there. That was invisible while failures were
   * deleted immediately, but once frames are retained for retry the server
   * keeps redelivering them and each redelivery is decrypted again — measured
   * live at 12 repeat decrypts of a single frame. Acking on success stops the
   * redelivery at the source.
   *
   * Never allowed to throw: a failed ack just means the frame is redelivered
   * and skipped again, which is strictly better than losing the message we
   * already decrypted.
   */
  private ackProcessedFrame(receivingInbox: unknown, timestamp: number): void {
    this.dispatchInboxDelete(receivingInbox, [timestamp], 'ack of a processed DM frame');
  }

  constructor(dependencies: MessageServiceDependencies) {
    this.messageDB = dependencies.messageDB;
    this.threadService = new ThreadService(this.messageDB);
    this.enqueueOutbound = dependencies.enqueueOutbound;
    this.addOrUpdateConversation = dependencies.addOrUpdateConversation;
    this.apiClient = dependencies.apiClient;
    this.deleteEncryptionStates = dependencies.deleteEncryptionStates;
    this.deleteInboxMessages = dependencies.deleteInboxMessages;
    this.navigate = dependencies.navigate;
    this.spaceInfo = dependencies.spaceInfo;
    this.syncInfo = dependencies.syncInfo;
    this.synchronizeAll = dependencies.synchronizeAll;
    this.informSyncData = dependencies.informSyncData;
    this.initiateSync = dependencies.initiateSync;
    this.requestSync = dependencies.requestSync;
    this.directSync = dependencies.directSync;
    this.saveConfig = dependencies.saveConfig;
    this.sendHubMessage = dependencies.sendHubMessage;
    this.handleSyncInitiateV2 = dependencies.handleSyncInitiateV2;
    this.handleSyncManifest = dependencies.handleSyncManifest;
  }

  /**
   * Set the ActionQueueService for persistent queue operations.
   * Call this after MessageService is created to avoid circular dependencies.
   */
  setActionQueueService(service: ActionQueueService): void {
    this.actionQueueService = service;
  }

  /**
   * Set the ReceiptService for DM delivery + read receipts.
   * Call this after MessageService is created to avoid circular dependencies.
   */
  setReceiptService(service: ReceiptService): void {
    this.receiptService = service;
  }

  /**
   * Set the TypingService for ephemeral typing-indicator signaling.
   * Call this after MessageService is created to avoid circular dependencies.
   */
  setTypingService(service: TypingService): void {
    this.typingService = service;
  }

  /**
   * Send an ephemeral control message to a DM partner.
   *
   * Encrypts via Double Ratchet and posts to the partner's inbox using the
   * same path as delivery/read receipts. Never calls saveMessage — the message
   * has no local persistence and never enters the sync manifest. Fire-and-forget:
   * errors are logged but not thrown.
   *
   * Used by: TypingService for typing-start/stop signaling.
   *
   * Known limitation: requires existing Double Ratchet sessions in
   * `encryption_states` for the conversation. `encryptAndSendDm` reuses
   * cached sessions and does NOT create new ones (unlike the legacy DM
   * send path which can hydrate sessions from registration data on the
   * fly). Consequence: in a brand-new DM (or one where local session
   * state is missing), typing signals silently no-op until the user sends
   * a real message that bootstraps a session. After that one bootstrap,
   * typing works normally for the rest of the conversation. Acceptable
   * trade-off — typing is fire-and-forget and shouldn't do expensive
   * session establishment.
   *
   * @param address - DM partner address
   * @param msg - Control message payload (TypingMessage)
   * @param selfUserAddress - This client's own address
   * @param keyset - Device + user keyset for encryption
   */
  async sendEphemeralDMControl(
    address: string,
    msg: TypingMessage,
    selfUserAddress: string,
    keyset: {
      deviceKeyset: secureChannel.DeviceKeyset;
      userKeyset: secureChannel.UserKeyset;
    },
  ): Promise<void> {
    try {
      // Cast to Record<string, unknown> because TypingMessage's typed shape
      // doesn't satisfy the generic signature, but the JSON serialisation works fine.
      await this.encryptAndSendDm(
        address,
        msg as unknown as Record<string, unknown>,
        selfUserAddress,
        keyset,
      );
    } catch (err) {
      logger.warn('[Typing] sendEphemeralDMControl failed', { err, address: address.slice(0, 16) });
    }
  }

  /**
   * Broadcast an ephemeral control message to a space.
   *
   * Encrypts via Triple Ratchet and broadcasts via the space hub. Never
   * calls saveMessage — the control message has no local persistence and
   * never enters the sync manifest. Fire-and-forget.
   *
   * Used by: TypingService for typing-start/stop signaling in channels and threads.
   */
  async sendEphemeralSpaceControl(spaceId: string, msg: TypingMessage): Promise<void> {
    try {
      // No options: stripEphemeralFields is a no-op for TypingMessage (no
      // sendStatus/sendError fields), and saveStateAfterSend is not consulted
      // by encryptAndSendToSpace. Pass through as-is.
      await this.encryptAndSendToSpace(spaceId, msg as unknown as Message);
    } catch (err) {
      logger.warn('[Typing] sendEphemeralSpaceControl failed', { err, spaceId });
    }
  }

  // Broadcasts the sender's current profile to every DM partner THIS USER HAS
  // DELIBERATELY MESSAGED, over their existing session, so receivers can
  // refresh their stored displayName / icon / bio. Per-partner failures (no
  // established session yet, etc.) are logged and skipped — never block the
  // user-facing profile save.
  //
  // ⚠️ The reveal-ledger filter below is a PRIVACY boundary, not an
  // optimisation. A conversation row is created by a STRANGER'S INBOUND
  // MESSAGE, so having a row is not consent. Without the filter, changing your
  // display name announces you to everyone who has ever messaged you — and
  // `rebroadcastProfileToAllDMsOnConnect` fires this on every reconnect with no
  // user action behind it, so a spammer would learn your identity by doing
  // nothing but waiting. See utils/dmRevealLedger.ts.
  async broadcastProfileToAllDMs(
    displayName: string,
    userIcon: string,
    bio: string | undefined,
    selfUserAddress: string,
    keyset: {
      deviceKeyset: secureChannel.DeviceKeyset;
      userKeyset: secureChannel.UserKeyset;
    },
  ): Promise<void> {
    let conversations: Conversation[];
    try {
      const result = await this.messageDB.getConversations({ type: 'direct' });
      conversations = result.conversations;
    } catch (err) {
      logger.warn('[DMProfile] Failed to enumerate DM conversations', { err });
      return;
    }

    let sent = 0;
    let skippedUnrevealed = 0;

    for (const conv of conversations) {
      const partnerAddress = conv.address;
      if (!partnerAddress || partnerAddress === selfUserAddress) continue;

      // Privacy gate. Independent of the dedup gate below and both are wanted:
      // this one asks "may we tell them at all", the dedup gate asks "have we
      // already told them this exact thing". Fails CLOSED.
      const revealed = await this.isRevealedTo(selfUserAddress, partnerAddress);
      if (!revealed) {
        skippedUnrevealed += 1;
        continue;
      }

      const msg: DMUpdateProfileMessage = {
        type: 'dm-update-profile',
        senderId: selfUserAddress,
        displayName,
        userIcon,
        ...(bio !== undefined ? { bio } : {}),
      };

      // Dedup gate. The on-connect rebroadcast fires on EVERY ws.onopen, and
      // each send here is a real encrypted DM on the wire. Skip a send whose
      // payload is byte-identical to the last one this device recorded for
      // this (self, partner). Recorded only AFTER a successful send, so a
      // failure leaves the gate open and the next connect retries.
      // Mirrors mobile's MMKV gate (services/dm/dmProfileService.ts).
      const signature = dmProfileSignature(msg);
      if (!shouldSendDmProfile(selfUserAddress, partnerAddress, signature)) {
        continue;
      }

      // Claim BEFORE the await, release in `finally` — see dmProfileGate.
      claimDmProfileSend(selfUserAddress, partnerAddress, signature);
      try {
        await this.encryptAndSendDm(
          partnerAddress,
          msg as unknown as Record<string, unknown>,
          selfUserAddress,
          keyset,
        );
        recordDmProfileSend(selfUserAddress, partnerAddress, signature);
        sent += 1;
      } catch (err) {
        // A contact row with no established session is the normal case for a
        // never-messaged contact, not a fault: there is no session to encrypt
        // to, and there is no conversation to fix either. Stay quiet about it
        // so the genuine failures below remain visible. The gate is NOT
        // recorded, so this partner is retried once a session exists.
        const message = (err as Error)?.message ?? '';
        if (message.includes('No established sessions available')) {
          logger.debug('[DMProfile] no session with partner yet — skipping', {
            partner: partnerAddress.slice(0, 16),
          });
          continue;
        }
        logger.warn('[DMProfile] broadcast to partner failed', {
          err,
          partner: partnerAddress.slice(0, 16),
        });
      } finally {
        // Runs on the `continue` above too, so a no-session partner is not
        // wedged shut for the rest of the session.
        releaseDmProfileSend(selfUserAddress, partnerAddress, signature);
      }
    }

    // The only externally visible evidence this ran, and the only way to tell
    // "sent to nobody because everyone was deduped" from "sent to nobody
    // because everyone is a stranger" from "never called at all" — three very
    // different causes. `skipped` is what makes the privacy guard observable in
    // a harness run: the leak reads `broadcast to 1/1`, the fix reads
    // `broadcast to 0/1 … 1 unrevealed`.
    logger.log(
      `[DMProfile] broadcast to ${sent}/${conversations.length} partner(s)` +
        (skippedUnrevealed > 0 ? ` — ${skippedUnrevealed} unrevealed (skipped)` : '') +
        (sent === 0 && skippedUnrevealed === 0 ? ' — all deduped or unreachable' : '')
    );
  }

  /**
   * One auto-reveal per partner per hour, process-local.
   *
   * An init envelope can be REDELIVERED (the receive path bounds replays but
   * does not eliminate them), and every redelivery looks like "a new session
   * appeared" — without this, one flapping inbox turns a single new device into
   * a push storm.
   *
   * Keyed on the PARTNER alone, which is narrower than the reveal ledger's
   * (self, partner) pair. A desktop process serves one account at a time, so
   * the extra dimension would only add a way for the two keys to disagree.
   */
  private static readonly AUTO_REVEAL_DEBOUNCE_MS = 60 * 60 * 1000;
  private autoRevealLastFired = new Map<string, number>();

  /**
   * Partners with an auto-reveal already running.
   *
   * The debounce timestamp alone is not enough: it is stamped after two awaits
   * (the ledger check and the config read), so two "new session" frames
   * arriving close together can BOTH pass the timestamp check before either
   * stamps it, and both push. Claiming the partner synchronously — before any
   * await — closes that window, the same way `dmProfileGate`'s in-flight claim
   * does for the sweep. Not persisted: a reload legitimately means nothing is
   * in flight.
   */
  private autoRevealInFlight = new Set<string>();

  /**
   * "Have I deliberately messaged this partner?", with the one-time derivation
   * from local history.
   *
   * Every reveal decision in this service goes through here rather than calling
   * `ensureRevealBootstrap` directly, so there is one place to audit.
   *
   * What makes the history scan trustworthy is `Message.authenticatedSenderId`,
   * stamped by `saveMessage` from the crypto layer's answer and never read off
   * the wire. Deliberately NOT `content.senderId`, which any sender can write.
   */
  private async isRevealedTo(
    selfAddress: string,
    partnerAddress: string
  ): Promise<boolean> {
    return ensureRevealBootstrap(selfAddress, partnerAddress, (p) =>
      this.messageDB.getMessages(p)
    );
  }

  /**
   * A DM partner has appeared with a NEW SESSION carrying their identity — a
   * reinstall, a second device, a reset. If we have already deliberately
   * messaged them, push our identity once so their fresh device shows our name
   * without waiting for our next rename or reply.
   *
   * Consent belongs to the RELATIONSHIP, not the session (see
   * utils/dmRevealLedger.ts), which is the whole reason this is allowed to fire
   * without a user action behind it. If the ledger says stranger: total
   * silence. That silence is the feature — a spammer's client establishing a
   * session with us must learn nothing.
   *
   * ⚠️ Fire-and-forget by construction. This runs from the receive path, where
   * a throw would abort processing of a frame that holds a real message. Every
   * failure inside is swallowed; the on-connect sweep and the next deliberate
   * send are independent backstops that do not depend on this at all.
   *
   * @param partnerAddress MUST be the AUTHENTICATED session address, never the
   *   self-declared `user_profile.user_address` from inside the envelope.
   */
  private maybeAutoRevealToPartner(
    selfAddress: string,
    partnerAddress: string,
    keyset: {
      deviceKeyset: secureChannel.DeviceKeyset;
      userKeyset: secureChannel.UserKeyset;
    },
  ): void {
    if (!selfAddress || !partnerAddress) return;
    if (partnerAddress === selfAddress) return; // our own other device

    // Claimed SYNCHRONOUSLY, before the first await below — see
    // `autoRevealInFlight`. Released in the `finally` at the bottom.
    if (this.autoRevealInFlight.has(partnerAddress)) return;
    this.autoRevealInFlight.add(partnerAddress);

    void (async () => {
      try {
        const now = Date.now();
        const last = this.autoRevealLastFired.get(partnerAddress) ?? 0;
        if (now - last < MessageService.AUTO_REVEAL_DEBOUNCE_MS) return;

        const revealed = await this.isRevealedTo(selfAddress, partnerAddress);
        if (!revealed) return;

        const config = await this.messageDB.getUserConfig({ address: selfAddress });
        const displayName = config?.name || '';
        const userIcon = config?.profile_image || '';
        // Nothing to advertise yet — a wire no-op the receiver would ignore.
        // Checked BEFORE the debounce stamp so a fresh account that has not
        // finished syncing its config does not burn its hour on a no-op.
        if (!displayName && !userIcon) return;

        // Stamped BEFORE the send, deliberately. A transient failure below
        // costs a legitimate reveal for up to an hour, because the next
        // redelivery of the same envelope is debounced away too. The
        // alternative — stamping only after a confirmed send — lets a
        // redelivery storm re-attempt on every envelope while the failure
        // persists, which is the exact storm this exists to prevent. Fails SAFE
        // either way: a missed reveal, never a leak.
        this.autoRevealLastFired.set(partnerAddress, now);

        await this.pushIdentityToPartner(
          selfAddress,
          partnerAddress,
          keyset,
          displayName,
          userIcon,
          'new session'
        );
      } catch (err) {
        this.logIdentityPushFailure('auto-reveal', partnerAddress, err);
      } finally {
        this.autoRevealInFlight.delete(partnerAddress);
      }
    })();
  }

  /**
   * Log an identity-push failure at the level it deserves.
   *
   * "No established sessions available" is the ONE expected outcome — it means
   * first contact, where the outbound's own init envelope already carries our
   * identity, so there was nothing for the push to do. Everything else is a
   * real failure and must not hide behind it.
   *
   * The level matters more than it looks: production logging is raised to
   * `warn` when diagnostics are enabled, so anything logged at `debug` is
   * invisible even to a deliberate support session. "My name never reached my
   * friend" would otherwise produce no signal anywhere.
   */
  private logIdentityPushFailure(
    what: string,
    partnerAddress: string,
    err: unknown
  ): void {
    const message = (err as Error)?.message ?? '';
    if (message.includes('No established sessions available')) {
      logger.debug(`[DMProfile] ${what} skipped — no session with partner yet`, {
        partner: partnerAddress.slice(0, 16),
      });
      return;
    }
    logger.warn(`[DMProfile] ${what} failed`, {
      err,
      partner: partnerAddress.slice(0, 16),
    });
  }

  /**
   * The user has just deliberately messaged this partner for the first time.
   * That act IS the consent, so record it and push our identity once.
   *
   * Why the push and not just the record: replying to someone who messaged us
   * FIRST happens on a session THEY established, so our reply is an ordinary
   * established-session frame and carries no `user_profile`. Without this, a
   * reply would grant consent that nothing acts on until our next rename or
   * reconnect sweep — the partner would sit on a placeholder for hours after we
   * had already answered them.
   *
   * On a genuine first contact (we initiate) there is no session yet, so the
   * push below throws "No established sessions available" and is swallowed:
   * correct, because that outbound's own INIT envelope already carries our
   * identity. So this fires usefully exactly in the reply case.
   *
   * ⚠️ Fire-and-forget. An identity push must never surface as a failed message
   * send. `recordReveal` is called SYNCHRONOUSLY before the async part, so the
   * caller's `mayRevealIdentity` and any concurrent sweep see the new state
   * immediately.
   */
  private recordRevealAndAnnounce(
    selfAddress: string,
    partnerAddress: string,
    keyset: {
      deviceKeyset: secureChannel.DeviceKeyset;
      userKeyset: secureChannel.UserKeyset;
    },
  ): void {
    if (!selfAddress || !partnerAddress || partnerAddress === selfAddress) return;
    const alreadyRevealed = hasRevealedTo(selfAddress, partnerAddress);
    recordReveal(selfAddress, partnerAddress, Date.now());
    // Already revealed: the ledger says so and the ordinary gate/sweep already
    // cover this partner. Returning here is what keeps this off the hot path of
    // every subsequent message in an established conversation.
    if (alreadyRevealed) return;

    void (async () => {
      try {
        const config = await this.messageDB.getUserConfig({ address: selfAddress });
        const displayName = config?.name || '';
        const userIcon = config?.profile_image || '';
        if (!displayName && !userIcon) return;
        await this.pushIdentityToPartner(
          selfAddress,
          partnerAddress,
          keyset,
          displayName,
          userIcon,
          'first deliberate send'
        );
      } catch (err) {
        this.logIdentityPushFailure('reveal-on-send push', partnerAddress, err);
      }
    })();
  }

  /**
   * Send one `dm-update-profile` to one partner, through the shared dedup gate.
   *
   * ⚠️ PRECONDITION, enforced by the CALLER and not here: the caller must
   * already know it is safe to reveal identity to this partner — either the
   * ledger says so, or the caller IS the act that establishes consent. This
   * function performs NO reveal check of its own, deliberately, so there is
   * exactly ONE place that owns the consent decision per call site. Do not add
   * a second check here; two copies of a decision are how the two copies drift.
   */
  private async pushIdentityToPartner(
    selfAddress: string,
    partnerAddress: string,
    keyset: {
      deviceKeyset: secureChannel.DeviceKeyset;
      userKeyset: secureChannel.UserKeyset;
    },
    displayName: string,
    userIcon: string,
    reason: string,
  ): Promise<void> {
    // The gate may hold "already announced 3x" from a period when this partner
    // could not receive it (an old session, or the era when cross-client pushes
    // were silently eaten). That record must not gag the one reveal the trigger
    // just earned.
    clearDmProfileSendState(selfAddress, partnerAddress);

    const msg: DMUpdateProfileMessage = {
      type: 'dm-update-profile',
      senderId: selfAddress,
      displayName,
      userIcon,
    };
    const signature = dmProfileSignature(msg);
    if (!shouldSendDmProfile(selfAddress, partnerAddress, signature)) return;
    claimDmProfileSend(selfAddress, partnerAddress, signature);
    try {
      await this.encryptAndSendDm(
        partnerAddress,
        msg as unknown as Record<string, unknown>,
        selfAddress,
        keyset,
      );
      recordDmProfileSend(selfAddress, partnerAddress, signature);
      logger.log(`[DMProfile] identity revealed to partner (${reason})`, {
        partner: partnerAddress.slice(0, 16),
      });
    } finally {
      releaseDmProfileSend(selfAddress, partnerAddress, signature);
    }
  }

  /**
   * On-connect DM identity rebroadcast.
   *
   * An established DM session never carries the sender's identity (the decrypt
   * union only exposes `user_profile` on its init-carrying variant, measured
   * absent on every established-session frame), so a partner whose row is still
   * a placeholder has no way to learn who we are from ordinary traffic. Pushing
   * our current global identity on connect is the recovery path — and the only
   * one that works for a partner with no published public profile.
   *
   * Mirrors mobile, which already rebroadcasts to all DM partners on reconnect
   * (quorum-mobile WebSocketContext.tsx, the on-connect effect that calls
   * `dmProfileService.broadcastProfileToAllDMs` — named rather than pinned to a
   * line, because the line this cited had drifted ~490 lines into unrelated
   * read-ack code by 2026-08-20). Cheap by construction:
   * the per-partner gate above makes an unchanged identity a no-op on the wire.
   */
  async rebroadcastProfileToAllDMsOnConnect(
    selfUserAddress: string,
    keyset: {
      deviceKeyset: secureChannel.DeviceKeyset;
      userKeyset: secureChannel.UserKeyset;
    },
  ): Promise<void> {
    try {
      const config = await this.messageDB.getUserConfig({
        address: selfUserAddress,
      });
      const displayName = config?.name || '';
      const userIcon = config?.profile_image || '';
      // Nothing to advertise yet (fresh account, config not synced) — sending
      // empty fields would be a wire no-op the receiver ignores anyway.
      if (!displayName && !userIcon) return;
      // Bio is deliberately omitted: the DM identity push gates bio on the
      // public-profile toggle (legacy DM behaviour), and this path has no
      // access to that decision. Name + avatar only, matching mobile.
      await this.broadcastProfileToAllDMs(
        displayName,
        userIcon,
        undefined,
        selfUserAddress,
        keyset,
      );
    } catch (err) {
      logger.warn('[DMProfile] on-connect rebroadcast failed', { err });
    }
  }

  /**
   * Attach piggybacked delivery + read receipt acks to an outgoing DM message.
   * Called before encryption so the ack data is included in the encrypted payload.
   * After encryption, call stripPiggybackedAcks() to remove transient fields before persisting.
   */
  private attachPiggybackedAcks(address: string, message: Message): void {
    if (!this.receiptService) return;

    const envelope = message as Message & ReceiptEnvelopeFields;

    const pendingAcks = this.receiptService.flushForPiggyback(address);
    if (pendingAcks.length > 0) {
      envelope.ackMessageIds = pendingAcks;
    }

    const pendingReadAck = this.receiptService.flushReadForPiggyback(address);
    if (pendingReadAck) {
      envelope.readAckUpTo = pendingReadAck;
    }
  }

  /**
   * Strip piggybacked ack fields from a message before persisting to IndexedDB.
   * These fields are transient wire-format data that should not be stored locally.
   */
  private stripPiggybackedAcks(message: Message): void {
    const envelope = message as Message & ReceiptEnvelopeFields;
    delete envelope.ackMessageIds;
    delete envelope.readAckUpTo;
  }

  /**
   * Intercept ephemeral control messages and process piggybacked receipt data
   * from a decrypted DM message.
   *
   * Returns true if the message is a control message (delivery-ack, read-ack,
   * typing-start, typing-stop) that should be intercepted and never saved.
   * Returns false if it is a normal message (continue with saveMessage pipeline);
   * any piggybacked ack fields are processed and stripped in that case.
   *
   * Steps applied at both DM decrypt paths:
   * 1.  Intercept delivery-ack control messages — return true (early exit)
   * 1b. Intercept read-ack control messages — return true (early exit)
   * 1c. Intercept typing-start / typing-stop control messages — return true (early exit)
   * 2.  Extract + process piggybacked ackMessageIds — then strip before saveMessage
   * 2b. Extract + process piggybacked readAckUpTo — then strip before saveMessage
   * 3.  Buffer the received message's ID for acking — after decryption succeeds
   */
  private interceptControlMessages(
    decryptedContent: Message,
    senderAddress: string,
    selfAddress: string,
    deliveryReceiptsEnabled: boolean,
    readReceiptsEnabled: boolean,
    queryClient?: QueryClient,
  ): boolean {
    const raw = decryptedContent as any;

    // 1. Intercept delivery-ack control messages — never save, never display.
    // The ack message is a flat object { type: 'delivery-ack', senderId, messageIds }
    // (not nested under .content like regular Message objects). Only one sender path
    // exists (ActionQueueHandlers.sendDeliveryAck) and it has always emitted flat.
    if (raw.type === 'delivery-ack') {
      if (this.receiptService && deliveryReceiptsEnabled) {
        const ackIds = raw.messageIds ?? [];
        this.receiptService.onAckReceived(ackIds);
      }
      return true; // Signal: intercept this message
    }

    // 1b. Intercept read-ack control messages — never save, never display.
    // Only persist readAt when user's readReceipts setting is ON. This way toggling
    // OFF stops new read receipts from being written, but already-persisted ones
    // remain visible (settings gate persistence, display is unconditional).
    if (raw.type === 'read-ack') {
      if (this.receiptService && readReceiptsEnabled) {
        const upToMessageId = raw.upToMessageId;
        const upToTimestamp = raw.upToTimestamp;
        if (upToMessageId && upToTimestamp) {
          // messageIds is absent from peers on older builds — the mark alone
          // still applies, exactly as before.
          this.receiptService.onReadAckReceived(
            upToMessageId,
            upToTimestamp,
            senderAddress,
            raw.messageIds
          );
        }
      }
      return true; // Signal: intercept this message
    }

    // 1c. Intercept typing-start / typing-stop control messages — never save, never display.
    // The privacy gate lives inside TypingService.onTypingReceived (it reads the live
    // userConfig via the service's isEnabledForScope callback). We intercept here so
    // typing messages never reach saveMessage regardless of the gate's state.
    const isTyping = raw.type === 'typing-start' || raw.type === 'typing-stop';
    if (isTyping) {
      if (this.typingService) {
        this.typingService.onTypingReceived(raw as TypingMessage);
      }
      return true; // Signal: intercept this message — never reaches saveMessage
    }

    // 1d. Intercept dm-update-profile — broadcast by a DM partner when they
    // change their global profile. Upsert the conversation row so the next
    // render shows the new identity. senderId must match the envelope's
    // sender address (anti-spoofing); mismatched messages are dropped.
    //
    // TWO DIALECTS, both live: our own FLAT `{ type, senderId, … }` and
    // mobile's WRAPPED `{ messageId, content: { type, … } }`. This used to
    // test `raw.type` alone, so a mobile rename matched nothing and the frame
    // fell through to saveMessage below — persisted as a ghost message in the
    // conversation. See utils/dmProfileWire.ts.
    const profilePayload = parseDmProfileUpdate(raw);
    if (profilePayload) {
      if (profilePayload.senderId === senderAddress) {
        this.handleDMProfileUpdate(senderAddress, profilePayload, queryClient).catch((err) => {
          logger.warn('[DMProfile] handleDMProfileUpdate failed', { err, sender: senderAddress.slice(0, 16) });
        });
      } else {
        logger.warn('[DMProfile] Rejected dm-update-profile with mismatched senderId', {
          envelopeSender: senderAddress.slice(0, 16),
          claimedSender: profilePayload.senderId?.slice(0, 16),
        });
      }
      // Consumed either way. A spoofed frame must be DROPPED, not rendered:
      // returning false here would put an attacker-authored payload through
      // saveMessage, which is the ghost row again with worse provenance.
      return true;
    }

    // 2. Extract piggybacked ackMessageIds, process, then strip
    const ackMessageIds = raw.ackMessageIds;
    if (ackMessageIds && this.receiptService && deliveryReceiptsEnabled) {
      this.receiptService.onAckReceived(ackMessageIds);
    }
    delete raw.ackMessageIds;

    // 2b. Extract piggybacked readAckUpTo, process, then strip
    const readAckUpTo = raw.readAckUpTo;
    if (readAckUpTo && this.receiptService && readReceiptsEnabled) {
      this.receiptService.onReadAckReceived(
        readAckUpTo.messageId,
        readAckUpTo.timestamp,
        senderAddress,
        readAckUpTo.messageIds
      );
    }
    delete raw.readAckUpTo;

    // 3. Buffer this message's ID for acking (only for post messages from others)
    // DEFENSE IN DEPTH: explicitly exclude delivery-ack and read-ack to prevent infinite ack loops
    if (
      this.receiptService &&
      deliveryReceiptsEnabled &&
      decryptedContent.content?.type === 'post' &&
      decryptedContent.content?.senderId !== selfAddress
    ) {
      this.receiptService.onMessageReceived(senderAddress, decryptedContent.messageId);
    }

    return false; // Signal: continue with normal saveMessage pipeline
  }

  // Upsert-aware merge: non-empty fields overwrite, absent fields preserve.
  // Bio accepts empty string as "clear" to match space update-profile.
  private async handleDMProfileUpdate(
    senderAddress: string,
    profileMsg: DmProfileUpdatePayload,
    queryClient?: QueryClient,
  ): Promise<void> {
    const conversationId = senderAddress + '/' + senderAddress;
    const existing = await this.messageDB.getConversation({ conversationId });
    if (!existing?.conversation) return;

    const merged = {
      ...existing.conversation,
      ...(profileMsg.displayName ? { displayName: profileMsg.displayName } : {}),
      ...(profileMsg.userIcon ? { icon: profileMsg.userIcon } : {}),
      ...(profileMsg.bio !== undefined ? { bio: profileMsg.bio } : {}),
      // CLAIMED, never verified. The sender asserts this `.q` name; nothing in
      // this frame proves the claim, so it goes in a claimed-only slot and the
      // verified name resolution path must not read it. Presence-exact ('' is
      // a deliberate un-election). The key is snake_case to match the one
      // mobile already reads and writes in 23 files — see the field's doc on
      // the shared `Conversation` type for why desktop conforms rather than
      // introducing a second spelling of the same fact.
      ...(profileMsg.primaryUsername !== undefined
        ? { claimed_primary_username: profileMsg.primaryUsername }
        : {}),
    };

    await this.messageDB.saveConversation(merged);

    if (queryClient) {
      queryClient.invalidateQueries({ queryKey: buildConversationsKey({ type: 'direct' }) });
      queryClient.invalidateQueries({ queryKey: buildConversationKey({ conversationId }) });
    }
  }

  /**
   * Get sendHubMessage for use by ActionQueueHandlers
   */
  getSendHubMessage(): (spaceId: string, message: string) => Promise<string> {
    return this.sendHubMessage;
  }

  /**
   * Get encryptAndSendToSpace for use by ActionQueueHandlers.
   * Returns a bound method that can be called externally.
   */
  getEncryptAndSendToSpace(): (
    spaceId: string,
    message: Message,
    options?: { stripEphemeralFields?: boolean; saveStateAfterSend?: boolean }
  ) => Promise<string> {
    return this.encryptAndSendToSpace.bind(this);
  }

  /**
   * Checks whether an incoming space-manifest changes the tag the current user
   * has selected, and if so re-broadcasts update-profile to all spaces with
   * the fresh tag data. Guarded by a per-spaceId cooldown to prevent
   * amplification from a malicious owner spamming manifest updates.
   */
  private async rebroadcastTagIfChanged(
    space: Space,
    selfAddress: string,
    keyset: {
      userKeyset: secureChannel.UserKeyset;
      deviceKeyset: secureChannel.DeviceKeyset;
    },
    queryClient: QueryClient
  ): Promise<void> {
    // This is the SECOND site that broadcasts our own override slot — it uses
    // the same buildSpaceProfilePayload, which reads `ownMember.display_name`
    // off the roster. Gating only the on-connect announce left this one free to
    // re-broadcast a still-poisoned override with a fresh timestamp, and unlike
    // the announce it is not capped by the 3-attempt gate. A space-manifest can
    // arrive at any time, so wait for the legacy clear here too.
    await legacySpaceOverrideClearDone;

    // 1. Read config — one IndexedDB read
    const config = await this.messageDB.getUserConfig({ address: selfAddress });
    if (!config?.spaceTagId) return;

    // 2. Early return if this manifest isn't for the space whose tag we display
    if (config.spaceTagId !== space.spaceId) return;

    // 3. Cooldown guard — skip if we already re-broadcast for this space recently
    if (this.pendingTagRebroadcast.has(space.spaceId)) return;

    // 4. Compare tag data — only broadcast if something actually changed
    const currentTag = space.spaceTag;
    const lastTag = config.lastBroadcastSpaceTag;

    if (currentTag?.letters) {
      // Tag still exists — check if it changed
      const tagChanged =
        !lastTag ||
        lastTag.letters !== currentTag.letters ||
        lastTag.url !== currentTag.url;

      if (!tagChanged) return;
    } else if (!lastTag) {
      // Tag was already absent and we had no previous tag — nothing to do
      return;
    }
    // else: tag was deleted by owner (currentTag is undefined but lastTag exists) — need to clear

    // 5. Set cooldown guard (60s) before starting async work
    this.pendingTagRebroadcast.add(space.spaceId);
    setTimeout(() => this.pendingTagRebroadcast.delete(space.spaceId), 60_000);

    // 6. Build the resolved tag (or undefined if owner deleted it)
    // `null`, not `undefined`, when the owner deleted the tag: this is the one
    // caller that fires BECAUSE the tag changed, so it is the one entitled — and
    // obliged — to say "it is gone". Omitting the field would read as "no
    // change" and the deletion would never reach anybody. See
    // resolveInboundSpaceTag for the receiving half.
    const resolvedTag: BroadcastSpaceTag | null = currentTag?.letters
      ? { ...currentTag, spaceId: space.spaceId }
      : null;

    // 7. Broadcast update-profile to all spaces
    const allSpaces = await this.messageDB.getSpaces();
    this.enqueueOutbound(async () => {
      const outbounds: string[] = [];

      for (const s of allSpaces) {
        try {
          const payload = await this.buildSpaceProfilePayload(
            s.spaceId,
            selfAddress,
            config,
            resolvedTag
          );
          const message = await this.signSpaceProfileMessage(
            s.spaceId,
            s.defaultChannelId,
            selfAddress,
            payload
          );
          outbounds.push(await this.encryptAndSendToSpace(s.spaceId, message));
        } catch (err) {
          logger.error(`Failed to re-broadcast tag to space ${s.spaceId}`, err);
        }
      }

      return outbounds;
    });

    // 9. Persist updated lastBroadcastSpaceTag so we don't re-broadcast again
    const updatedConfig = {
      ...config,
      lastBroadcastSpaceTag: currentTag?.letters
        ? { letters: currentTag.letters, url: currentTag.url }
        : undefined,
      // If the owner deleted the tag, clear our selection too
      ...(!currentTag?.letters ? { spaceTagId: undefined } : {}),
    };
    await this.saveConfig({ config: updatedConfig, keyset });
    queryClient.setQueryData(
      buildConfigKey({ userAddress: selfAddress }),
      () => updatedConfig
    );
  }

  /**
   * Build the `update-profile` payload this device should announce to a space.
   *
   * TWO SLOTS, kept separate (see
   * `.agents/docs/features/identity-resolution-and-profile-sync.md`):
   *
   * - OVERRIDE (`displayName`/`userIcon`/`bio`) — a deliberate per-space
   *   identity, read from our own member row. Sent only when one really exists;
   *   otherwise the field is OMITTED and the receiver's merge treats that as "no
   *   change", falling back to the global slot when it renders. Stamping the
   *   global config value into these fields is the bug the follow-global work
   *   removed: it froze each space to a stale global and made "clear my
   *   per-space name" inexpressible.
   * - GLOBAL (`global*`) — our current global identity from config, so a member
   *   who missed the live save still learns it.
   *
   * Sending the override slot matters for correctness, not just fidelity: a
   * member who set a per-space name expects spacemates to see THAT name, and a
   * bootstrap carrying only the global slot would show the global one to anybody
   * who had no row for them yet.
   */
  private async buildSpaceProfilePayload(
    spaceId: string,
    selfAddress: string,
    config: GlobalProfileFields,
    resolvedTag?: BroadcastSpaceTag | null
  ): Promise<UpdateProfileMessage> {
    const ownMember = await this.messageDB.getSpaceMember(spaceId, selfAddress);
    return buildSpaceProfileWirePayload(
      selfAddress,
      ownMember as OwnSpaceMemberFields | undefined,
      config,
      resolvedTag
      // Cast: `UpdateProfileMessage` still declares `userIcon` required, which
      // the omit-the-override rule contradicts by design. Same cast as the
      // global-save broadcast site in MessageDB.tsx. Tracked by the shared-type
      // follow-up (2026-07-16-quorum-shared-type-two-slot-global-identity-fields).
    ) as unknown as UpdateProfileMessage;
  }

  /**
   * Wrap an `update-profile` payload in a signed space `Message`.
   *
   * Signing is non-repudiable and required for profile updates, so this is not
   * optional — and it is the expensive half (a key read, a digest and an ed448
   * signature), which is why callers that gate their sends should decide BEFORE
   * calling this.
   */
  private async signSpaceProfileMessage(
    spaceId: string,
    channelId: string,
    selfAddress: string,
    payload: UpdateProfileMessage
  ): Promise<Message> {
    const nonce = crypto.randomUUID();
    const messageId = await crypto.subtle.digest(
      'SHA-256',
      Buffer.from(
        nonce + 'update-profile' + selfAddress + canonicalize(payload),
        'utf-8'
      )
    );

    const message = {
      spaceId,
      channelId,
      messageId: Buffer.from(messageId).toString('hex'),
      digestAlgorithm: 'SHA-256',
      nonce,
      createdDate: Date.now(),
      modifiedDate: Date.now(),
      lastModifiedHash: '',
      content: payload,
    } as Message;

    const inboxKey = await this.getSigningKey(spaceId);
    // `getSigningKey` legitimately resolves to undefined when we hold neither a
    // signing nor an inbox key for this space. Dereferencing it would surface
    // that as a bare TypeError inside the caller's catch-all, which tells a
    // future debugger nothing about WHICH precondition failed — and this one is
    // actionable (broken/missing key material) rather than transient.
    if (!inboxKey?.publicKey || !inboxKey?.privateKey) {
      throw new Error(`No signing key for space ${spaceId}`);
    }
    message.publicKey = inboxKey.publicKey;
    message.signature = Buffer.from(
      JSON.parse(
        ch.js_sign_ed448(
          Buffer.from(inboxKey.privateKey, 'hex').toString('base64'),
          Buffer.from(messageId).toString('base64')
        )
      ),
      'base64'
    ).toString('hex');

    return message;
  }

  /**
   * On-connect space identity announce — the BOOTSTRAP half of space identity.
   *
   * Space identity is push-based: a member's name and avatar exist on your
   * device only because somebody announced them. Desktop announced at join and
   * on tag rotation and nowhere else, so a member who joined a space while you
   * were offline had no second chance and rendered as a 6-char address
   * indefinitely. Measured on the test space "Quorum Test 2": 46 of 89 distinct
   * senders had no member row at all.
   *
   * This complements, and does not duplicate, the member digest exchange that
   * `requestSync` already drives. That exchange reconciles rows two peers
   * DISAGREE about; it cannot invent a member neither side has ever heard of.
   * Hence "bootstrap": the gate closes after a few attempts (see
   * `spaceProfileGate.ts`) rather than running as a cadence, because past the
   * bootstrap the digest sync is the repair path.
   *
   * The `spaceTag` is deliberately NOT carried here. Reconstructing it would
   * mean trusting `config.lastBroadcastSpaceTag`, which only the tag-rotation
   * path maintains, and broadcasting a stale tag is worse than omitting one —
   * the receiver treats an absent `spaceTag` as "no change", and a member delta
   * carries the real tag once a digest disagreement surfaces.
   *
   * Fire-and-forget: per-space failures are logged and never block anything.
   */
  async announceProfileToAllSpacesOnConnect(selfAddress: string): Promise<void> {
    // The announce reads our own override slot straight off the roster row and
    // re-sends it. If it runs before the legacy-override clear has landed, it
    // re-announces the stale value with a FRESH timestamp and repoisons the row
    // — the exact mechanism that made these names permanent. Both triggers (the
    // startup timer and setResubscribe) funnel through here, so this is the one
    // place the gate has to live. Resolves immediately once the clear has run or
    // been skipped; released even when the clear fails.
    await legacySpaceOverrideClearDone;

    let spaces: Space[];
    let config: Awaited<ReturnType<typeof this.messageDB.getUserConfig>>;
    try {
      config = await this.messageDB.getUserConfig({ address: selfAddress });
      if (!config) return;
      spaces = await this.messageDB.getSpaces();
    } catch (err) {
      logger.warn('[SpaceProfile] on-connect announce could not read state', {
        err,
      });
      return;
    }

    // `spaceIds` is the joined set. A Space row can outlive membership (an
    // invite preview, a space we left), and announcing into one we are not in
    // would be rejected by the receiver's authorization check anyway.
    const joinedIds = config.spaceIds;
    const joined = Array.isArray(joinedIds)
      ? spaces.filter((s) => joinedIds.includes(s.spaceId))
      : spaces;

    for (const space of joined) {
      try {
        const payload = await this.buildSpaceProfilePayload(
          space.spaceId,
          selfAddress,
          config
        );

        // Nothing to advertise yet (fresh account, config not synced). An
        // all-empty announce is a wire no-op the receiver ignores, and sending
        // it would burn an attempt from the cap for nothing.
        const wire = payload as unknown as SpaceProfileWireFields;
        if (!hasAnnounceableIdentity(wire)) continue;

        const signature = spaceProfileSignature(wire);
        if (
          !shouldAnnounceSpaceProfile(selfAddress, space.spaceId, signature)
        ) {
          continue;
        }

        // Claim BEFORE the await, release in `finally` — the startup timer and
        // a reconnect timer overlap by design, and the record is only written
        // once the send resolves. See spaceProfileGate.
        claimSpaceProfileAnnounce(selfAddress, space.spaceId, signature);
        try {
          const message = await this.signSpaceProfileMessage(
            space.spaceId,
            space.defaultChannelId,
            selfAddress,
            payload
          );
          await this.encryptAndSendToSpace(space.spaceId, message);
          recordSpaceProfileAnnounce(selfAddress, space.spaceId, signature);
        } finally {
          releaseSpaceProfileAnnounce(selfAddress, space.spaceId, signature);
        }
      } catch (err) {
        // Separate the EXPECTED case from a real fault, mirroring the DM
        // sibling. A space we hold no key material for is a normal transient
        // state (mid-join, a space row that arrived before its keys), not
        // something to investigate — and letting it share the `warn` channel
        // with genuine failures is how the genuine ones get ignored.
        const detail = (err as Error)?.message ?? '';
        if (detail.startsWith('No signing key for space')) {
          logger.debug('[SpaceProfile] no signing key for space yet — skipping', {
            spaceId: space.spaceId,
          });
          continue;
        }
        logger.error('[SpaceProfile] announce to space failed', {
          err,
          spaceId: space.spaceId,
        });
      }
    }
  }

  /**
   * How long to wait after a peer's `sync-info` before checking whether the
   * roster it advertised actually arrived.
   *
   * Long enough for the whole exchange — `sync-initiate`, `sync-manifest`, then
   * the delta payloads, the member half of which is sent LAST — to complete on
   * a slow link. Too short and every healthy sync would trigger a pointless
   * second request; too long and the user is reading truncated addresses in the
   * meantime.
   */
  private static readonly ROSTER_CONVERGENCE_CHECK_DELAY_MS = 20_000;

  /**
   * Arm a one-shot check that the roster pull actually converged.
   *
   * Debounced per space: several peers answer one `sync-request`, and each of
   * their `sync-info` responses lands here. The LAST one wins, which is what we
   * want — it pushes the check out until the answers have stopped arriving.
   *
   * Deliberately fire-and-forget and deliberately silent on failure. This is a
   * best-effort repair for a roster that is already incomplete; if it cannot
   * run, the user is no worse off than before it existed, and throwing out of a
   * timer would take down nothing useful.
   */
  /**
   * Drop everything the convergence check holds for a space.
   *
   * ⚠️ Call this whenever a space stops being ours. A timer armed seconds
   * before a kick would otherwise still fire, read members for a space that has
   * just been deleted, and broadcast a `sync-request` into a space we are no
   * longer a member of.
   */
  forgetRosterConvergence(spaceId: string): void {
    const timer = this.rosterConvergenceTimers.get(spaceId);
    if (timer) clearTimeout(timer);
    this.rosterConvergenceTimers.delete(spaceId);
    this.rosterConvergence.forget(spaceId);
  }

  private scheduleRosterConvergenceCheck(spaceId: string): void {
    const existing = this.rosterConvergenceTimers.get(spaceId);
    if (existing) clearTimeout(existing);

    this.rosterConvergenceTimers.set(
      spaceId,
      setTimeout(async () => {
        this.rosterConvergenceTimers.delete(spaceId);
        try {
          const members = await this.messageDB.getSpaceMembers(spaceId);
          const localCount = members?.length ?? 0;
          const decision = this.rosterConvergence.shouldReAsk(spaceId, localCount);

          if (!decision.ask) {
            // Logged on the NEGATIVE branch too. "We know you are 70 rows short
            // and we are out of attempts" is the most actionable state this
            // code can be in, and the first version of it printed nothing.
            logger.log(
              `[MessageService] roster check for ${spaceId.substring(0, 12)}: ` +
                `not asking (${decision.reason}) — have ${localCount}` +
                (decision.target !== undefined ? `, best offer ${decision.target}` : '')
            );
            return;
          }

          logger.log(
            `[MessageService] roster did not converge for ${spaceId.substring(0, 12)}: ` +
              `have ${localCount}, best peer advertised ${decision.target} ` +
              `(short by ${decision.shortfall}) — asking again`
          );
          // Charge the attempt ONLY if the request was actually built and
          // queued. The allowance is two; spending one on a request that threw
          // inside `requestSync` would silently halve it, and since `logger` is
          // a no-op in production nobody would ever see why the roster stopped
          // repairing itself.
          const sent = await this.requestSync(spaceId);
          if (sent) {
            this.rosterConvergence.noteReAsk(spaceId);
          } else {
            logger.error(
              `[MessageService] roster re-ask for ${spaceId.substring(0, 12)} was not sent; ` +
                `attempt not charged`
            );
          }
        } catch (error) {
          logger.error(
            `[MessageService] roster convergence check failed for ${spaceId.substring(0, 12)}:`,
            error
          );
        }
      }, MessageService.ROSTER_CONVERGENCE_CHECK_DELAY_MS)
    );
  }

  /**
   * Encrypts a message using Triple Ratchet and sends it to a Space channel.
   * Centralizes the encryption pattern used across multiple message types.
   *
   * @param spaceId - The Space ID to send to
   * @param message - The message to encrypt and send
   * @param options - Configuration options
   * @param options.stripEphemeralFields - Remove sendStatus/sendError before encrypting (for retries)
   * @param options.saveStateAfterSend - Save encryption state after sending instead of before (for ActionQueue)
   * @returns The outbound message string from sendHubMessage
   */
  async encryptAndSendToSpace(
    spaceId: string,
    message: Message,
    options: {
      stripEphemeralFields?: boolean;
      saveStateAfterSend?: boolean;
    } = {}
  ): Promise<string> {
    // Strip local-only fields if requested (for retries)
    const messageToSend = options.stripEphemeralFields
      ? stripNonTransmissibleFields(message)
      : message;

    const outbound = await this.sendHubMessage(
      spaceId,
      JSON.stringify({
        type: 'message',
        message: messageToSend,
      })
    );

    // Actually send the message via WebSocket
    this.enqueueOutbound(async () => {
      return [outbound];
    });

    return outbound;
  }

  /**
   * Send direct message(s) via WebSocket.
   * Used by ActionQueueHandlers for DM sending.
   * @param messages Array of pre-formatted message strings to send
   */
  sendDirectMessages(messages: string[]): Promise<void> {
    return new Promise((resolve) => {
      this.enqueueOutbound(async () => {
        resolve();
        return messages;
      });
    });
  }

  /**
   * Shared helper to encrypt and send DM messages using Double Ratchet.
   * Used by send-dm, reaction-dm, delete-dm, edit-dm handlers.
   *
   * @param address - The DM conversation address
   * @param messageContent - The message content to encrypt and send (already a plain object)
   * @param self - Sender's UserRegistration
   * @param counterparty - Recipient's UserRegistration
   * @param keyset - Sender's device and user keysets
   * @param senderDisplayName - Optional sender display name for identity revelation
   * @param senderUserIcon - Optional sender profile picture URL
   */
  async encryptAndSendDm(
    address: string,
    messageContent: Record<string, unknown>,
    selfUserAddress: string,
    keyset: {
      deviceKeyset: secureChannel.DeviceKeyset;
      userKeyset: secureChannel.UserKeyset;
    },
    senderDisplayName?: string,
    senderUserIcon?: string
  ): Promise<void> {
    const conversationId = address + '/' + address;

    // ── The DM reveal gate, CENTRALISED HERE ON PURPOSE ────────────────────
    //
    // These two optional arguments are the only way identity leaves this client
    // on a DM envelope: the crypto layer turns them into the sealed frame's
    // `user_profile`. Every caller that supplies them is emitting identity,
    // whether or not it thinks of itself that way.
    //
    // This gate used to live in each caller. That was wrong, and provably so:
    // an audit of `submitMessage` and `retryDirectMessage` looked complete and
    // MISSED THREE — the offline action-queue handlers for `reaction-dm`,
    // `delete-dm` and `edit-dm` (ActionQueueHandlers.ts), which pass the user's
    // real name and avatar straight through. Reacting to a stranger's first
    // message while offline was enough to unmask you. Per-caller enforcement
    // means the next caller leaks too; one gate on the chokepoint means new
    // callers inherit it.
    //
    // Skipped entirely when no identity was supplied, so the typing forwarder
    // and the `dm-update-profile` senders (whose identity rides the PAYLOAD,
    // already ledger-gated by their own callers) pay nothing.
    if (senderDisplayName || senderUserIcon) {
      const revealed = await this.isRevealedTo(selfUserAddress, address);
      if (!revealed) {
        senderDisplayName = undefined;
        senderUserIcon = undefined;
      }
    }

    // The read-state → encrypt → save-state sequence below is a Double
    // Ratchet critical section: two concurrent callers reading the same
    // state fork the ratchet (the losing save is silently erased and the
    // peer can no longer derive keys for the erased branch → aead::Error
    // on every subsequent frame). Serialize per conversation. Delivery is
    // awaited OUTSIDE the lock: the sendDirectMessages promise only resolves
    // when the outbound queue hands the frames to an OPEN socket, and the
    // outbound queue also runs submitMessage callbacks that take this same
    // lock — holding the lock until delivery is a circular wait (observed
    // live 2026-07-17: both directions stuck at "Sending…"). The promise is
    // returned WRAPPED IN AN OBJECT because an async callback returning a
    // bare promise is auto-flattened: runExclusive would then not release
    // the lock until delivery, recreating the deadlock.
    const { sent } = await dmRatchetMutex.runExclusive(conversationId, async () => {
      // Get encryption states - these contain all the inbox info we need for established sessions
      const response = await this.messageDB.getEncryptionStates({
        conversationId,
      });
      const sets = orderSessionsForSend(response);

      // For established sessions, we only need selfUserAddress (SDK only uses user_address field)
      const minimalSelf = { user_address: selfUserAddress } as secureChannel.UserRegistration;

      let sessions: secureChannel.SealedMessageAndMetadata[] = [];

      // Get target inboxes from existing encryption states (excluding our own device)
      const targetInboxes = sets
        .map((s) => s.tag as string)
        .filter((tag) => tag !== keyset.deviceKeyset.inbox_keyset.inbox_address);

      // Validate we have recipients to send to
      if (targetInboxes.length === 0) {
        throw new Error('No established sessions available. Please connect to the internet to initialize the conversation.');
      }

      // Encrypt for each inbox using existing encryption states (Double Ratchet)
      for (const inbox of targetInboxes) {
        const set = sets.find((s) => s.tag === inbox);
        if (!set) {
          continue; // Skip - no encryption state for this inbox
        }

        if (set.sending_inbox.inbox_public_key === '') {
          const newSessions = secureChannel.DoubleRatchetInboxEncryptForceSenderInit(
            keyset.deviceKeyset,
            [set],
            JSON.stringify(messageContent),
            minimalSelf,
            senderDisplayName,
            senderUserIcon
          );
          sessions = [...sessions, ...newSessions];
        } else {
          const newSessions = secureChannel.DoubleRatchetInboxEncrypt(
            keyset.deviceKeyset,
            [set],
            JSON.stringify(messageContent),
            minimalSelf,
            senderDisplayName,
            senderUserIcon
          );
          sessions = [...sessions, ...newSessions];
        }
      }

      // Save encryption states and collect messages to send
      const outboundMessages: string[] = [];

      for (const session of sessions) {
        if (!session.receiving_inbox) {
          continue;
        }

        const newEncryptionState = {
          state: JSON.stringify({
            ratchet_state: session.ratchet_state,
            receiving_inbox: session.receiving_inbox,
            tag: session.tag,
            sending_inbox: session.sending_inbox,
          } as secureChannel.DoubleRatchetStateAndInboxKeys),
          timestamp: Date.now(),
          inboxId: session.receiving_inbox.inbox_address,
          conversationId: address + '/' + address,
          sentAccept: session.sent_accept,
        };
        await this.messageDB.saveEncryptionState(newEncryptionState, true);

        // Collect messages to send: listen subscription + direct message
        outboundMessages.push(
          JSON.stringify({
            type: 'listen',
            inbox_addresses: [session.receiving_inbox.inbox_address],
          })
        );
        outboundMessages.push(
          JSON.stringify({ type: 'direct', ...session.sealed_message })
        );
      }

      // sendDirectMessages enqueues synchronously (its Promise executor runs
      // before it returns), so calling it here keeps frames in ratchet order
      // while the object wrapper lets the lock release before delivery.
      return { sent: this.sendDirectMessages(outboundMessages) };
    });
    await sent;
  }

  /**
   * Receive-side authorization for a SPACE control message (remove/edit/pin/
   * mute). Derives the sender from the VERIFIED signing key (reverse lookup,
   * fail closed) — never the spoofable payload senderId — and returns the
   * shared allow/drop verdict. Must be applied identically in both the DB
   * (saveMessage) and cache (addMessage) handlers so they can't disagree.
   * The signature is verified HERE (see verifySpaceSender) rather than assumed
   * from the receive-path gate, so unsigned/invalid control messages resolve to
   * a null sender and are dropped (except the unsigned-edit-of-unsigned case).
   */
  /**
   * Ed448 verifier in the shape shared's verifyDeviceKeyStatement expects,
   * backed by the WASM channel primitive (base64 in, 'true'/'false' out).
   */
  private readonly signingProvider = {
    verifyEd448: async (publicKey: string, message: string, signature: string) =>
      ch.js_verify_ed448(publicKey, message, signature) === 'true',
  };

  /**
   * Verify a space message's ed448 signature AND resolve its signer, against
   * both the join-bound member table and the per-device signing keys admitted
   * via master-signed statements. Every control/read-only/update-profile/
   * @everyone auth path funnels through here.
   *
   * Replaces the previous raw-publicKey resolver. That form took a key and
   * returned an identity without checking anything, which was only safe while a
   * distant gate in the receive path happened to have verified this message's
   * type — a precondition carried by a comment, invisible to the type system,
   * and silently absent for any type not on that gate's list. Verification is
   * local now, so a new message type cannot inherit a false guarantee.
   *
   * `result.sender` is non-null only when `result.signatureValid`; callers that
   * need proof of authorship must not read one without the other.
   */
  private async verifySpaceSender(
    message: Message,
    messageDB: MessageDB,
    // SCOPE — the space/channel the action will actually APPLY in. Control-type
    // fingerprints bind these, so verifying against the scope the message
    // CLAIMS is self-defeating: the attacker picks the claim and the signature
    // together, so they always agree, and the signature ends up attesting one
    // place while the delete/pin/mute lands in another. Matches mobile
    // (services/space/spaceMessageAuth.ts). Inert for non-control types, whose
    // fingerprints carry no scope at all.
    //
    // HONEST LIMIT, worth knowing before relying on this: only the SPACE half
    // is independently sourced. `spaceId` comes from the delivering session
    // (`conversationId.split('/')[0]`), which an attacker cannot choose without
    // actually being in that space. `channelId` has no such independent source
    // — a space is one group-encryption scope and the channel is a plaintext
    // label inside it, so the context channel IS the wire channel. It is safe
    // today only because the same variable also drives every target lookup
    // (`getMessage({spaceId, channelId, messageId})`), so verification and
    // effect cannot be pointed at different channels. If channels ever gain
    // their own keys or an independent source, re-check this.
    scopeSpaceId: string,
    scopeChannelId: string,
    members?: SpaceMemberRow[]
  ): Promise<VerifiedSenderResult> {
    const [resolvedMembers, deviceKeys] = await Promise.all([
      members ?? messageDB.getSpaceMembers(scopeSpaceId),
      messageDB.getSpaceMemberDevices(scopeSpaceId),
    ]);
    type Params = Parameters<typeof verifyAndResolveSender>[0];
    return verifyAndResolveSender({
      message,
      scopeSpaceId,
      scopeChannelId,
      members: resolvedMembers as unknown as Params['members'],
      deviceKeys: deviceKeys as unknown as Params['deviceKeys'],
      provider: this.signingProvider,
    });
  }

  /**
   * Receive an announce-keys / revoke-device statement (new hub control types).
   * Verifies it via shared (master-signed, self-certifying identity, 30s skew,
   * last-write-wins) and persists the admission or a revocation tombstone.
   * Fails closed silently. NEVER touches the join-bound member row — admissions
   * live in their own store (the #243 poisoning lesson). Unknown types are
   * ignored by the caller, so old clients are unaffected.
   */
  private async processDeviceKeyStatement(
    statement: DeviceKeyStatement,
    contextSpaceId: string
  ): Promise<void> {
    // The signature binds spaceId; only honor a statement meant for the space
    // whose hub delivered it (defense in depth over the hub-key scoping).
    if (statement.spaceId !== contextSpaceId) return;

    const existing = await this.messageDB.getSpaceMemberDevice(
      statement.spaceId,
      statement.deviceInboxAddress
    );
    const verdict = await verifyDeviceKeyStatement(
      this.signingProvider,
      statement,
      existing
        ? { timestamp: existing.timestamp, revoked: !!existing.revoked }
        : undefined
    );

    if (verdict.action === 'admit') {
      await this.messageDB.saveSpaceMemberDevice(verdict.device);
    } else if (verdict.action === 'revoke') {
      // Tombstone: keep the row marked revoked so a later STALE announce is
      // rejected by LWW; a strictly-newer announce (re-added device) re-admits.
      await this.messageDB.saveSpaceMemberDevice({
        spaceId: verdict.spaceId,
        userAddress: verdict.userAddress,
        deviceInboxAddress: verdict.deviceInboxAddress,
        inboxAddress: existing?.inboxAddress ?? '',
        spaceKeyPublicKey: existing?.spaceKeyPublicKey ?? '',
        timestamp: verdict.timestamp,
        revoked: true,
      });
    }
    // reject → drop
  }

  /**
   * Whether a message's signing-key address is admitted for the claimed sender
   * via a non-revoked per-device statement — the second lookup path the
   * inbox-binding signature gate must honour (alongside the member's join
   * binding), or a valid second-device signature gets stripped before the
   * verified-signer resolver ever runs.
   */
  private async isAdmittedDeviceKey(
    spaceId: string,
    senderId: string,
    signingInboxAddress: string
  ): Promise<boolean> {
    const devices = await this.messageDB.getSpaceMemberDevices(spaceId);
    return devices.some(
      (d) =>
        !d.revoked &&
        d.inboxAddress === signingInboxAddress &&
        d.userAddress === senderId
    );
  }

  private async isSpaceControlAuthorized(
    decryptedContent: Message,
    messageDB: MessageDB,
    spaceId: string,
    channelId: string,
    targetMessage?: Message
  ): Promise<boolean> {
    const space = await messageDB.getSpace(spaceId);
    const channel = space?.groups
      ?.find((g) => g.channels.find((c) => c.channelId === channelId))
      ?.channels.find((c) => c.channelId === channelId);
    const members = await messageDB.getSpaceMembers(spaceId);
    const { sender: verifiedSender } = await this.verifySpaceSender(
      decryptedContent,
      messageDB,
      spaceId,
      channelId,
      members
    );
    return authorizeControlMessage({
      content: decryptedContent.content as ControlMessageContent,
      // `?? null` is the union collapsing, not a shortcut: an unverified result
      // carries NO sender field at all, and both that and a verified-but-
      // unresolvable key mean the same thing downstream — nobody proven.
      verifiedSender: verifiedSender ?? null,
      space: space ?? undefined,
      channel,
      targetMessage,
    }).allowed;
  }

  /** Locate a channel by id within a space's groups. */
  private findChannelInSpace(
    space: Space,
    channelId: string
  ): Channel | undefined {
    return space.groups
      ?.find((g) => g.channels.find((c) => c.channelId === channelId))
      ?.channels.find((c) => c.channelId === channelId);
  }

  /**
   * The key to SIGN space messages with. The per-space `inbox` key plays two
   * roles with opposite lifetimes: the MAILBOX (per-device transport address,
   * regenerated on each device) and the SIGNING identity (per-user, the join
   * key that receivers bound in their member table). A synced second device has
   * a fresh `inbox` key no receiver has seen, so signing with it fails the
   * verified-signer reverse-lookup and the message is dropped. The `signing`
   * slot holds the join key across devices; fall back to `inbox` for the join
   * device and pre-migration state (where the two keys are identical).
   */
  private async getSigningKey(spaceId: string) {
    return (
      (await this.messageDB.getSpaceKey(spaceId, 'signing')) ??
      (await this.messageDB.getSpaceKey(spaceId, 'inbox'))
    );
  }

  /**
   * Master-sign a device-key statement. The signature covers ONLY
   * buildDeviceKeyStatementBytes (shared, byte-identical across platforms — the
   * hard gate), NOT the JSON envelope, so desktop and mobile verify each other's
   * statements. Domain-prefixed bytes can never collide with config-upload or
   * registration signatures made by the same master key.
   */
  private signDeviceKeyStatement(
    statement: DeviceKeyStatement,
    keyset: { userKeyset: secureChannel.UserKeyset }
  ): string {
    const bytes = buildDeviceKeyStatementBytes(statement);
    const sig = ch.js_sign_ed448(
      Buffer.from(
        new Uint8Array(keyset.userKeyset.user_key.private_key)
      ).toString('base64'),
      Buffer.from(bytes, 'utf-8').toString('base64')
    );
    return Buffer.from(JSON.parse(sig), 'base64').toString('hex');
  }

  /**
   * Broadcast this device's per-space signing-key admission (announce-keys),
   * master-signed so receivers admit the key it ACTUALLY signs with. We announce
   * getSigningKey() (= `signing ?? inbox`): the join device announces the join
   * key; a fresh second device (no shared `signing` slot — see the Option A flip
   * in ConfigService) announces its own per-device `inbox` key. Idempotent and
   * cheap — sent on space connect; receivers that missed it self-heal on the next
   * connect. Behaviour-neutral until the send-side flip is live on both platforms
   * (see the per-device-signing task's staged release order). Fire-and-forget.
   */
  async announceDeviceKeys(
    spaceId: string,
    keyset: {
      userKeyset: secureChannel.UserKeyset;
      deviceKeyset: secureChannel.DeviceKeyset;
    }
  ): Promise<void> {
    try {
      const signingKey = await this.getSigningKey(spaceId);
      if (!signingKey?.publicKey) return;

      const userPublicKey = Buffer.from(
        new Uint8Array(keyset.userKeyset.user_key.public_key)
      ).toString('hex');
      const deviceInboxAddress =
        keyset.deviceKeyset?.inbox_keyset?.inbox_address;
      if (!deviceInboxAddress) return;

      const statement: AnnounceKeysStatement = {
        type: 'announce-keys',
        userAddress: deriveInboxAddress(userPublicKey),
        userPublicKey,
        spaceId,
        deviceInboxAddress,
        spaceKeyPublicKey: signingKey.publicKey,
        timestamp: Date.now(),
        signature: '',
      };
      statement.signature = this.signDeviceKeyStatement(statement, keyset);

      // Serialize eagerly so the enqueued closure captures the finished string,
      // not the live (mutable) statement object.
      const envelope = JSON.stringify({ type: 'control', message: statement });
      this.enqueueOutbound(async () => [
        await this.sendHubMessage(spaceId, envelope),
      ]);
    } catch (err) {
      logger.warn('[DeviceKeys] announceDeviceKeys failed', { err, spaceId });
    }
  }

  /**
   * Broadcast a master-signed revoke-device tombstone for each removed device
   * across every space the user is in (triggered by the Security-modal device
   * removal). LWW-tombstoned by receivers; a re-added device gets fresh DM keys →
   * new tag, so a same-tag re-admit needs a newer-ts announce only the master key
   * can mint. Offline desktop receivers catch up on the announcing device's next
   * re-announce (P2P has no control-message replay — converges on the hub-log
   * migration). Fire-and-forget per statement; per-space failures are logged.
   */
  async broadcastDeviceRevocations(
    deviceInboxAddresses: string[],
    keyset: {
      userKeyset: secureChannel.UserKeyset;
      deviceKeyset: secureChannel.DeviceKeyset;
    }
  ): Promise<void> {
    if (deviceInboxAddresses.length === 0) return;

    const userPublicKey = Buffer.from(
      new Uint8Array(keyset.userKeyset.user_key.public_key)
    ).toString('hex');
    const userAddress = deriveInboxAddress(userPublicKey);
    const spaces = await this.messageDB.getSpaces();

    for (const space of spaces) {
      for (const deviceInboxAddress of deviceInboxAddresses) {
        try {
          const statement: RevokeDeviceStatement = {
            type: 'revoke-device',
            userAddress,
            userPublicKey,
            spaceId: space.spaceId,
            deviceInboxAddress,
            timestamp: Date.now(),
            signature: '',
          };
          statement.signature = this.signDeviceKeyStatement(statement, keyset);

          const envelope = JSON.stringify({ type: 'control', message: statement });
          this.enqueueOutbound(async () => [
            await this.sendHubMessage(space.spaceId, envelope),
          ]);
        } catch (err) {
          logger.warn('[DeviceKeys] revoke broadcast failed', {
            err,
            spaceId: space.spaceId,
          });
        }
      }
    }
  }

  /**
   * Authorize an update-profile against the VERIFIED signer, never the
   * spoofable payload senderId. A signing key already registered to a member
   * may only update THAT member's profile; a key matching no member is accepted
   * as a rotation/bootstrap announcement. Drops unsigned/invalid messages.
   *
   * Weaker than control-message auth by design (an unregistered key is accepted
   * so a member whose join row never arrived can still surface a display name),
   * but it closes the escalation: without it, a forged senderId + attacker key
   * repoints a victim's inbox_address and poisons the resolveVerifiedSender
   * reverse-lookup that control-message auth relies on.
   */
  private async isUpdateProfileAuthorized(
    decryptedContent: Message,
    messageDB: MessageDB,
    spaceId: string,
    channelId: string
  ): Promise<boolean> {
    const members = await messageDB.getSpaceMembers(spaceId);
    const { signatureValid, sender } = await this.verifySpaceSender(
      decryptedContent,
      messageDB,
      spaceId,
      channelId,
      members
    );
    // An unchecked signature proves nothing, so it must not buy the bootstrap
    // exemption below. This path used to resolve the key WITHOUT verifying:
    // `update-profile` is not a control type, so in a repudiable space the
    // receive-path gate never ran and a forged signature over a real member's
    // (public) key resolved to that member.
    if (!signatureValid) return false;
    // A key already registered to a member may speak only for THAT member. A
    // key registered to nobody is accepted as a rotation/bootstrap announcement
    // so a member whose join broadcast never arrived can still surface a
    // display name — the residual accepted in #243, bounded because the handler
    // never writes the announced key onto the row.
    return sender === null || sender === decryptedContent.content.senderId;
  }

  /**
   * Authorize a read-only-channel post/embed/sticker against the VERIFIED ed448
   * signer (a channel manager), never the spoofable payload senderId. An
   * unsigned/unverifiable post is dropped even in a repudiable space.
   *
   * Self-contained (re-derives the fingerprint and verifies the signature here),
   * so it holds on any receive path and for any content type. Used by both the
   * live (addMessage) and durable (saveMessage) paths.
   */
  private async isReadOnlyPostAuthorized(
    decryptedContent: Message,
    space: Space,
    channel: Channel,
    members: SpaceMemberRow[]
  ): Promise<boolean> {
    const { sender } = await this.verifySpaceSender(
      decryptedContent,
      this.messageDB,
      space.spaceId,
      channel.channelId,
      members
    );
    return (
      !!sender && canManageReadOnlyChannel(sender, false, space, channel)
    );
  }

  /**
   * Saves message to DB and updates query cache.
   * @param currentUserAddress - Pass current user's address when sending messages to update lastReadTimestamp
   */
  /**
   * @param authenticatedSenderId Who the CRYPTO LAYER says sent this, stamped
   *   onto the stored row as `Message.authenticatedSenderId`. REQUIRED, and
   *   deliberately not optional: every call site must answer, because a site
   *   that silently omitted it would store a row with no provenance and the
   *   reveal ledger would read that as "not authored by me" forever.
   *
   *   - DM receive → the session's authenticated address, captured BEFORE the
   *     self-echo reassignment overwrites it.
   *   - DM send    → our own address. We are provably the author.
   *   - Space      → `null`. Space membership is a different trust model and
   *     nothing reads this field there; `null` is the explicit "not applicable"
   *     answer rather than an accidental omission.
   */
  async saveMessage(
    decryptedContent: Message,
    messageDB: MessageDB,
    spaceId: string,
    channelId: string,
    conversationType: string,
    updatedUserProfile: { user_icon?: string; display_name?: string },
    authenticatedSenderId: string | null,
    // Deliberately required-but-nullable rather than optional. `authenticatedSenderId`
    // sits immediately before it and is also string-ish, so leaving this optional
    // meant an existing 7-argument call kept compiling with its `currentUserAddress`
    // silently rebound to the new parameter — a security field taking whatever
    // value happened to be in that position, with no type error anywhere.
    currentUserAddress: string | undefined
  ) {
    if (decryptedContent.content.type === 'reaction') {
      const reaction = decryptedContent.content as ReactionMessage;
      const target = await messageDB.getMessage({
        spaceId: spaceId,
        channelId: channelId,
        messageId: decryptedContent.content.messageId,
      });
      if (target) {
        const existing = target.reactions?.find(
          (r) => r.emojiId === reaction.reaction
        );
        const modifiedSet = [
          ...(existing?.memberIds ?? []).filter((e) => e !== reaction.senderId),
          reaction.senderId,
        ];
        await messageDB.saveMessage(
          {
            ...target,
            reactions: existing
              ? (target.reactions ?? []).map((r) =>
                  r.emojiId === reaction.reaction
                    ? {
                        ...r,
                        count: modifiedSet.length,
                        memberIds: modifiedSet,
                      }
                    : r
                )
              : [
                  ...(target.reactions ?? []),
                  {
                    emojiId: reaction.reaction,
                    emojiName: reaction.reaction,
                    spaceId: spaceId != channelId ? spaceId : '',
                    count: modifiedSet.length,
                    memberIds: modifiedSet,
                  },
                ],
          },
          0,
          spaceId,
          conversationType,
          updatedUserProfile.user_icon!,
          updatedUserProfile.display_name!,
          currentUserAddress
        );
      } else {
        return;
      }
    } else if (decryptedContent.content.type === 'remove-reaction') {
      const reaction = decryptedContent.content as RemoveReactionMessage;
      const target = await messageDB.getMessage({
        spaceId: spaceId,
        channelId: channelId,
        messageId: decryptedContent.content.messageId,
      });
      if (target) {
        const existing = target.reactions?.find(
          (r) => r.emojiId === reaction.reaction
        );
        if (existing) {
          const modifiedSet = [
            ...(existing?.memberIds ?? []).filter(
              (e) => e !== reaction.senderId
            ),
          ];
          const reactions = modifiedSet.length === 0
            ? (target.reactions ?? []).filter((r) => r.emojiId !== reaction.reaction)
            : (target.reactions ?? []).map((r) =>
                r.emojiId === reaction.reaction
                  ? {
                      ...r,
                      count: modifiedSet.length,
                      memberIds: modifiedSet,
                    }
                  : r
              );
          await messageDB.saveMessage(
            {
              ...target,
              reactions: reactions,
            },
            0,
            spaceId,
            conversationType,
            updatedUserProfile.user_icon!,
            updatedUserProfile.display_name!,
            currentUserAddress
          );
        }
      } else {
        return;
      }
    } else if (decryptedContent.content.type === 'remove-message') {
      const targetMessage = await messageDB.getMessage({
        spaceId,
        channelId,
        messageId: decryptedContent.content.removeMessageId,
      });
      if (!targetMessage) {
        return;
      }

      // For DMs: Both users store messages with their partner's address as spaceId/channelId
      // So we can't do a direct comparison. Instead, check if both are DMs (spaceId == channelId)
      const isTargetDM = targetMessage.spaceId === targetMessage.channelId;
      const isRequestDM =
        decryptedContent.spaceId === decryptedContent.channelId;

      if (isTargetDM && isRequestDM) {
        // Both are DMs - this is valid even if IDs don't match exactly
        // The IDs represent conversation partners' addresses
      } else if (
        targetMessage.channelId !== decryptedContent.channelId ||
        targetMessage.spaceId !== decryptedContent.spaceId
      ) {
        // For Spaces: IDs must match exactly
        return;
      }

      // Helper: soft-delete if message has a thread, hard-delete otherwise
      const deleteOrSoftDelete = async (msgId: string) => {
        if (targetMessage.threadMeta) {
          // Soft-delete: preserve threadMeta so thread remains accessible
          const softDeleted: Message = {
            ...targetMessage,
            content: {
              type: 'post',
              senderId: targetMessage.content.senderId,
              text: '',
            } as PostMessage,
            threadMeta: targetMessage.threadMeta,
          };
          await messageDB.saveMessage(
            softDeleted, 0, spaceId, conversationType,
            updatedUserProfile.user_icon!, updatedUserProfile.display_name!,
            currentUserAddress
          );
        } else {
          await messageDB.deleteMessage(msgId);
        }
      };

      // DM authorization (spaceId == channelId).
      //
      // SECURITY: `decryptedContent.content.senderId` is plaintext the sender's
      // client writes — it is NOT proven by the Double Ratchet. A peer running a
      // modified client could set it to YOUR address to delete a message you
      // authored. So we authorize against the session-authenticated sender
      // instead: for a DM, `spaceId` (== channelId) IS the cryptographically
      // proven conversation owner (the address whose session decrypted this
      // message). A DM is two-party, so the only legitimate deleter of the target
      // is its author, and the author can only be the proven conversation owner.
      // We require BOTH: the payload claim matches the proven owner AND the target
      // was authored by that proven owner. A spoofed "senderId = you" fails the
      // second clause (your message's author != the peer).
      //
      // Self-sync note: when your OWN delete reaches your OTHER device, `spaceId`
      // is the partner but the target's author is you — so this check does not
      // auto-apply your own cross-device deletes (they reconcile on next load).
      // This is the accepted trade-off of the "safe version": we block the spoof
      // fully and tolerate a cosmetic self-sync lag, because desktop's JS SDK does
      // not expose the per-message authenticated sender that would let us tell a
      // genuine self-echo from a peer spoofing your address. See
      // 2026-06-25-MASTER-RECAP-control-message-auth.md under .agents/issues/.
      const isDM = spaceId === channelId;
      if (isDM) {
        const authorized =
          decryptedContent.content.senderId === spaceId &&
          targetMessage.content.senderId === spaceId;
        if (authorized) {
          await deleteOrSoftDelete(decryptedContent.content.removeMessageId);
          // Don't return early - allow addMessage() to update React Query cache
        }
        // Unauthorized DM delete: drop silently (do not honor).
      } else {
        // Space: authorize against the VERIFIED signing key (own-message,
        // read-only manager, or message:delete role — all resolved from the
        // signature, not the spoofable payload senderId).
        if (
          await this.isSpaceControlAuthorized(
            decryptedContent,
            messageDB,
            spaceId,
            channelId,
            targetMessage
          )
        ) {
          await deleteOrSoftDelete(decryptedContent.content.removeMessageId);
          // Don't return early - allow addMessage() to update React Query cache
        }
      }
    } else if (decryptedContent.content.type === 'edit-message') {
      const editMessage = decryptedContent.content as EditMessage;
      const targetMessage = await messageDB.getMessage({
        spaceId,
        channelId,
        messageId: editMessage.originalMessageId,
      });

      if (!targetMessage) {
        return;
      }

      // Only the original author can edit their message.
      //
      // SECURITY: `editMessage.senderId` is spoofable plaintext. For a DM,
      // authorize against the session-authenticated sender (`spaceId` == the
      // proven conversation owner). For a space, authorize against the VERIFIED
      // signing key (or, in a repudiable space, accept an unsigned edit only of
      // an unsigned own message — the inherit rule).
      const isDM = spaceId === channelId;
      if (isDM) {
        if (
          editMessage.senderId !== spaceId ||
          targetMessage.content.senderId !== spaceId
        ) {
          return;
        }
      } else if (
        !(await this.isSpaceControlAuthorized(
          decryptedContent,
          messageDB,
          spaceId,
          channelId,
          targetMessage
        ))
      ) {
        return;
      }

      // Only allow editing post messages
      if (targetMessage.content.type !== 'post') {
        return;
      }

      // Check edit time window
      const timeSinceCreation = Date.now() - targetMessage.createdDate;
      if (timeSinceCreation > MESSAGE_EDIT_WINDOW_MS) {
        return;
      }

      // Edit message length validation (defense-in-depth)
      // Note: editedText can be string | string[], must handle both
      const editedTextContent = editMessage.editedText;
      const editedMessageText = Array.isArray(editedTextContent)
        ? editedTextContent.join('')
        : editedTextContent;

      if (editedMessageText && editedMessageText.length > MAX_MESSAGE_LENGTH) {
        logger.log(
          `🔒 Rejecting oversized edit ${decryptedContent.messageId} ` +
            `from ${editMessage.senderId} ` +
            `(${editedMessageText.length} chars > ${MAX_MESSAGE_LENGTH} limit)`
        );
        return;
      }

      // Check if saveEditHistory is enabled for this conversation/space
      // (isDM already computed above for the authorization check)
      let saveEditHistoryEnabled: boolean;

      if (isDM) {
        // For DMs, dual-read: synced config override first, then the legacy
        // local Conversation record (migration fallback for one release).
        const conversationId = `${spaceId}/${channelId}`;
        const conversation = await messageDB.getConversation({
          conversationId,
        });
        const userConfig = currentUserAddress
          ? await messageDB.getUserConfig({ address: currentUserAddress })
          : undefined;
        saveEditHistoryEnabled =
          getConversationSetting(
            userConfig?.conversationSettings,
            conversationId,
            'saveEditHistory'
          ) ??
          conversation?.conversation?.saveEditHistory ??
          false;
      } else {
        // For spaces, check space setting
        const space = await messageDB.getSpace(spaceId);
        saveEditHistoryEnabled = space?.saveEditHistory ?? false;
      }

      // Apply the received edit via the shared helper (single source of truth
      // with the send path and mobile). It retains prior versions in edits[]
      // (seeding the original on the first edit); the replay guard makes a
      // re-delivered edit a no-op so a duplicate can't clobber stored history.
      const applied = applyEdit(
        {
          text:
            targetMessage.content.type === 'post'
              ? targetMessage.content.text
              : '',
          createdDate: targetMessage.createdDate,
          modifiedDate: targetMessage.modifiedDate,
          nonce: targetMessage.nonce,
          lastModifiedHash: targetMessage.lastModifiedHash,
          edits: targetMessage.edits,
        },
        {
          editedAt: editMessage.editedAt,
          editNonce: editMessage.editNonce,
          saveEditHistory: saveEditHistoryEnabled,
        }
      );

      // Replayed edit (already applied): make no change.
      if (!applied.changed) {
        return;
      }

      // Update the original message with edited text and mentions
      const updatedMessage: Message = {
        ...targetMessage,
        modifiedDate: applied.modifiedDate,
        lastModifiedHash: applied.lastModifiedHash,
        mentions: editMessage.mentions || targetMessage.mentions, // Update mentions if provided
        content: {
          ...targetMessage.content,
          text: editMessage.editedText,
        } as PostMessage,
        edits: applied.edits,
      };

      await messageDB.saveMessage(
        updatedMessage,
        0,
        spaceId,
        conversationType,
        updatedUserProfile.user_icon!,
        updatedUserProfile.display_name!,
        currentUserAddress
      );
    } else if (decryptedContent.content.type === 'pin') {
      const pinMessage = decryptedContent.content as PinMessage;
      const targetMessage = await messageDB.getMessage({
        spaceId,
        channelId,
        messageId: pinMessage.targetMessageId,
      });
      if (!targetMessage) {
        return;
      }

      // Reject DMs - pins are Space-only feature
      if (spaceId === channelId) {
        return; // Not supported
      }

      const senderId = pinMessage.senderId;

      // Authorize against the VERIFIED signing key (read-only manager or
      // message:pin role), not the spoofable payload senderId.
      if (
        !(await this.isSpaceControlAuthorized(
          decryptedContent,
          messageDB,
          spaceId,
          channelId,
          targetMessage
        ))
      ) {
        return;
      }

      // Pin limit validation (defense-in-depth) - only check when pinning
      if (pinMessage.action === 'pin') {
        const pinnedMessages = await messageDB.getPinnedMessages(
          spaceId,
          channelId
        );
        if (pinnedMessages.length >= 50) {
          return; // Reject - pin limit reached
        }
      }

      // Update target message with pin status
      const updatedMessage: Message = {
        ...targetMessage,
        isPinned: pinMessage.action === 'pin',
        pinnedAt: pinMessage.action === 'pin' ? Date.now() : undefined,
        pinnedBy: pinMessage.action === 'pin' ? senderId : undefined,
      };

      await messageDB.saveMessage(
        updatedMessage,
        0,
        spaceId,
        conversationType,
        updatedUserProfile.user_icon!,
        updatedUserProfile.display_name!,
        currentUserAddress
      );
    } else if (decryptedContent.content.type === 'thread') {
      const threadMsg = decryptedContent.content as ThreadMessage;
      // SECURITY: thread frames carry a second deletion primitive ('remove'
      // hard-deletes the root and every reply). Authorize on the VERIFIED
      // signer; the payload's senderId is a claim, not proof.
      const { sender: threadSender } = await this.verifySpaceSender(
        decryptedContent,
        messageDB,
        spaceId,
        channelId
      );
      await this.threadService.handleThreadReceive({
        threadMsg,
        spaceId,
        channelId,
        verifiedSender: threadSender ?? null,
        currentUserAddress: currentUserAddress ?? '',
        conversationType,
        updatedUserProfile: {
          user_icon: updatedUserProfile.user_icon!,
          display_name: updatedUserProfile.display_name!,
        },
      });
    } else if (decryptedContent.content.type === 'update-profile') {
      // SECURITY: authorize against the VERIFIED signer (reverse key→member
      // lookup), never the spoofable payload senderId. Drops unsigned/invalid;
      // a key already registered to a member may only update THAT member; an
      // unregistered key is accepted as a rotation/bootstrap announcement.
      if (
        !(await this.isUpdateProfileAuthorized(
          decryptedContent,
          messageDB,
          spaceId,
          channelId
        ))
      ) {
        return;
      }

      // UPSERT: if we don't have a member record yet (joined the space after
      // the sender sent their update, or join control was missed), create a
      // display-only row so their name/avatar still render. inbox_address stays
      // '' — the authoritative value comes from the VERIFIED join control, never
      // from this self-asserted message (writing the announced key here would
      // let a forged senderId poison the resolveVerifiedSender reverse-lookup).
      const existing = await messageDB.getSpaceMember(
        spaceId,
        decryptedContent.content.senderId
      );
      const participant: SpaceMemberRow = existing ?? {
        user_address: decryptedContent.content.senderId,
        inbox_address: '',
      };

      // Two-slot, per-slot-LWW merge (see applyProfileUpdate). Presence
      // semantics: omitted = no change, '' = deliberate clear (falls back to
      // initials for an emptied icon). inbox_address is deliberately NOT touched
      // here — see the security note above.
      applyProfileUpdate(participant, decryptedContent.content, decryptedContent.createdDate);
      // Validate inbound spaceTag — reject SVG data URIs (XSS) and oversized payloads
      const tagWrite = resolveInboundSpaceTag(decryptedContent.content.spaceTag);
      if (tagWrite.write) participant.spaceTag = tagWrite.tag;
      await messageDB.saveSpaceMember(spaceId, participant, tagWrite.options);
    } else {
      // Read-only enforcement on the durable path, mirroring the live gate so a
      // forged post can't survive on disk and resurface on refetch. Fail-OPEN on
      // missing space/channel: this path also runs during sync/replay where a
      // message can arrive before its space row, and a fail-secure drop would
      // lose a legit (signed) manager message permanently. So we drop only when
      // the channel is confirmed read-only AND the verified signer isn't a
      // manager. Thread replies are exempt to match the live path.
      const isDM = spaceId === channelId;
      if (
        !isDM &&
        !decryptedContent.isThreadReply &&
        isReadOnlyGatedType(decryptedContent.content.type)
      ) {
        const space = await messageDB.getSpace(spaceId);
        const channel = space
          ? this.findChannelInSpace(space, channelId)
          : undefined;
        if (space && channel?.isReadOnly) {
          const members = await messageDB.getSpaceMembers(spaceId);
          if (
            !(await this.isReadOnlyPostAuthorized(
              decryptedContent,
              space,
              channel,
              members
            ))
          ) {
            return; // forged/unsigned read-only post: do not persist
          }
        }
      }

      // Check tombstone before saving - prevents deleted messages from being re-added during sync
      if (await messageDB.isMessageDeleted(decryptedContent.messageId)) {
        return;
      }

      // Mark thread replies and update channel_threads registry
      await this.threadService.handleThreadReplyReceive({
        message: decryptedContent,
        spaceId,
        channelId,
        currentUserAddress: currentUserAddress ?? '',
      });

      await messageDB.saveMessage(
        {
          ...decryptedContent,
          channelId: channelId,
          spaceId: spaceId,
          // ⚠️ AFTER the spread, and it must stay that way. `decryptedContent`
          // is attacker-authored JSON: a peer can put `authenticatedSenderId`
          // in their payload, and spreading it last would let them name
          // themselves as anyone. Written here it is always overwritten by the
          // crypto layer's answer, so the wire value can never survive.
          // `undefined` (the space case) is the correct absent value — readers
          // fail closed on it.
          authenticatedSenderId: authenticatedSenderId ?? undefined,
        },
        0,
        spaceId,
        conversationType,
        updatedUserProfile.user_icon!,
        updatedUserProfile.display_name!,
        currentUserAddress
      );
    }
  }

  /**
   * Updates message send status in the query cache.
   * Used for optimistic updates when sending messages.
   * Handles race condition: if server version already replaced optimistic version,
   * the message won't have sendStatus and we skip the update.
   */
  updateMessageStatus(
    queryClient: QueryClient,
    spaceId: string,
    channelId: string,
    messageId: string,
    status: 'sent' | 'failed',
    error?: string
  ) {
    const queryKey = buildMessagesKeyPrefix({ spaceId, channelId });

    queryClient.setQueriesData(
      { queryKey },
      (oldData: InfiniteData<any>) => {
        if (!oldData?.pages) return oldData;

        return {
          pageParams: oldData.pageParams,
          pages: oldData.pages.map((page) => ({
            ...page,
            messages: page.messages.map((msg: Message) => {
              if (msg.messageId === messageId) {
                // Only update if this is still the optimistic version (has sendStatus)
                // If server version already replaced it, sendStatus will be undefined
                if (msg.sendStatus !== undefined) {
                  return status === 'sent'
                    ? { ...msg, sendStatus: undefined, sendError: undefined }
                    : { ...msg, sendStatus: status, sendError: error };
                }
                // Server version already replaced optimistic - no action needed
                return msg;
              }
              return msg;
            }),
            nextCursor: page.nextCursor,
            prevCursor: page.prevCursor,
          })),
        };
      }
    );
  }

  /**
   * Adds message to query cache (optimistic update).
   * @param skipRateLimit - If true, skips rate limiting (used for DMs where spam is less of a concern)
   */
  async addMessage(
    queryClient: QueryClient,
    spaceId: string,
    channelId: string,
    decryptedContent: Message,
    skipRateLimit = false
  ) {
    if (decryptedContent.content.type === 'reaction') {
      const reaction = decryptedContent.content as ReactionMessage;
      queryClient.setQueriesData(
        { queryKey: buildMessagesKeyPrefix({ spaceId: spaceId, channelId: channelId }) },
        (oldData: InfiniteData<any>) => {
          if (!oldData?.pages) return oldData;

          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page, _index) => {
              return {
                ...page,
                messages: [
                  ...page.messages.map((m: Message) => {
                    if (m.messageId === reaction.messageId) {
                      const existing = m.reactions?.find(
                        (r) => r.emojiId === reaction.reaction
                      );
                      const modifiedSet = [
                        ...(existing?.memberIds ?? []).filter(
                          (e) => e !== reaction.senderId
                        ),
                        reaction.senderId,
                      ];
                      return {
                        ...m,
                        reactions: existing
                          ? (m.reactions ?? []).map((r) =>
                              r.emojiId === reaction.reaction
                                ? {
                                    ...r,
                                    count: modifiedSet.length,
                                    memberIds: modifiedSet,
                                  }
                                : r
                            )
                          : [
                              ...(m.reactions ?? []),
                              {
                                emojiId: reaction.reaction,
                                emojiName: reaction.reaction,
                                spaceId: spaceId !== channelId ? spaceId : '',
                                count: modifiedSet.length,
                                memberIds: modifiedSet,
                              },
                            ],
                      };
                    }
                    return m;
                  }),
                ],
                // Preserve any cursors or other pagination metadata
                nextCursor: page.nextCursor,
                prevCursor: page.prevCursor,
              };
            }),
          };
        }
      );
    } else if (decryptedContent.content.type === 'remove-reaction') {
      const reaction = decryptedContent.content as RemoveReactionMessage;
      queryClient.setQueriesData(
        { queryKey: buildMessagesKeyPrefix({ spaceId: spaceId, channelId: channelId }) },
        (oldData: InfiniteData<any>) => {
          if (!oldData?.pages) return oldData;

          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page, _index) => {
              return {
                ...page,
                messages: [
                  ...page.messages.map((m: Message) => {
                    if (m.messageId === reaction.messageId) {
                      const existing = m.reactions?.find(
                        (r) => r.emojiId === reaction.reaction
                      );
                      if (existing) {
                        const modifiedSet = [
                          ...(existing?.memberIds ?? []).filter(
                            (e) => e !== reaction.senderId
                          ),
                        ];
                        const reactions = modifiedSet.length === 0
                          ? (m.reactions ?? []).filter((r) => r.emojiId !== reaction.reaction)
                          : (m.reactions ?? []).map((r) =>
                              r.emojiId === reaction.reaction
                                ? {
                                    ...r,
                                    count: modifiedSet.length,
                                    memberIds: modifiedSet,
                                  }
                                : r
                            );
                        return {
                          ...m,
                          reactions: reactions,
                        };
                      }
                      return m;
                    }
                    return m;
                  }),
                ],
                // Preserve any cursors or other pagination metadata
                nextCursor: page.nextCursor,
                prevCursor: page.prevCursor,
              };
            }),
          };
        }
      );
    } else if (decryptedContent.content.type === 'edit-message') {
      const editMessage = decryptedContent.content as EditMessage;
      // DM edits authorize against the session-authenticated sender (spaceId ==
      // the proven conversation owner); space edits authorize against the
      // VERIFIED signing key. Space auth is async (DB reads), so resolve it
      // BEFORE the synchronous cache updater. Mirrors the saveMessage handler.
      const isDM = spaceId === channelId;
      let spaceEditAuthorized = false;
      if (!isDM) {
        const target = await this.messageDB.getMessage({
          spaceId,
          channelId,
          messageId: editMessage.originalMessageId,
        });
        spaceEditAuthorized = target
          ? await this.isSpaceControlAuthorized(
              decryptedContent,
              this.messageDB,
              spaceId,
              channelId,
              target
            )
          : false;
      }

      queryClient.setQueriesData(
        { queryKey: buildMessagesKeyPrefix({ spaceId: spaceId, channelId: channelId }) },
        (oldData: InfiniteData<any>) => {
          if (!oldData?.pages) return oldData;

          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page) => {
              return {
                ...page,
                messages: [
                  ...page.messages.map((m: Message) => {
                    if (m.messageId === editMessage.originalMessageId) {
                      // Only update if the sender matches (permission check).
                      // DM: authorize against the proven conversation owner
                      // (spaceId), not the spoofable payload senderId.
                      if (isDM) {
                        if (
                          editMessage.senderId !== spaceId ||
                          m.content.senderId !== spaceId
                        ) {
                          return m;
                        }
                      } else if (!spaceEditAuthorized) {
                        return m;
                      }
                      // Only allow editing post messages
                      if (m.content.type !== 'post') {
                        return m;
                      }

                      // Check edit time window
                      const timeSinceCreation = Date.now() - m.createdDate;
                      if (timeSinceCreation > MESSAGE_EDIT_WINDOW_MS) {
                        return m;
                      }

                      // CRITICAL: Skip if this edit or a newer edit was already applied
                      // This prevents duplicates from: 1) queue processing, 2) hub echoes
                      if (m.modifiedDate >= editMessage.editedAt) {
                        return m;
                      }

                      // Keep existing edits array - optimistic update already handles it
                      const existingEdits = m.edits || [];

                      // Update the message with edited text and mentions, keeping existing edits array
                      return {
                        ...m,
                        modifiedDate: editMessage.editedAt,
                        lastModifiedHash: editMessage.editNonce,
                        mentions: editMessage.mentions || m.mentions, // Update mentions if provided
                        content: {
                          ...m.content,
                          text: editMessage.editedText,
                        } as PostMessage,
                        edits: existingEdits,
                      };
                    }
                    return m;
                  }),
                ],
                // Preserve any cursors or other pagination metadata
                nextCursor: page.nextCursor,
                prevCursor: page.prevCursor,
              };
            }),
          };
        }
      );
    } else if (decryptedContent.content.type === 'remove-message') {
      const targetMessage = await this.messageDB.getMessage({
        spaceId,
        channelId,
        messageId: decryptedContent.content.removeMessageId,
      });

      // Check if this delete request should be honored (every branch below
      // assigns it, so no initializer).
      let shouldHonorDelete: boolean;

      const isDM = spaceId === channelId;

      if (isDM) {
        if (!targetMessage) {
          // DM, target we don't have: harmless no-op cache removal. The real
          // attack surface (deleting a message that DOES exist) is handled below.
          shouldHonorDelete = true;
        } else {
          // DM authorization — authorize against the session-authenticated
          // sender, NOT the spoofable payload `senderId`. For a DM, `spaceId`
          // (== channelId) is the cryptographically proven conversation owner.
          // Require BOTH: the payload claim matches the proven owner AND the
          // target was authored by that proven owner. (Same check as the
          // saveMessage handler; see MASTER-RECAP-control-message-auth.md.)
          shouldHonorDelete =
            decryptedContent.content.senderId === spaceId &&
            targetMessage.content.senderId === spaceId;
        }
      } else {
        // Space: authorize against the VERIFIED signing key, including the
        // missing-target case (the helper returns ok-target-missing-noop only
        // for a verified sender — an unsigned/spoofed remove of a locally-absent
        // message no longer ghosts it out of the cache). Mirrors saveMessage.
        shouldHonorDelete = await this.isSpaceControlAuthorized(
          decryptedContent,
          this.messageDB,
          spaceId,
          channelId,
          targetMessage ?? undefined
        );
      }

      if (shouldHonorDelete) {
        const targetId = decryptedContent.content.removeMessageId;
        queryClient.setQueriesData(
          { queryKey: buildMessagesKeyPrefix({ spaceId: spaceId, channelId: channelId }) },
          (oldData: InfiniteData<any>) => {
            if (!oldData?.pages) return oldData;

            return {
              pageParams: oldData.pageParams,
              pages: oldData.pages.map((page, _index) => {
                return {
                  ...page,
                  messages: page.messages
                    .map((m: Message) => {
                      if (m.messageId !== targetId) return m;
                      // Soft-delete thread roots: preserve message with empty content
                      if (m.threadMeta) {
                        return {
                          ...m,
                          content: {
                            type: 'post',
                            senderId: m.content.senderId,
                            text: '',
                          } as PostMessage,
                        };
                      }
                      // Hard-delete non-thread messages
                      return null;
                    })
                    .filter((m: Message | null): m is Message => m !== null),
                  // Preserve any cursors or other pagination metadata
                  nextCursor: page.nextCursor,
                  prevCursor: page.prevCursor,
                };
              }),
            };
          }
        );

        // For thread replies: also update the thread-messages cache
        this.threadService.handleThreadDeletedMessageCache({
          targetMessage: targetMessage ?? undefined,
          spaceId,
          channelId,
          queryClient,
        });
      }
    } else if (decryptedContent.content.type === 'pin') {
      const pinMessage = decryptedContent.content as PinMessage;

      // Reject DMs - pins are Space-only feature
      if (spaceId === channelId) {
        return; // Not supported
      }

      const senderId = pinMessage.senderId;

      // Authorize against the VERIFIED signing key (mirrors saveMessage).
      const pinTarget = await this.messageDB.getMessage({
        spaceId,
        channelId,
        messageId: pinMessage.targetMessageId,
      });
      if (!pinTarget) {
        return;
      }
      if (
        !(await this.isSpaceControlAuthorized(
          decryptedContent,
          this.messageDB,
          spaceId,
          channelId,
          pinTarget
        ))
      ) {
        return;
      }

      // Pin limit validation - only check when pinning
      if (pinMessage.action === 'pin') {
        const pinnedMessages = await this.messageDB.getPinnedMessages(
          spaceId,
          channelId
        );
        if (pinnedMessages.length >= 50) {
          return; // Reject - pin limit reached
        }
      }

      // Update React Query cache
      queryClient.setQueriesData(
        { queryKey: buildMessagesKeyPrefix({ spaceId: spaceId, channelId: channelId }) },
        (oldData: InfiniteData<any>) => {
          if (!oldData?.pages) return oldData;

          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page) => {
              return {
                ...page,
                messages: [
                  ...page.messages.map((m: Message) => {
                    if (m.messageId === pinMessage.targetMessageId) {
                      return {
                        ...m,
                        isPinned: pinMessage.action === 'pin',
                        pinnedAt:
                          pinMessage.action === 'pin' ? Date.now() : undefined,
                        pinnedBy:
                          pinMessage.action === 'pin' ? senderId : undefined,
                      };
                    }
                    return m;
                  }),
                ],
                // Preserve any cursors or other pagination metadata
                nextCursor: page.nextCursor,
                prevCursor: page.prevCursor,
              };
            }),
          };
        }
      );

      // Invalidate BOTH query caches
      queryClient.invalidateQueries({
        queryKey: ['pinnedMessages', spaceId, channelId],
      });
      queryClient.invalidateQueries({
        queryKey: ['pinnedMessageCount', spaceId, channelId],
      });
    } else if (decryptedContent.content.type === 'thread') {
      const threadMsg = decryptedContent.content as ThreadMessage;
      // Same verdict inputs as the DB path above, or the cache and the store
      // disagree about whether a thread action happened.
      const { sender: threadSender } = await this.verifySpaceSender(
        decryptedContent,
        this.messageDB,
        spaceId,
        channelId
      );
      await this.threadService.handleThreadCache({
        threadMsg,
        spaceId,
        channelId,
        verifiedSender: threadSender ?? null,
        queryClient,
      });
    } else if (decryptedContent.content.type === 'update-profile') {
      // SECURITY: authorize against the VERIFIED signer (reverse key→member
      // lookup), never the spoofable payload senderId. Drops unsigned/invalid;
      // a key already registered to a member may only update THAT member; an
      // unregistered key is accepted as a rotation/bootstrap announcement.
      if (
        !(await this.isUpdateProfileAuthorized(
          decryptedContent,
          this.messageDB,
          spaceId,
          channelId
        ))
      ) {
        return;
      }

      // UPSERT: if we don't have a member record yet (joined the space after
      // the sender sent their update, or join control was missed), create a
      // display-only row so their name/avatar still render. inbox_address stays
      // '' — the authoritative value comes from the VERIFIED join control, never
      // from this self-asserted message (writing the announced key here would
      // let a forged senderId poison the resolveVerifiedSender reverse-lookup).
      const existing = await this.messageDB.getSpaceMember(
        spaceId,
        decryptedContent.content.senderId
      );
      const participant: SpaceMemberRow = existing ?? {
        user_address: decryptedContent.content.senderId,
        inbox_address: '',
      };

      // Two-slot, per-slot-LWW merge (see applyProfileUpdate). Presence
      // semantics: omitted = no change, '' = deliberate clear. inbox_address is
      // deliberately NOT touched here — see the security note above.
      applyProfileUpdate(participant, decryptedContent.content, decryptedContent.createdDate);
      // Validate inbound spaceTag — reject SVG data URIs (XSS) and oversized
      // payloads. Absent means no change, `null` is the deletion tombstone;
      // see resolveInboundSpaceTag.
      const tagWrite = resolveInboundSpaceTag(decryptedContent.content.spaceTag);
      if (tagWrite.write) participant.spaceTag = tagWrite.tag;
      await this.messageDB.saveSpaceMember(spaceId, participant, tagWrite.options);
      await queryClient.setQueryData(
        buildSpaceMembersKey({ spaceId }),
        (oldData: secureChannel.UserProfile[]) => {
          return [
            ...(oldData ?? []).filter(
              (p) => p.user_address !== participant.user_address
            ),
            participant,
          ];
        }
      );
    } else if (decryptedContent.content.type === 'mute') {
      // Handle mute/unmute message - receive-side validation
      const muteContent = decryptedContent.content as MuteMessage;

      // Reject DMs - mute is Space-only feature
      if (spaceId === channelId) {
        return;
      }

      // Self-mute check (only for mute action)
      if (muteContent.action === 'mute' && muteContent.targetUserId === muteContent.senderId) {
        return;
      }

      // Authorize against the VERIFIED signing key (user:mute role), not the
      // spoofable payload senderId. authorizeControlMessage handles 'mute'
      // without a target message.
      if (
        !(await this.isSpaceControlAuthorized(
          decryptedContent,
          this.messageDB,
          spaceId,
          channelId
        ))
      ) {
        return;
      }

      if (muteContent.action === 'mute') {
        // Deduplication check
        const existingMute = await this.messageDB.getMuteByMuteId(muteContent.muteId);
        if (existingMute) {
          return;
        }

        // Calculate expiresAt from duration (if provided)
        const expiresAt = muteContent.duration
          ? muteContent.timestamp + muteContent.duration
          : undefined;

        // Apply mute
        await this.messageDB.muteUser(
          spaceId,
          muteContent.targetUserId,
          muteContent.senderId,
          muteContent.muteId,
          muteContent.timestamp,
          expiresAt
        );
      } else {
        // Apply unmute
        await this.messageDB.unmuteUser(spaceId, muteContent.targetUserId);
      }

      // Invalidate muted users cache
      queryClient.invalidateQueries({
        queryKey: ['mutedUsers', spaceId],
      });
    } else {
      // Thread replies go to thread cache, not main feed
      if (decryptedContent.isThreadReply) {
        this.threadService.handleThreadReplyCache({
          message: decryptedContent,
          spaceId,
          channelId,
          queryClient,
        });
        return;
      }

      // Read-only channel validation - must validate BEFORE adding to cache
      // Note: edit-message is handled earlier in the if-else chain (line ~310)
      const isDM = spaceId === channelId;
      const isPostMessage = decryptedContent.content.type === 'post';

      // Read-only enforcement covers all visible content (post/embed/sticker),
      // not just text. Live path fail-secures on missing space/channel (the
      // durable path fail-opens instead).
      if (!isDM && isReadOnlyGatedType(decryptedContent.content.type)) {
        const space = await this.messageDB.getSpace(spaceId);

        // FAIL-SECURE: Reject if space data unavailable
        if (!space) {
          logger.warn(
            `⚠️ Rejecting message ${decryptedContent.messageId} - space ${spaceId} data unavailable`
          );
          return;
        }

        // Find the target channel in space groups
        const channel = this.findChannelInSpace(space, channelId);

        // FAIL-SECURE: Reject if channel not found
        if (!channel) {
          logger.warn(
            `⚠️ Rejecting message ${decryptedContent.messageId} - channel ${channelId} not found in space ${spaceId}`
          );
          return;
        }

        // Validate read-only channel permissions against the VERIFIED signer
        // (not the spoofable payload senderId): a modified client could forge a
        // manager's address to post in a read-only channel for everyone. Drops
        // unsigned/unverifiable posts (read-only requires proven manager
        // identity). See isReadOnlyPostAuthorized.
        if (channel.isReadOnly) {
          const members = await this.messageDB.getSpaceMembers(spaceId);
          const authorized = await this.isReadOnlyPostAuthorized(
            decryptedContent,
            space,
            channel,
            members
          );
          if (!authorized) {
            return;
          }
        }
      }

      // Message length validation for post messages (defense-in-depth)
      // Note: text can be string | string[], must handle both
      // Edit-message validation is in the edit-message handler above (line ~310)
      if (isPostMessage) {
        const text = (decryptedContent.content as PostMessage).text;
        const messageText = Array.isArray(text) ? text.join('') : text;

        if (messageText && messageText.length > MAX_MESSAGE_LENGTH) {
          return;
        }
      }

      // Mention count validation (defense-in-depth)
      if (decryptedContent.mentions) {
        const totalMentions =
          (decryptedContent.mentions.memberIds?.length || 0) +
          (decryptedContent.mentions.roleIds?.length || 0) +
          (decryptedContent.mentions.channelIds?.length || 0) +
          (decryptedContent.mentions.everyone ? 1 : 0);

        if (totalMentions > MAX_MENTIONS_PER_MESSAGE) {
          return;
        }
      }

      // Receiving-side rate limit detection (defense-in-depth)
      // Skip rate limiting for DMs - spam is less of a concern in 1:1 conversations
      // and rate limiting interferes with syncing historical messages
      const senderId = decryptedContent.content.senderId;
      if (!skipRateLimit) {
        let limiter = this.receivingRateLimiters.get(senderId);
        if (!limiter) {
          limiter = new SimpleRateLimiter(
            RATE_LIMITS.RECEIVING.maxMessages,
            RATE_LIMITS.RECEIVING.windowMs
          );
          this.receivingRateLimiters.set(senderId, limiter);
        }

        const rateCheck = limiter.canSend();
        if (!rateCheck.allowed) {
          logger.warn(
            `🔒 Rate limit: Message from ${senderId} rejected (flood detected). ` +
              `Message ID: ${decryptedContent.messageId}`
          );
          return; // Drop message silently (defense-in-depth)
        }
      }

      // Check if sender is muted in this space (filter muted users' messages)
      // Skip for DMs - mute is Space-only feature
      if (!isDM) {
        const isSenderMuted = await this.messageDB.isUserMuted(spaceId, senderId);
        if (isSenderMuted) {
          return; // Drop message silently - sender is muted
        }
      }

      // Authorized - add to cache
      queryClient.setQueriesData(
        { queryKey: buildMessagesKeyPrefix({ spaceId: spaceId, channelId: channelId }) },
        (oldData: InfiniteData<any>) => {
          if (!oldData?.pages) return oldData;

          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page, index) => {
              // Only add the new message to the most recent page
              if (index === oldData.pages.length - 1) {
                // Build new messages array with deduplication
                const newMessages = [
                  ...page.messages.filter(
                    (m: Message) => m.messageId !== decryptedContent.messageId
                  ),
                  decryptedContent,
                ];

                // Sort: pending messages ('sending') stay at end, others by createdDate
                newMessages.sort((a: Message, b: Message) => {
                  // Pending messages always go to END
                  if (
                    a.sendStatus === 'sending' &&
                    b.sendStatus !== 'sending'
                  ) {
                    return 1;
                  }
                  if (
                    b.sendStatus === 'sending' &&
                    a.sendStatus !== 'sending'
                  ) {
                    return -1;
                  }
                  // Otherwise maintain chronological order by createdDate
                  return a.createdDate - b.createdDate;
                });

                return {
                  ...page,
                  messages: newMessages,
                  // Preserve any cursors or other pagination metadata
                  nextCursor: page.nextCursor,
                  prevCursor: page.prevCursor,
                };
              }
              // Return other pages unchanged
              return page;
            }),
          };
        }
      );
    }

    // Invalidate mention counts when a message with mentions is added
    if (
      decryptedContent.mentions?.memberIds &&
      decryptedContent.mentions.memberIds.length > 0
    ) {
      // Invalidate space-level mention counts (matches ['mention-counts', 'space', ...])
      await queryClient.invalidateQueries({
        queryKey: ['mention-counts', 'space'],
      });
      // Invalidate channel-level mention counts (matches ['mention-counts', 'channel', spaceId, ...])
      await queryClient.invalidateQueries({
        queryKey: ['mention-counts', 'channel', spaceId],
      });
      // Also invalidate notification inbox query (per-space AND global panels).
      // Bare prefix matches both ['mention-notifications', spaceId] and
      // ['mention-notifications', 'global', ...].
      await queryClient.invalidateQueries({
        queryKey: ['mention-notifications'],
      });
      // Invalidate unread message counts when new messages arrive
      await queryClient.invalidateQueries({
        queryKey: ['unread-counts', 'channel', spaceId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['unread-counts', 'space'],
      });
    }

    // Invalidate reply counts when a reply to any user's message arrives
    // This ensures the notification bubble updates when someone replies to your message
    if (decryptedContent.replyMetadata?.parentAuthor) {
      // Invalidate space-level reply counts (matches ['reply-counts', 'space', ...])
      await queryClient.invalidateQueries({
        queryKey: ['reply-counts', 'space'],
      });
      // Invalidate channel-level reply counts (matches ['reply-counts', 'channel', spaceId, ...])
      await queryClient.invalidateQueries({
        queryKey: ['reply-counts', 'channel', spaceId],
      });
      // Per-space AND global panels (bare prefix matches both).
      await queryClient.invalidateQueries({
        queryKey: ['reply-notifications'],
      });
    }

    // Invalidate unread counts for ALL messages (including DMs without mentions)
    // Check if this is a DM (spaceId === channelId for direct messages)
    if (spaceId === channelId) {
      // This is a direct message conversation
      await queryClient.invalidateQueries({
        queryKey: ['unread-counts', 'direct-messages'],
      });
    } else {
      // This is a channel message - invalidate channel/space unread counts
      // (only if not already done above for mentions)
      if (
        !decryptedContent.mentions?.memberIds ||
        decryptedContent.mentions.memberIds.length === 0
      ) {
        await queryClient.invalidateQueries({
          queryKey: ['unread-counts', 'channel', spaceId],
        });
        await queryClient.invalidateQueries({
          queryKey: ['unread-counts', 'space'],
        });
      }
    }
  }

  /**
   * Submits direct message: encrypts, signs, sends to API, saves locally.
   * For post messages: uses optimistic updates (message appears immediately with "Sending" status).
   */
  async submitMessage(
    address: string,
    pendingMessage: string | object,
    self: secureChannel.UserRegistration,
    counterparty: secureChannel.UserRegistration,
    queryClient: QueryClient,
    currentPasskeyInfo: {
      credentialId: string;
      address: string;
      publicKey: string;
      displayName?: string;
      pfpUrl?: string;
      completedOnboarding: boolean;
    },
    keyset: {
      deviceKeyset: secureChannel.DeviceKeyset;
      userKeyset: secureChannel.UserKeyset;
    },
    inReplyTo?: string,
    skipSigning?: boolean
  ) {
    // Determine message type for optimistic update handling
    const isEditMessage =
      typeof pendingMessage === 'object' &&
      (pendingMessage as any).type === 'edit-message';
    const isDeleteConversation =
      typeof pendingMessage === 'object' &&
      ((pendingMessage as any).type === 'delete-conversation' ||
        (pendingMessage as any).type === 'delete-conversation-self');
    const isReaction =
      typeof pendingMessage === 'object' &&
      ((pendingMessage as any).type === 'reaction' ||
        (pendingMessage as any).type === 'remove-reaction');
    const isRemoveMessage =
      typeof pendingMessage === 'object' &&
      (pendingMessage as any).type === 'remove-message';

    // Post messages (regular text/embed) use optimistic updates
    const isPostMessage =
      typeof pendingMessage === 'string' ||
      (!isEditMessage &&
        !isDeleteConversation &&
        !isReaction &&
        !isRemoveMessage &&
        (pendingMessage as any).type !== 'remove-message');

    // ── DM reveal rule ──────────────────────────────────────────────────────
    //
    // Identity rides an INIT-CARRYING frame: every session-creating call below
    // takes `displayName` / `pfpUrl` and the crypto layer puts them in the
    // envelope's `user_profile`. So whether we reveal ourselves is decided
    // HERE, by what kind of act this is.
    //
    // Every act reaching this method is deliberate EXCEPT the two delete
    // variants. Deleting a conversation is not a reply — a spammer messages
    // you, you delete the thread, and desktop sends them a reset signal. If
    // that signal carries identity, "I want nothing to do with you" is the
    // frame that unmasks you, and it can be the FIRST frame they ever get from
    // you. This is not hypothetical: it is exactly the path mobile found on its
    // own side, which nobody predicted from the send path alone.
    //
    // A delete to someone we HAVE already revealed to keeps its identity: the
    // ledger already reflects that consent, and stripping it would only degrade
    // an existing partner's row for no privacy gain.
    const isRevealingAct = !isDeleteConversation;
    if (isRevealingAct) {
      // Records synchronously; the identity push it may trigger is
      // fire-and-forget and can never fail this send.
      this.recordRevealAndAnnounce(currentPasskeyInfo.address, address, keyset);
    }
    const mayRevealIdentity =
      isRevealingAct ||
      (await this.isRevealedTo(currentPasskeyInfo.address, address));
    // Read these, never `currentPasskeyInfo.displayName`, at every
    // session-creating call below. `undefined` is what the crypto layer already
    // receives from any caller that has no passkey display name, so this is a
    // supported value on that boundary, not a new one.
    const outgoingDisplayName = mayRevealIdentity
      ? currentPasskeyInfo.displayName
      : undefined;
    const outgoingUserIcon = mayRevealIdentity ? currentPasskeyInfo.pfpUrl : undefined;

    // Pre-built message for optimistic display (set inside isPostMessage block,
    // reused by legacy enqueueOutbound path to ensure same messageId)
    let preBuiltMessage: Message | null = null;
    let preBuiltMessageIdBuffer: ArrayBuffer | null = null;

    // For post messages: prepare and show optimistically BEFORE enqueueing
    if (isPostMessage) {
      // Generate nonce and calculate messageId
      const nonce = crypto.randomUUID();
      const messageIdBuffer = await crypto.subtle.digest(
        'SHA-256',
        Buffer.from(
          nonce +
            'post' +
            currentPasskeyInfo.address +
            (typeof pendingMessage === 'string'
              ? pendingMessage
              : JSON.stringify(pendingMessage)),
          'utf-8'
        )
      );
      const messageIdHex = Buffer.from(messageIdBuffer).toString('hex');

      // Create message object
      const message = {
        channelId: address!,
        spaceId: address!,
        messageId: messageIdHex,
        digestAlgorithm: 'SHA-256',
        nonce: nonce,
        createdDate: Date.now(),
        modifiedDate: Date.now(),
        lastModifiedHash: '',
        content:
          typeof pendingMessage === 'string'
            ? ({
                type: 'post',
                senderId: currentPasskeyInfo.address,
                text: pendingMessage,
                repliesToMessageId: inReplyTo,
              } as PostMessage)
            : {
                ...(pendingMessage as any),
                senderId: currentPasskeyInfo.address,
              },
        reactions: [],
      } as unknown as Message;

      // Sign message BEFORE optimistic display
      if (!skipSigning) {
        try {
          const sig = ch.js_sign_ed448(
            Buffer.from(
              new Uint8Array(keyset.userKeyset.user_key.private_key)
            ).toString('base64'),
            Buffer.from(messageIdBuffer).toString('base64')
          );
          message.publicKey = Buffer.from(
            new Uint8Array(keyset.userKeyset.user_key.public_key)
          ).toString('hex');
          message.signature = Buffer.from(JSON.parse(sig), 'base64').toString(
            'hex'
          );
        } catch { /* Signature optional - continue without it */ }
      }

      // Check if we have existing encryption states for this conversation
      // Use Action Queue ONLY when offline - when online, legacy path handles new devices better
      const conversationId = address + '/' + address;
      const existingStates = await this.messageDB.getEncryptionStates({ conversationId });
      const hasEstablishedSessions = existingStates.length > 0;
      const isOnline = navigator.onLine;

      if (ENABLE_DM_ACTION_QUEUE && hasEstablishedSessions && !isOnline) {
        // Piggyback pending delivery + read receipt acks on outgoing DM
        this.attachPiggybackedAcks(address, message);

        // Add to cache with 'sending' status (optimistic update)
        await this.addMessage(queryClient, address, address, {
          ...message,
          sendStatus: 'sending',
        });

        // Queue to ActionQueue for persistent, crash-resistant delivery
        if (!this.actionQueueService) {
          throw new Error(
            'ActionQueueService not initialized. This is a bug - MessageService.setActionQueueService() must be called before sending messages.'
          );
        }
        await this.actionQueueService.enqueue(
          'send-dm',
          {
            address,
            signedMessage: message,
            messageId: messageIdHex,
            selfUserAddress: self.user_address,
            // Reveal-gated, like every other identity emission on this path.
            // Always populated in practice (a queued post is a deliberate act,
            // so `mayRevealIdentity` is true) — read from the gated values
            // anyway, so a future non-post caller cannot quietly leak here.
            senderDisplayName: outgoingDisplayName,
            senderUserIcon: outgoingUserIcon,
          },
          `send-dm:${address}:${messageIdHex}`
        );

        return; // Post message handling complete via action queue
      }

      // No established sessions or online - fall through to legacy path below
      // which will create new sessions using full self/counterparty data.
      // Still show the message optimistically so followOutput fires before composer resize.
      // Store the pre-built message so the legacy path can reuse it (same messageId).
      preBuiltMessage = message;
      preBuiltMessageIdBuffer = messageIdBuffer;
      await this.addMessage(queryClient, address, address, {
        ...message,
        sendStatus: 'sending',
      });
    }

    // Legacy path: used for edit-message, delete-conversation, reactions (no optimistic update),
    // and for post messages falling through from isPostMessage (optimistic update already done above)
    this.enqueueOutbound(async () => {
      const outbounds: string[] = [];
      const nonce = preBuiltMessage ? preBuiltMessage.nonce : crypto.randomUUID();

      // Handle edit-message type
      if (
        typeof pendingMessage === 'object' &&
        (pendingMessage as any).type === 'edit-message'
      ) {
        const editMessage = pendingMessage as EditMessage;
        // Verify the original message exists and can be edited
        const originalMessage = await this.messageDB.getMessage({
          spaceId: address,
          channelId: address,
          messageId: editMessage.originalMessageId,
        });

        if (!originalMessage) {
          return outbounds;
        }

        // Check permissions
        if (originalMessage.content.senderId !== currentPasskeyInfo.address) {
          return outbounds;
        }

        // Only allow editing post messages
        if (originalMessage.content.type !== 'post') {
          return outbounds;
        }

        // Check edit time window
        const timeSinceCreation = Date.now() - originalMessage.createdDate;
        if (timeSinceCreation > MESSAGE_EDIT_WINDOW_MS) {
          return outbounds;
        }

        // Create the edit message with proper structure
        const messageId = await crypto.subtle.digest(
          'SHA-256',
          Buffer.from(
            nonce +
              'edit-message' +
              currentPasskeyInfo.address +
              canonicalize(editMessage),
            'utf-8'
          )
        );
        const message = {
          channelId: address!,
          spaceId: address!,
          messageId: Buffer.from(messageId).toString('hex'),
          digestAlgorithm: 'SHA-256',
          nonce: nonce,
          createdDate: Date.now(),
          modifiedDate: Date.now(),
          lastModifiedHash: '',
          content: {
            ...editMessage,
            senderId: currentPasskeyInfo.address,
          } as EditMessage,
        } as Message;

        const conversationId = address + '/' + address;
        const conversation = await this.messageDB.getConversation({
          conversationId,
        });
        // Ratchet critical section: read state → encrypt → save. Serialized per
        // conversation to prevent concurrent state forks (see dmRatchetMutex).
        await dmRatchetMutex.runExclusive(conversationId, async () => {
          let response = await this.messageDB.getEncryptionStates({
            conversationId,
          });
          const inboxes = self.device_registrations
            .map((d) => d.inbox_registration.inbox_address)
            .concat(
              counterparty.device_registrations.map(
                (d) => d.inbox_registration.inbox_address
              )
            )
            .sort();

          for (const res of response) {
            if (!inboxes.includes(JSON.parse(res.state).tag)) {
              await this.messageDB.deleteEncryptionState(res);
            }
          }

          response = await this.messageDB.getEncryptionStates({ conversationId });
          const sets = orderSessionsForSend(response);

          let sessions: secureChannel.SealedMessageAndMetadata[] = [];
          // Edit inherit rule: sign iff the edited message was signed, so an
          // unsigned (deniable) DM message never silently gains a signature.
          if (shouldSignEdit(originalMessage)) {
            try {
              const sig = ch.js_sign_ed448(
                Buffer.from(
                  new Uint8Array(keyset.userKeyset.user_key.private_key)
                ).toString('base64'),
                Buffer.from(messageId).toString('base64')
              );
              message.publicKey = Buffer.from(
                new Uint8Array(keyset.userKeyset.user_key.public_key)
              ).toString('hex');
              message.signature = Buffer.from(JSON.parse(sig), 'base64').toString(
                'hex'
              );
            } catch { /* Signature optional - continue without it */ }
          }

          for (const inbox of inboxes.filter(
            (i) => i !== keyset.deviceKeyset.inbox_keyset.inbox_address
          )) {
            const set = sets.find((s) => s.tag === inbox);
            if (set) {
              if (set.sending_inbox.inbox_public_key === '') {
                sessions = [
                  ...sessions,
                  ...secureChannel.DoubleRatchetInboxEncryptForceSenderInit(
                    keyset.deviceKeyset,
                    [set],
                    JSON.stringify(message),
                    self,
                    outgoingDisplayName,
                    outgoingUserIcon
                  ),
                ];
              } else {
                sessions = [
                  ...sessions,
                  ...secureChannel.DoubleRatchetInboxEncrypt(
                    keyset.deviceKeyset,
                    [set],
                    JSON.stringify(message),
                    self,
                    outgoingDisplayName,
                    outgoingUserIcon
                  ),
                ];
              }
            } else {
              sessions = [
                ...sessions,
                ...(await secureChannel.NewDoubleRatchetSenderSession(
                  keyset.deviceKeyset,
                  self.user_address,
                  self.device_registrations
                    .concat(counterparty.device_registrations)
                    .find((d) => d.inbox_registration.inbox_address === inbox)!,
                  JSON.stringify(message),
                  outgoingDisplayName,
                  outgoingUserIcon
                )),
              ];
            }
          }

          for (const session of sessions) {
            const newEncryptionState: EncryptionState = {
              state: JSON.stringify({
                ratchet_state: session.ratchet_state,
                receiving_inbox: session.receiving_inbox,
                tag: session.tag,
                sending_inbox: session.sending_inbox,
              } as secureChannel.DoubleRatchetStateAndInboxKeys),
              timestamp: Date.now(),
              inboxId: session.receiving_inbox.inbox_address,
              conversationId: address! + '/' + address!,
              sentAccept: session.sent_accept,
            };
            await this.messageDB.saveEncryptionState(newEncryptionState, true);
            outbounds.push(
              JSON.stringify({
                type: 'listen',
                inbox_addresses: [session.receiving_inbox.inbox_address],
              })
            );
            outbounds.push(
              JSON.stringify({ type: 'direct', ...session.sealed_message })
            );
          }
        });

        await this.saveMessage(
          message,
          this.messageDB,
          address!,
          address!,
          'direct',
          {
            user_icon:
              conversation?.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
            display_name:
              conversation?.conversation?.displayName ?? t`Unknown User`,
          },
          // Our own send: we are provably the author, no crypto layer needed
          // to tell us so. This is the stamp the reveal ledger reads back as
          // "I deliberately messaged this person".
          currentPasskeyInfo.address,
          currentPasskeyInfo.address // Update lastReadTimestamp for own messages
        );
        await this.addMessage(queryClient, address, address, message);

        return outbounds;
      }

      // Reuse pre-built message if available (optimistic update already displayed),
      // otherwise create a new one (non-post messages won't have a pre-built message)
      let messageId: ArrayBuffer;
      let message: Message;
      if (preBuiltMessage && preBuiltMessageIdBuffer) {
        message = preBuiltMessage;
        messageId = preBuiltMessageIdBuffer;
      } else {
        messageId = await crypto.subtle.digest(
          'SHA-256',
          Buffer.from(
            nonce +
              'post' +
              currentPasskeyInfo.address +
              (typeof pendingMessage === 'string'
                ? pendingMessage
                : JSON.stringify(pendingMessage)),
            'utf-8'
          )
        );
        message = {
          channelId: address!,
          spaceId: address!,
          messageId: Buffer.from(messageId).toString('hex'),
          digestAlgorithm: 'SHA-256',
          nonce: nonce,
          createdDate: Date.now(),
          modifiedDate: Date.now(),
          lastModifiedHash: '',
          content:
            typeof pendingMessage === 'string'
              ? ({
                  type: 'post',
                  senderId: currentPasskeyInfo.address,
                  text: pendingMessage,
                  repliesToMessageId: inReplyTo,
                } as PostMessage)
              : {
                  ...(pendingMessage as any),
                  senderId: currentPasskeyInfo.address,
                },
        } as Message;
      }
      const conversationId = address + '/' + address;
      const conversation = await this.messageDB.getConversation({
        conversationId,
      });
      // Ratchet critical section: read state → encrypt → save. Serialized per
      // conversation to prevent concurrent state forks (see dmRatchetMutex).
      await dmRatchetMutex.runExclusive(conversationId, async () => {
        let response = await this.messageDB.getEncryptionStates({
          conversationId,
        });
        const inboxes = self.device_registrations
          .map((d) => d.inbox_registration.inbox_address)
          .concat(
            counterparty.device_registrations.map(
              (d) => d.inbox_registration.inbox_address
            )
          )
          .sort();
        for (const res of response) {
          if (!inboxes.includes(JSON.parse(res.state).tag)) {
            await this.messageDB.deleteEncryptionState(res);
          }
        }

        response = await this.messageDB.getEncryptionStates({ conversationId });
        const sets = orderSessionsForSend(response);

        let sessions: secureChannel.SealedMessageAndMetadata[] = [];
        // Sign DM unless explicitly skipped (skip if already signed via preBuiltMessage)
        if (!skipSigning && !preBuiltMessage) {
          try {
            const sig = ch.js_sign_ed448(
              Buffer.from(
                new Uint8Array(keyset.userKeyset.user_key.private_key)
              ).toString('base64'),
              Buffer.from(messageId).toString('base64')
            );
            message.publicKey = Buffer.from(
              new Uint8Array(keyset.userKeyset.user_key.public_key)
            ).toString('hex');
            message.signature = Buffer.from(JSON.parse(sig), 'base64').toString(
              'hex'
            );
          } catch { /* Signature optional - continue without it */ }
        }

        // Piggyback pending delivery + read receipt acks on outgoing DM
        this.attachPiggybackedAcks(address, message);

        for (const inbox of inboxes.filter(
          (i) => i !== keyset.deviceKeyset.inbox_keyset.inbox_address
        )) {
          const set = sets.find((s) => s.tag === inbox);
          if (set) {
            if (set.sending_inbox.inbox_public_key === '') {
              sessions = [
                ...sessions,
                ...secureChannel.DoubleRatchetInboxEncryptForceSenderInit(
                  keyset.deviceKeyset,
                  [set],
                  JSON.stringify(message),
                  self,
                  outgoingDisplayName,
                  outgoingUserIcon
                ),
              ];
            } else {
              sessions = [
                ...sessions,
                ...secureChannel.DoubleRatchetInboxEncrypt(
                  keyset.deviceKeyset,
                  [set],
                  JSON.stringify(message),
                  self,
                  outgoingDisplayName,
                  outgoingUserIcon
                ),
              ];
            }
          } else {
            sessions = [
              ...sessions,
              ...(await secureChannel.NewDoubleRatchetSenderSession(
                keyset.deviceKeyset,
                self.user_address,
                self.device_registrations
                  .concat(counterparty.device_registrations)
                  .find((d) => d.inbox_registration.inbox_address === inbox)!,
                JSON.stringify(message),
                outgoingDisplayName,
                outgoingUserIcon
              )),
            ];
          }
        }

        // Strip piggybacked acks before persisting
        this.stripPiggybackedAcks(message);

        for (const session of sessions) {
          const newEncryptionState: EncryptionState = {
            state: JSON.stringify({
              ratchet_state: session.ratchet_state,
              receiving_inbox: session.receiving_inbox,
              tag: session.tag,
              sending_inbox: session.sending_inbox,
            } as secureChannel.DoubleRatchetStateAndInboxKeys),
            timestamp: Date.now(),
            inboxId: session.receiving_inbox.inbox_address,
            conversationId: address! + '/' + address!,
            sentAccept: session.sent_accept,
          };
          await this.messageDB.saveEncryptionState(newEncryptionState, true);
          outbounds.push(
            JSON.stringify({
              type: 'listen',
              inbox_addresses: [session.receiving_inbox.inbox_address],
            })
          );
          outbounds.push(
            JSON.stringify({ type: 'direct', ...session.sealed_message })
          );
        }
      });

      // do not save delete-conversation (control) messages
      if (
        message.content.type === 'delete-conversation' ||
        message.content.type === 'delete-conversation-self'
      ) {
        return outbounds;
      }

      await this.saveMessage(
        message,
        this.messageDB,
        address!,
        address!,
        'direct',
        {
          user_icon:
            conversation?.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
          display_name:
            conversation?.conversation?.displayName ?? t`Unknown User`,
        },
        // Our own send — see the sibling call above.
        currentPasskeyInfo.address,
        currentPasskeyInfo.address // Update lastReadTimestamp for own messages
      );
      await this.addMessage(queryClient, address, address, message);
      // Both stamps are the message's own createdDate, matching exactly what
      // `db.saveMessage` just wrote to IndexedDB for an own message
      // (messages.ts: `timestamp: message.createdDate`, and
      // `lastReadTimestamp: message.createdDate` when isOwnMessage).
      //
      // `Date.now()` used to be passed for `timestamp` here. It is evaluated
      // after encrypt + enqueue, so it is strictly later than `createdDate`,
      // and the optimistic row it wrote was `lastReadTimestamp < timestamp` —
      // i.e. unread the instant you sent a message. The stale previews snapshot
      // hid that from the sidebar; now that the list renders live rows, it
      // would be visible until the next 2s poll corrected it.
      await this.addOrUpdateConversation(
        queryClient,
        address,
        message.createdDate,
        message.createdDate,
        {
          user_icon:
            conversation?.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
          display_name:
            conversation?.conversation?.displayName ?? 'Unknown User',
        }
      );

      return outbounds;
    });
  }

  /**
   * Handles all incoming messages: decrypts, processes control/sync/post messages, updates state.
   */
  async handleNewMessage(
    self_address: string,
    keyset: {
      userKeyset: secureChannel.UserKeyset;
      deviceKeyset: secureChannel.DeviceKeyset;
    },
    message: EncryptedMessage,
    queryClient: QueryClient
  ) {
    const states = (await this.messageDB.getAllEncryptionStates()).reduce(
      (prev, curr) => {
        return Object.assign(prev, { [curr.inboxId]: curr });
      },
      {} as { [key: string]: EncryptionState }
    );
    const found = states[message.inboxAddress];

    if (
      message.inboxAddress == keyset.deviceKeyset.inbox_keyset.inbox_address
    ) {
      // Hoisted above the try so the catch can tell "failed before decrypt"
      // (frame is garbage, safe to delete) from "failed after decrypt" (the
      // frame holds a real message and must be retained).
      let decryptedContent: Message | null = null;
      let newState: any | null = null;
      try {
        const envelope = Object.assign(
          secureChannel.UnsealInitializationEnvelope(
            keyset.deviceKeyset,
            JSON.parse(message.encryptedContent)
          ),
          { timestamp: message.timestamp }
        );
        const session = await secureChannel.NewDoubleRatchetRecipientSession(
          keyset.deviceKeyset,
          envelope
        );

        let conversationId = session.user_address + '/' + session.user_address;

        // ⚠️ CAPTURED BEFORE THE REASSIGNMENT BELOW, and load-bearing.
        //
        // `session.user_address` is the sender the CRYPTO LAYER authenticated —
        // the only trustworthy statement of who sent this frame. Ten lines down
        // it is deliberately overwritten with the conversation partner for the
        // self-echo case, after which the true sender is unrecoverable. Anything
        // that needs to know "was this really us?" must read this boolean, never
        // a field from inside the decrypted payload.
        const authenticatedSenderIsSelf = session.user_address === self_address;
        // Same value, kept as the address rather than a boolean: it is what
        // gets stamped onto every row saved from this frame. For a partner's
        // message this is the partner; for our own message echoed from another
        // device it is us, which is correct — we did author that one.
        const authenticatedDmSender = session.user_address;

        let updatedUserProfile: secureChannel.UserProfile | undefined;
        decryptedContent = parseDecryptedMessage(session.message, 'InitEnvelope');

        if (session.user_address == self_address) {
          conversationId =
            decryptedContent?.channelId + '/' + decryptedContent?.channelId;
          session.user_address = decryptedContent!.channelId;
        }
        // Malformed envelope (no resolvable counterparty address): would
        // create a garbage 'undefined/undefined' conversation row — observed
        // live from ancient redelivered envelopes. Drop and defuse.
        if (!session.user_address || session.user_address === 'undefined') {
          logger.warn(
            '[MessageService] ⚠️ MALFORMED init envelope (no user address) — dropping and deleting from server',
            {
              envelopeTimestamp: envelope.timestamp,
              envelopeAgeSeconds: Math.round(
                (Date.now() - envelope.timestamp) / 1000
              ),
            }
          );
          this.dispatchInboxDelete(
            keyset.deviceKeyset.inbox_keyset,
            [envelope.timestamp],
            'malformed init envelope (no user address)'
          );
          return;
        }
        if (decryptedContent?.content?.type === 'delete-conversation') {
          // Reset/delete signals are obeyed unconditionally and used to be
          // processed in COMPLETE silence — a stale one arriving late (e.g.
          // queued server-side across a reconnect) silently wipes a healthy
          // session. Log loudly with the frame's age so late kills are
          // visible in any debug session.
          logger.warn(
            '[MessageService] ⚠️ RESET SIGNAL received (delete-conversation, init-envelope path) — wiping encryption states',
            {
              conversationId: conversationId?.slice(0, 16),
              frameTimestamp: envelope.timestamp,
              frameAgeSeconds: Math.round((Date.now() - envelope.timestamp) / 1000),
            }
          );
          await this.deleteEncryptionStates({ conversationId });
          this.dispatchInboxDelete(
            keyset.deviceKeyset.inbox_keyset,
            [envelope.timestamp],
            'delete-conversation reset signal (init-envelope path)'
          );
          return;
        }
        // delete-conversation-self: another of OUR OWN devices deleted this DM.
        // Delete the whole conversation here too. Gated to self — the
        // counterparty also receives the fan-out but must never delete our copy.
        // (Self-sync messages only arrive on this init-envelope branch.)
        //
        // ⚠️ BOTH CONDITIONS ARE REQUIRED, and the authenticated one is what
        // makes this safe. `content.senderId` is PLAINTEXT the sender chose: a
        // stranger can simply write your address into it. On its own it is not
        // a gate, it is a suggestion — and this handler DESTROYS a conversation
        // and every message in it, at an address the same untrusted payload
        // names. MEASURED 2026-08-20 before this line existed
        // (`yarn harness dm-selfdelete-forgery`): a bot that had never been
        // messaged deleted a victim's entire conversation with an unrelated
        // third party, 2 messages to 0.
        //
        // `authenticatedSenderIsSelf` comes from the crypto layer and cannot be
        // written by a sender. Keep the plaintext check too — it is what
        // distinguishes a self-sync frame from our own ordinary self-echo.
        if (
          decryptedContent?.content?.type === 'delete-conversation-self' &&
          decryptedContent.content.senderId === self_address &&
          authenticatedSenderIsSelf
        ) {
          const target = decryptedContent.content.conversationAddress;
          logger.warn(
            '[MessageService] ⚠️ RESET SIGNAL received (delete-conversation-self from own device) — deleting conversation locally',
            {
              conversation: target?.slice(0, 16),
              frameTimestamp: envelope.timestamp,
              frameAgeSeconds: Math.round((Date.now() - envelope.timestamp) / 1000),
            }
          );
          await this.deleteConversationLocally(target + '/' + target, queryClient);
          this.dispatchInboxDelete(
            keyset.deviceKeyset.inbox_keyset,
            [envelope.timestamp],
            'delete-conversation-self from own device'
          );
          return;
        }

        const inbox_key = await secureChannel.NewInboxKeyset();
        // Ratchet critical section: replacing the session rows for this tag
        // and persisting the new session must be atomic vs concurrent sends
        // on the same conversation (see dmRatchetMutex).
        const installed = await dmRatchetMutex.runExclusive(conversationId, async () => {
          const encryptionStates = await this.messageDB.getEncryptionStates({
            conversationId,
          });
          const existing = encryptionStates.filter(
            (e) => JSON.parse(e.state).tag == session.tag
          );
          // An init envelope REPLACES the session for this tag. The server
          // redelivers any frame whose ack-by-delete failed (502s observed
          // live), so a STALE envelope replayed on reconnect would replace a
          // HEALTHY session with a zombie the sender no longer holds —
          // confirmed live 2026-07-17 with envelopes up to 60 days old
          // killing fresh sessions on every hard refresh. Refuse anything
          // not strictly newer than the rows it would replace.
          if (
            isStaleInitEnvelope(
              envelope.timestamp,
              existing.map((e) => e.timestamp)
            )
          ) {
            logger.debug(
              '[MessageService] ⚠️ STALE init envelope IGNORED — zombie defused, keeping current session',
              {
                conversationId: conversationId?.slice(0, 16),
                envelopeTimestamp: envelope.timestamp,
                envelopeAgeSeconds: Math.round(
                  (Date.now() - envelope.timestamp) / 1000
                ),
                // `Math.max()` of an empty list is -Infinity, which serialises
                // to null and reads as "we had a row and it was missing" rather
                // than "there was no row". Since scoping the age bound to the
                // no-rows case, that is now the COMMON refusal, so the two must
                // be distinguishable — this log line is how the refusal gets
                // diagnosed at all.
                rowCount: existing.length,
                newestRowTimestamp: existing.length
                  ? Math.max(...existing.map((e) => e.timestamp))
                  : null,
              }
            );
            return false;
          }
          logger.warn(
            '[MessageService] ⚠️ SESSION REPLACED by init envelope',
            {
              conversationId: conversationId?.slice(0, 16),
              envelopeTimestamp: envelope.timestamp,
              envelopeAgeSeconds: Math.round(
                (Date.now() - envelope.timestamp) / 1000
              ),
              replacedRows: existing.map((e) => ({
                inboxId: e.inboxId?.slice(0, 12),
                stateTimestamp: e.timestamp,
                stateAgeSeconds: Math.round((Date.now() - e.timestamp) / 1000),
              })),
            }
          );
          for (const e of existing) {
            await this.messageDB.deleteEncryptionState(e);
          }

          newState = JSON.stringify({
            ratchet_state: session.state,
            receiving_inbox: inbox_key,
            tag: session.tag,
            sending_inbox: {
              inbox_address: session.return_inbox_address,
              inbox_encryption_key: session.return_inbox_encryption_key,
              inbox_public_key: session.return_inbox_public_key,
              inbox_private_key: session.return_inbox_private_key,
            },
          });
          await this.messageDB.saveEncryptionState(
            {
              state: newState,
              timestamp: message.timestamp,
              inboxId: inbox_key.inbox_address,
              conversationId: conversationId,
            },
            true
          );
          return true;
        });
        if (!installed) {
          // Stale envelope refused: keep the current session and delete the
          // frame so it cannot redeliver. SALVAGE the payload first: a frame
          // retained after a persist failure re-enters here on redelivery
          // (its re-install is refused as same-timestamp) and its embedded
          // message would otherwise be destroyed with the frame. Age-bounded
          // so ancient zombie envelopes cannot dump stale posts into the
          // chat; the DB save upserts by messageId, so a duplicate of an
          // already-saved message is a no-op.
          const payloadAgeMs = Date.now() - (decryptedContent?.createdDate ?? 0);
          if (
            decryptedContent?.content?.type === 'post' &&
            payloadAgeMs < INIT_PAYLOAD_SALVAGE_MAX_AGE_MS
          ) {
            logger.warn(
              '[MessageService] salvaging embedded message from refused init envelope',
              {
                conversationId: conversationId?.slice(0, 16),
                messageId: decryptedContent.messageId?.slice(0, 12),
                payloadAgeMs,
              }
            );
            const conversation = await this.messageDB.getConversation({
              conversationId,
            });
            const senderProfile = {
              user_icon:
                conversation?.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
              display_name:
                conversation?.conversation?.displayName ?? t`Unknown User`,
            };
            await this.saveMessage(
              decryptedContent,
              this.messageDB,
              session.user_address,
              session.user_address,
              'direct',
              senderProfile,
              authenticatedDmSender,
              self_address
            );
            await this.addMessage(
              queryClient,
              session.user_address,
              session.user_address,
              decryptedContent
            );
            await this.addOrUpdateConversation(
              queryClient,
              session.user_address,
              envelope.timestamp,
              0,
              senderProfile
            );
          }
          this.dispatchInboxDelete(
            keyset.deviceKeyset.inbox_keyset,
            [envelope.timestamp],
            'init path, message added'
          );
          return;
        }
        if (envelope.user_address != self_address) {
          updatedUserProfile = {
            user_address: envelope.user_address,
            user_icon: envelope.user_icon,
            display_name: envelope.display_name,
          };
        }
        // A brand-new session from this partner just landed on our device
        // inbox — the reinstall / second-device case. Answer with our identity
        // IF the ledger already says we consented to this relationship.
        // `session.user_address` is the address the crypto layer authenticated,
        // not the `envelope.user_address` field the sender wrote themselves.
        this.maybeAutoRevealToPartner(self_address, session.user_address, keyset);
        this.enqueueOutbound(async () => {
          return [
            JSON.stringify({
              type: 'listen',
              inbox_addresses: [inbox_key.inbox_address],
            }),
          ];
        });

        if (decryptedContent && newState) {
          // Encryption state already persisted inside the locked section above.
          // The frame's payload is now the only copy of the message, so the
          // non-essential steps are isolated: a settings/notification/UI-cache
          // failure must never abort the save. (A throw anywhere in this block
          // used to reach the outer catch, which silently deleted the frame —
          // losing the first message of any fresh session that hit an error.)
          let conversation: Awaited<
            ReturnType<MessageDB['getConversation']>
          > | null = null;
          let effectiveDeliveryReceipts = false;
          let effectiveReadReceipts = false;
          try {
            // Process delivery receipt data (intercept ack control messages, extract piggybacked acks, buffer for acking)
            const userConfig = await this.messageDB.getUserConfig({ address: self_address });
            conversation = await this.messageDB.getConversation({
              conversationId,
            });
            // Dual-read: synced config override first, then legacy local record.
            effectiveDeliveryReceipts =
              getConversationSetting(userConfig?.conversationSettings, conversationId, 'deliveryReceipts') ??
              conversation?.conversation?.deliveryReceipts ?? !!userConfig?.deliveryReceipts;
            effectiveReadReceipts =
              getConversationSetting(userConfig?.conversationSettings, conversationId, 'readReceipts') ??
              conversation?.conversation?.readReceipts ?? !!userConfig?.readReceipts;
          } catch (settingsError) {
            logger.error(
              '[MessageService] init-path settings/conversation lookup failed — using receipt defaults',
              { conversationId: conversationId?.slice(0, 16) },
              settingsError
            );
          }
          let intercepted = false;
          try {
            intercepted = this.interceptControlMessages(decryptedContent, session.user_address, self_address, effectiveDeliveryReceipts, effectiveReadReceipts, queryClient);
          } catch (interceptError) {
            logger.error(
              '[MessageService] init-path control intercept failed — treating as displayable message',
              { conversationId: conversationId?.slice(0, 16) },
              interceptError
            );
          }
          if (intercepted) {
            // delivery-ack control message — encryption state saved and the
            // frame fully processed, so delete it (it used to be left behind
            // and redelivered until the stale guard killed it).
            this.dispatchInboxDelete(
              keyset.deviceKeyset.inbox_keyset,
              [envelope.timestamp],
              'init path, intercepted control message'
            );
            return;
          }
          const senderProfile = updatedUserProfile ?? {
            user_icon:
              conversation?.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
            display_name:
              conversation?.conversation?.displayName ?? t`Unknown User`,
          };
          try {
            await this.saveMessage(
              decryptedContent,
              this.messageDB,
              session.user_address,
              session.user_address,
              'direct',
              senderProfile,
              authenticatedDmSender,
              self_address
            );
          } catch (saveError) {
            // The save is the critical step — retry once; a second failure
            // reaches the outer catch, which retains the frame for redelivery.
            logger.error(
              '[MessageService] init-path saveMessage failed — retrying once',
              {
                conversationId: conversationId?.slice(0, 16),
                messageId: decryptedContent.messageId?.slice(0, 12),
              },
              saveError
            );
            await this.saveMessage(
              decryptedContent,
              this.messageDB,
              session.user_address,
              session.user_address,
              'direct',
              senderProfile,
              authenticatedDmSender,
              self_address
            );
          }

          try {
            // Notify for DM posts from other users only (skip muted conversations)
            if (
              envelope.user_address !== self_address &&
              decryptedContent?.content?.type === 'post' &&
              !notificationService.isConversationMuted(conversationId)
            ) {
              const senderDisplayName = updatedUserProfile?.display_name
                ?? conversation?.conversation?.displayName
                ?? t`Unknown`;
              notificationService.addPendingNotification({
                type: 'dm',
                senderName: senderDisplayName,
              });
            }

            await this.addMessage(
              queryClient,
              session.user_address,
              session.user_address,
              decryptedContent
            );
            await this.addOrUpdateConversation(
              queryClient,
              session.user_address,
              envelope.timestamp,
              0,
              senderProfile
            );
          } catch (renderError) {
            // Message is safely in the DB — a notification/UI-cache failure
            // must not retain the frame (that would redeliver a saved message).
            logger.error(
              '[MessageService] init-path post-save step failed — message saved, continuing',
              { conversationId: conversationId?.slice(0, 16) },
              renderError
            );
          }
        } else {
          console.error(t`Failed to decrypt message with any known state`);
        }
        this.dispatchInboxDelete(
          keyset.deviceKeyset.inbox_keyset,
          [envelope.timestamp],
          'init path, frame fully processed'
        );
      } catch (initPathError) {
        if (decryptedContent) {
          // The envelope decrypted — the failure was local (install/persist).
          // RETAIN the frame: deleting here destroys the only copy of a real
          // message (this exact silent delete lost the first message of fresh
          // sessions). On redelivery the stale-refuse branch salvages the
          // payload even when the re-install is refused.
          logger.error(
            '[MessageService] init-path failed AFTER decrypt — retaining frame for redelivery',
            {
              inbox: message.inboxAddress?.slice(0, 12),
              timestamp: message.timestamp,
              messageId: decryptedContent.messageId?.slice(0, 12),
            },
            initPathError
          );
          return;
        }
        // Nothing decrypted — undecryptable/foreign frame. Delete as before
        // (bounded behavior), but never again silently.
        logger.warn(
          '[MessageService] init envelope failed before decrypt — deleting frame',
          {
            inbox: message.inboxAddress?.slice(0, 12),
            timestamp: message.timestamp,
          },
          initPathError
        );
        this.dispatchInboxDelete(
          keyset.deviceKeyset.inbox_keyset,
          [message.timestamp],
          'init envelope failed before decrypt'
        );
        return;
      }
      return;
    }

    if (!found) {
      // No encryption state for this inbox, so this frame cannot be decrypted
      // *yet*. Historically this branch was fully silent, which hid post-session-
      // loss message losses across six months of debugging; the log line added in
      // #236 is what finally surfaced it in a live capture on 2026-07-29.
      //
      // ── Why there is deliberately NO server-side delete here ────────────────
      //
      // The previous code called `deleteInboxMessages(keyset.deviceKeyset.inbox_keyset, …)`,
      // and its comment claimed "leaving the frame would redeliver it forever".
      // Both the call and the claim were wrong:
      //
      //   1. The delete payload is built from the keyset it is handed
      //      (`inbox_address: inboxKeyset.inbox_address`, MessageDB.tsx:317-322),
      //      so it named the DEVICE inbox — while this frame arrived on a SESSION
      //      inbox. The device-inbox case already returned above, so the two are
      //      guaranteed different here. It asked the relay to delete a timestamp
      //      from a mailbox the frame is not in: a successful no-op. Confirmed in
      //      an operator capture with 366 of these drops and ZERO delete failures.
      //   2. A correct delete is IMPOSSIBLE in this branch by construction. The
      //      payload needs the inbox's public key and a signature over its address
      //      — both of which live in the encryption state we just failed to find.
      //      There is no key material here to sign with.
      //
      // So the only honest options are "leave it" or "delete the wrong thing", and
      // leaving it is also the better outcome: the relay is the sole copy, and a
      // frame kept there can still be delivered once the session that owns this
      // inbox is re-established. Deleting correctly — had it been possible — would
      // have converted a recoverable stranding into permanent data loss.
      //
      // Mobile reached the same design independently: on exhausting every state it
      // records a bounded local attempt and returns, with no server-side delete
      // (quorum-mobile context/WebSocketContext.tsx, the init-wrapped-frame path).
      //
      // The attempt counter bounds our own repeated work and makes redelivery
      // visible in the log; it deliberately does NOT gate on exhaustion, because
      // there is no give-up action available that would not destroy the frame.
      const unknownInboxKey = frameKey(message.inboxAddress, message.encryptedContent);
      const attemptsExhausted = this.undecryptableFrames.recordFailure(unknownInboxKey);
      logger.warn(
        '[MessageService] DM frame for unknown inbox — no encryption state, retained unread',
        {
          inbox: message.inboxAddress?.slice(0, 12),
          timestamp: message.timestamp,
          // Distinguishes "a fresh frame we cannot place" from "the same frame
          // redelivering" — the count the 366-line capture could not provide.
          seenBefore: attemptsExhausted,
        }
      );
      return;
    }

    const conversationId = found.conversationId;
    const conversation = await this.messageDB.getConversation({
      conversationId,
    });

    let decryptedContent: Message | null = null;
    let newState: string | null = null;
    /**
     * A space frame we could not OPEN, and are keeping on the relay to retry.
     *
     * Declared out here because the decision is made in the space branch's catch
     * but acted on much later, at the inbox-cleanup tail — those are different
     * block scopes in the same very long function.
     */
    let retainUnopenedSpaceFrame = false;

    const keys = JSON.parse(found.state);
    let updatedUserProfile: secureChannel.UserProfile | undefined;
    let sentAccept: boolean | undefined;
    if (keys.sending_inbox) {
      // secureChannel.DoubleRatchetStateAndInboxKeys
      //
      // Ratchet critical section — serialized per conversation (see
      // dmRatchetMutex). Two invariants restored here:
      // 1. The state is RE-READ inside the lock: `found` was fetched before
      //    queuing for the lock, and a concurrent send (receipt, typing,
      //    text) may have advanced and saved a newer state while this frame
      //    waited. Decrypting from the stale snapshot forks the ratchet.
      // 2. On success the advanced state is persisted IMMEDIATELY. The
      //    Double Ratchet spec treats "accept plaintext + store state
      //    changes" as one atomic step
      //    (https://signal.org/docs/specifications/doubleratchet/). This
      //    save previously happened at the tail of this handler, hundreds of
      //    awaits later — a concurrent send could read the pre-decrypt state
      //    and erase the receive advance on save (the state fork behind the
      //    aead::Error frame drops).
      const dm = await dmRatchetMutex.runExclusive(conversationId, async () => {
        const freshStates = await this.messageDB.getEncryptionStates({
          conversationId,
        });
        const fresh =
          freshStates.find((s) => s.inboxId === message.inboxAddress) ?? found;
        const freshKeys = JSON.parse(fresh.state);
        // A frame that previously failed and was retained has now come back
        // and is about to be retried; on success we stop tracking it below.
        const undecryptableKey = frameKey(
          message.inboxAddress,
          message.encryptedContent
        );
        if (freshKeys.sending_inbox.inbox_public_key === '') {
          let restore: { headerKey: string; bucket: Record<string, unknown> } | null = null;
          try {
            // Wraps decrypt AND parse: the crate reports an AEAD failure in the
            // returned message, not by rejecting, so parseDecryptedMessage is the
            // call that throws (see the InboxDecrypt branch).
            const decryptAndParse = async (row: unknown) => {
              const r = await secureChannel.ConfirmDoubleRatchetSenderSession(
                row as Parameters<typeof secureChannel.ConfirmDoubleRatchetSenderSession>[0],
                JSON.parse(message.encryptedContent)
              );
              return { result: r, content: parseDecryptedMessage(r.message, 'Confirm') };
            };

            let attempt: Awaited<ReturnType<typeof decryptAndParse>>;
            try {
              attempt = await decryptAndParse(JSON.parse(fresh.state));
            } catch (firstError) {
              // Upstream skipped-key lookup defect — see utils/dmStaleBucketRetry.ts.
              const stale = findStaleBucket(fresh.state);
              if (!stale) throw firstError;
              attempt = await decryptAndParse(stale.prunedRow);
              restore = { headerKey: stale.headerKey, bucket: stale.bucket };
              logger.warn(
                '[MessageService] DM frame recovered by pruning the stale skipped-keys bucket for the retry (upstream #183 item 1a)',
                { branch: 'Confirm', prunedKeys: Object.keys(stale.bucket).length }
              );
            }
            const result = attempt.result;
            const content = attempt.content;
            if (content?.content?.type === 'delete-conversation') {
              logger.warn(
                '[MessageService] ⚠️ RESET SIGNAL received (delete-conversation, Confirm branch) — wiping encryption states',
                {
                  conversationId: conversationId?.slice(0, 16),
                  frameTimestamp: message.timestamp,
                  frameAgeSeconds: Math.round((Date.now() - message.timestamp) / 1000),
                }
              );
              await this.deleteEncryptionStates({ conversationId });
              // NOT awaited — dispatched after the state wipe above. This used to
              // rethrow; it no longer can, so its .catch is the only signal.
              this.dispatchInboxDelete(
                freshKeys.receiving_inbox,
                [message.timestamp],
                'delete-conversation reset signal (Confirm branch)'
              );
              return { outcome: 'handled' as const };
            }
            await this.messageDB.saveEncryptionState(
              {
                state: JSON.stringify({
                  // Re-file a bucket pruned for the retry — see the InboxDecrypt
                  // branch and utils/dmStaleBucketRetry.ts for why this is required.
                  ratchet_state: restore
                    ? restoreStaleBucket(result.ratchet_state, restore.headerKey, restore.bucket)
                    : result.ratchet_state,
                  receiving_inbox: result.receiving_inbox,
                  sending_inbox: result.sending_inbox,
                  tag: result.tag,
                }),
                timestamp: message.timestamp,
                inboxId: fresh.inboxId,
                sentAccept: true,
                conversationId,
              },
              true
            );
            this.undecryptableFrames.clear(undecryptableKey);
            // NOT awaited: dispatched after the state save above, so it cannot
            // extend this critical section. See dispatchInboxDelete.
            this.ackProcessedFrame(freshKeys.receiving_inbox, message.timestamp);
            return {
              outcome: 'ok' as const,
              content,
              sentAccept: true,
              updatedUserProfile:
                result.user_profile.user_address != self_address
                  ? result.user_profile
                  : undefined,
            };
          } catch (decryptError) {
            // Double Ratchet spec: on a decrypt/authentication failure, discard the
            // message but LEAVE the session state untouched — a single bad/duplicate/
            // out-of-order frame does not mean the session is broken, and later frames
            // decrypt fine. Destroying the session here was the root cause of the
            // long-standing "DM direction goes permanently dead" bug: the sender kept
            // encrypting to a session the receiver had torn down.
            // (https://signal.org/docs/specifications/doubleratchet/)
            // NOTE: a failing decrypt can carry the first 10 chars of the
            // PLAINTEXT in its message, echoed there by V8 when JSON.parse runs
            // on decrypted content. It is safe to pass the raw error here only
            // because quorum-shared's logger redacts it at the choke point when
            // logs are exposed in production. Do not "simplify" that away.
            // .agents/issues/.open/2026-08-17-decrypt-error-messages-leak-ten-characters-of-plaintext.md
            logger.error('[MessageService] DM decrypt failed (ConfirmDoubleRatchetSenderSession) — skipping frame, keeping session', decryptError);
            this.retainOrDropUndecryptableFrame(
              'Confirm',
              message,
              freshKeys.receiving_inbox
            );
            return { outcome: 'handled' as const };
          }
        } else {
          // Retry bookkeeping for the stale-bucket mitigation: set only when the
          // first decrypt failed and a pruned retry succeeded, so the bucket can
          // be re-filed into the state that gets persisted.
          let restore: { headerKey: string; bucket: Record<string, unknown> } | null = null;
          try {
            // A DM decrypt failure does NOT reject: the crate returns a result
            // whose `message` carries "Decryption failed: aead::Error", and
            // parseDecryptedMessage is what throws. So the stale-bucket retry has
            // to wrap BOTH calls — wrapping only the decrypt never fires.
            const decryptAndParse = async (row: unknown) => {
              const r = await secureChannel.DoubleRatchetInboxDecrypt(
                row as Parameters<typeof secureChannel.DoubleRatchetInboxDecrypt>[0],
                JSON.parse(message.encryptedContent)
              );
              return { result: r, content: parseDecryptedMessage(r.message, 'InboxDecrypt') };
            };

            let attempt: Awaited<ReturnType<typeof decryptAndParse>>;
            try {
              attempt = await decryptAndParse(JSON.parse(fresh.state));
            } catch (firstError) {
              // Upstream skipped-key lookup defect — see utils/dmStaleBucketRetry.ts.
              const stale = findStaleBucket(fresh.state);
              if (!stale) throw firstError;
              attempt = await decryptAndParse(stale.prunedRow);
              restore = { headerKey: stale.headerKey, bucket: stale.bucket };
              logger.warn(
                '[MessageService] DM frame recovered by pruning the stale skipped-keys bucket for the retry (upstream #183 item 1a)',
                { branch: 'InboxDecrypt', prunedKeys: Object.keys(stale.bucket).length }
              );
            }
            const result = attempt.result;
            const maybeInit = result as {
              receiving_inbox: secureChannel.InboxKeyset;
              user_profile: secureChannel.UserProfile;
              tag: any;
              sending_inbox: secureChannel.SendingInbox;
              ratchet_state: string;
              message: string;
            };

            let advancedState: string;
            // If the retry pruned a bucket to get here, put it back: those keys
            // are the ONLY way to read genuinely delayed frames, and persisting
            // the pruned state destroys them permanently (measured 3/3).
            const keep = (ratchetState: string) =>
              restore
                ? restoreStaleBucket(ratchetState, restore.headerKey, restore.bucket)
                : ratchetState;
            if (maybeInit.user_profile) {
              advancedState = JSON.stringify({
                ratchet_state: keep(maybeInit.ratchet_state),
                receiving_inbox: maybeInit.receiving_inbox,
                sending_inbox: maybeInit.sending_inbox,
                tag: maybeInit.tag,
              });
            } else {
              advancedState = JSON.stringify({
                ratchet_state: keep(result.ratchet_state),
                receiving_inbox: freshKeys.receiving_inbox,
                sending_inbox: freshKeys.sending_inbox,
                tag: freshKeys.tag,
              });
            }
            const content = attempt.content;
            if (content?.content?.type === 'delete-conversation') {
              logger.warn(
                '[MessageService] ⚠️ RESET SIGNAL received (delete-conversation, InboxDecrypt branch) — wiping encryption states',
                {
                  conversationId: conversationId?.slice(0, 16),
                  frameTimestamp: message.timestamp,
                  frameAgeSeconds: Math.round((Date.now() - message.timestamp) / 1000),
                }
              );
              await this.deleteEncryptionStates({ conversationId });
              // NOT awaited — dispatched after the state wipe above. This used to
              // rethrow; it no longer can, so its .catch is the only signal.
              this.dispatchInboxDelete(
                freshKeys.receiving_inbox,
                [message.timestamp],
                'delete-conversation reset signal (InboxDecrypt branch)'
              );
              return { outcome: 'handled' as const };
            }
            await this.messageDB.saveEncryptionState(
              {
                state: advancedState,
                timestamp: message.timestamp,
                inboxId: fresh.inboxId,
                sentAccept: fresh.sentAccept,
                conversationId,
              },
              true
            );
            this.undecryptableFrames.clear(undecryptableKey);
            // NOT awaited: dispatched after the state save above, so it cannot
            // extend this critical section. See dispatchInboxDelete.
            this.ackProcessedFrame(freshKeys.receiving_inbox, message.timestamp);
            return {
              outcome: 'ok' as const,
              content,
              sentAccept: fresh.sentAccept,
              // Carry the sender's identity through when the frame has it.
              // `user_profile` is only on the init-carrying variant of the
              // decrypt union (hence the guard above at `maybeInit.user_profile`),
              // but dropping it meant a DM partner's name/avatar could ONLY ever
              // be learned during session setup: once established, no amount of
              // traffic refreshed it, so a partner with no public profile stayed
              // on the placeholder forever. Mobile applies it on this same path
              // (quorum-mobile WebSocketContext.tsx, the same user_profile-carrying
              // branch that drives its `autoRevealOnInboundSession` call).
              // Self-address guard mirrors the Confirm branch: on a multi-device
              // self-echo the profile is OURS, and must not overwrite the
              // partner's conversation row.
              updatedUserProfile:
                maybeInit.user_profile &&
                maybeInit.user_profile.user_address != self_address
                  ? maybeInit.user_profile
                  : undefined,
            };
          } catch (decryptError) {
            // Double Ratchet spec: on a decrypt/authentication failure, discard the
            // message but LEAVE the session state untouched — a single bad/duplicate/
            // out-of-order frame does not mean the session is broken, and later frames
            // decrypt fine. Destroying the session here was the root cause of the
            // long-standing "DM direction goes permanently dead" bug: the sender kept
            // encrypting to a session the receiver had torn down.
            // (https://signal.org/docs/specifications/doubleratchet/)
            // See the plaintext-echo note at the sibling
            // ConfirmDoubleRatchetSenderSession catch above. This is the site
            // where that leak was actually measured.
            logger.error('[MessageService] DM decrypt failed (DoubleRatchetInboxDecrypt) — skipping frame, keeping session', decryptError);
            this.retainOrDropUndecryptableFrame(
              'InboxDecrypt',
              message,
              freshKeys.receiving_inbox
            );
            return { outcome: 'handled' as const };
          }
        }
      });
      if (dm.outcome !== 'ok') {
        return;
      }
      decryptedContent = dm.content;
      sentAccept = dm.sentAccept;
      updatedUserProfile = dm.updatedUserProfile;
      // `updatedUserProfile` is set only on the INIT-CARRYING variant of the
      // decrypt union (both branches guard on `user_profile`), so its presence
      // here IS "a new session from this partner appeared". The partner comes
      // from `conversationId`, which is the stored session's own binding — an
      // authenticated identifier, unlike the profile's self-declared
      // `user_address`.
      if (updatedUserProfile) {
        this.maybeAutoRevealToPartner(
          self_address,
          conversationId.split('/')[0],
          keyset
        );
      }
      // State already persisted inside the locked section — `newState` stays
      // null so the deferred tail save (space path) does not run for DMs.
    } else {
      const spaceFrameKey = frameKey(
        message.inboxAddress,
        message.encryptedContent
      );
      /**
       * Did we get the envelope OPEN? Everything after that point is
       * application handling, and a failure there will fail identically on a
       * retry — so only a failure BEFORE this flips is worth keeping the frame
       * for. See the catch at the end of this block.
       */
      let opened = false;
      try {
        const spaceId = conversationId.split('/')[0];
        const hub_key = await this.messageDB.getSpaceKey(spaceId, 'hub');
        const config_key = await this.messageDB.getSpaceKey(spaceId, 'config');
        if (config_key) {
          const pubBytes = hexToSpreadArray(config_key.publicKey);
          const privBytes = hexToSpreadArray(config_key.privateKey);
        }

        // Parse outer envelope to check type
        const outerEnvelope = JSON.parse(message.encryptedContent);
        let result: string;

        if (outerEnvelope.type === 'sync') {
          // Sync envelope - directed message using UnsealSyncEnvelope with config key
          logger.log(`[MessageService] Received sync envelope from ${outerEnvelope.inbox_address?.substring(0, 12) || 'unknown'}`);
          result = await secureChannel.UnsealSyncEnvelope(
            {
              type: 'ed448',
              public_key: hexToSpreadArray(hub_key.publicKey),
              private_key: hexToSpreadArray(hub_key.privateKey),
            },
            outerEnvelope,
            config_key
              ? {
                  type: 'x448' as const,
                  public_key: hexToSpreadArray(config_key.publicKey),
                  private_key: hexToSpreadArray(config_key.privateKey),
                }
              : undefined
          );
        } else {
          // Hub broadcast envelope - use UnsealHubEnvelope with config key
          result = Buffer.from(
            new Uint8Array(
              await secureChannel.UnsealHubEnvelope(
                {
                  type: 'ed448',
                  public_key: hexToSpreadArray(hub_key.publicKey),
                  private_key: hexToSpreadArray(hub_key.privateKey),
                },
                outerEnvelope,
                config_key
                  ? {
                      type: 'x448',
                      public_key: hexToSpreadArray(config_key.publicKey),
                      private_key: hexToSpreadArray(config_key.privateKey),
                    }
                  : undefined
              )
            )
          ).toString('utf-8');
        }

        // The envelope is open. From here on a failure is an application bug,
        // not a "we could not decrypt it yet" — retrying would fail the same
        // way, so the frame stops being a retry candidate and the tail cleanup
        // deletes it exactly as it always did.
        opened = true;
        this.undecryptableFrames.clear(spaceFrameKey);

        const envelope = JSON.parse(result);
        if (envelope.type === 'message') {
          // Intercept typing-start / typing-stop control messages BEFORE attempting
          // TripleRatchetDecrypt. Typing messages are sealed via the hub envelope only
          // (no Triple Ratchet wrap), so attempting TR-decrypt would fail. They also
          // don't match the isPlaintextMessage heuristic (no messageId / content).
          const innerMsg = envelope.message;
          const isTypingMessage = typeof innerMsg === 'object' &&
            innerMsg !== null &&
            (innerMsg.type === 'typing-start' || innerMsg.type === 'typing-stop');
          if (isTypingMessage) {
            if (this.typingService) {
              this.typingService.onTypingReceived(innerMsg as TypingMessage);
            }
            // ⚠️ ACK BEFORE RETURNING. This early return used to skip the tail,
            // which is the ONLY place a space frame is acked — so every typing
            // indicator ever received stayed on the relay and was re-pushed on
            // every `listen`, forever.
            //
            // MEASURED (`yarn harness space-typing`): after one reconnect, an
            // ordinary post was redelivered 0x and a typing frame 2x, in the
            // same run.
            //
            // `TypingService`'s 30s freshness filter already defends the UI
            // against this replay (see
            // `.agents/docs/features/messages/typing-indicators.md`), but it runs
            // AFTER the frame has been received and unsealed, so it does nothing
            // for the cost. And that cost is the thing that matters: queue DEPTH
            // is what decides whether a perishable control frame — a `sync-info`
            // reply, valid 30s — is read before it expires.
            //
            // Typing is high volume by design (one `typing-start` per 5s per
            // scope while composing), so an unbounded, ever-growing accumulation
            // of them is plausibly the largest single source of reconnect
            // backlog. See
            // `issues/.open/2026-08-03-a-typing-frame-is-never-acked-…`.
            const typingInboxKey = await this.messageDB.getSpaceKey(
              conversationId.split('/')[0],
              'inbox'
            );
            if (typingInboxKey) {
              this.ackSpaceFrame(
                typingInboxKey,
                message.timestamp,
                'processed typing indicator'
              );
            }
            return;
          }

          // Check if message is already plaintext (envelope-only encryption, no TR)
          // Plaintext messages have messageId, channelId, and content fields directly
          const isPlaintextMessage = typeof envelope.message === 'object' &&
            envelope.message !== null &&
            'messageId' in envelope.message &&
            'channelId' in envelope.message &&
            'content' in envelope.message;

          if (isPlaintextMessage) {
            // Message is already decrypted (envelope-only encryption path)
            logger.log(`[MessageService] Message is plaintext (envelope-only encryption)`);
            decryptedContent = envelope.message;
          } else {
            // Message is TR-encrypted, need to decrypt with Triple Ratchet (legacy path)
            // Log peer map and ratchet state info for debugging decryption issues
            const ratchetState = JSON.parse(keys.state);
            const peerIdMapKeys = Object.keys(ratchetState.peer_id_map || {});
            const idPeerMapKeys = Object.keys(ratchetState.id_peer_map || {});
            logger.log(`[MessageService] TripleRatchetDecrypt: peer_id_map has ${peerIdMapKeys.length} entries, id_peer_map has ${idPeerMapKeys.length} entries`);
            logger.log(`[MessageService] TripleRatchetDecrypt: id_peer_map keys: ${idPeerMapKeys.join(', ')}`);

            // Log critical ratchet state fields for debugging AEAD errors
            const dkgRatchet = ratchetState.dkg_ratchet ? JSON.parse(ratchetState.dkg_ratchet) : null;
            logger.log(`[MessageService] RECEIVER critical fields:`, {
              root_key: ratchetState.root_key,
              dkg_ratchet_id: dkgRatchet?.id,
              dkg_ratchet_total: dkgRatchet?.total,
              async_dkg_pubkey_exists: !!ratchetState.async_dkg_pubkey,
              receiving_group_key_exists: !!ratchetState.receiving_group_key,
              sending_chain_key_exists: !!ratchetState.sending_chain_key,
              receiving_chain_key_entries: Object.keys(ratchetState.receiving_chain_key || {}).length,
              receiving_chain_key_keys: Object.keys(ratchetState.receiving_chain_key || {}),
              envelope_sender: envelope.message?.sender,
            });

            const decryptResult = await secureChannel.TripleRatchetDecrypt(
              JSON.stringify({
                ratchet_state: keys.state,
                envelope: JSON.stringify(envelope.message),
              })
            );
            logger.log(`[MessageService] TripleRatchetDecrypt result length: ${decryptResult?.length || 0}`);
            logger.log(`[MessageService] TripleRatchetDecrypt raw result: ${decryptResult}`);

            const decrypted = JSON.parse(decryptResult);
            logger.log(`[MessageService] TripleRatchetDecrypt parsed:`, JSON.stringify(decrypted).substring(0, 200));

            if (!decrypted.message || decrypted.message.length === 0) {
              throw new Error('Decryption returned empty message');
            }

            const output = Buffer.from(
              new Uint8Array(decrypted.message)
            ).toString('utf-8');
            logger.log(`[MessageService] Decrypted output length: ${output.length}, first 100 chars: ${output.substring(0, 100)}`);

            if (!output || output.trim().length === 0) {
              throw new Error('Decryption produced empty output');
            }

            decryptedContent = JSON.parse(output);
          }

          if (decryptedContent) {
            const space = await this.messageDB.getSpace(
              conversationId.split('/')[0]
            );

            // Verify signatures for non-repudiable spaces (all types) AND for
            // control messages in ANY space — control auth must not depend on
            // repudiability, or a repudiable space would skip the gate.
            //
            // ⚠️ VESTIGIAL as an AUTHORIZATION gate. No auth decision depends on
            // this block any more: every one re-verifies at its own call site
            // via `verifySpaceSender`, which fails closed independently. What
            // this still does is strip an unverifiable signature off the stored
            // row (and drop update-profile below), which the display layer
            // reads. Note it fingerprints the WIRE scope, the pattern the auth
            // paths deliberately moved away from — harmless here because
            // nothing authorizes on the result, but do not copy it, and do not
            // assume auth is relying on it.
            if (
              space &&
              decryptedContent.publicKey &&
              decryptedContent.signature &&
              (!space.isRepudiable ||
                isControlMessageType(decryptedContent.content.type) ||
                decryptedContent.mentions?.everyone === true)
            ) {
              const participant = await this.messageDB.getSpaceMember(
                space.spaceId,
                decryptedContent.content.senderId
              );
              const sh = await sha256.digest(
                Buffer.from(decryptedContent.publicKey, 'hex')
              );
              const inboxAddress = base58btc.baseEncode(sh.bytes);
              const messageId = await crypto.subtle.digest(
                'SHA-256',
                Buffer.from(
                  buildMessageFingerprint({
                    nonce: decryptedContent.nonce,
                    content: decryptedContent.content as any,
                    senderId: decryptedContent.content.senderId,
                    spaceId: decryptedContent.spaceId,
                    channelId: decryptedContent.channelId,
                  }),
                  'utf-8'
                )
              );
              // For update-profile: inbox address changes are legitimate (key rotation).
              // The message IS the key rotation announcement, so skip inbox mismatch check.
              // For all other types: inbox mismatch invalidates the signature.
              const isUpdateProfile = decryptedContent.content.type === 'update-profile';
              // participant may be null: the sender's join broadcast never
              // reached us, so there is no space_members row yet (common — see
              // 2026-06-13-space-members-missing-no-join-row.md under .agents/issues/).
              // Optional-chain the deref; a missing inbox_address means we have
              // nothing to compare against, so there is no mismatch to flag and
              // the signature is verified below as normal. Without the guard
              // this threw a TypeError that the outer catch swallowed, silently
              // dropping the message on non-repudiable spaces.
              // A signing key not matching the member's join binding is still
              // valid if it's an admitted per-device key (multi-device). Only
              // consult the device store when there IS a mismatch, so the common
              // single-key path pays nothing.
              const joinMismatch =
                !isUpdateProfile &&
                participant?.inbox_address !== inboxAddress &&
                !!participant?.inbox_address;
              const inboxMismatch =
                joinMismatch &&
                !(await this.isAdmittedDeviceKey(
                  space.spaceId,
                  decryptedContent.content.senderId,
                  inboxAddress
                ));
              const messageIdMismatch =
                decryptedContent.messageId !==
                Buffer.from(messageId).toString('hex');

              if (inboxMismatch || messageIdMismatch) {
                logger.warn(t`invalid address for signature`);
                decryptedContent.publicKey = undefined;
                decryptedContent.signature = undefined;
              } else {
                if (
                  ch.js_verify_ed448(
                    Buffer.from(decryptedContent.publicKey, 'hex').toString(
                      'base64'
                    ),
                    Buffer.from(messageId).toString('base64'),
                    Buffer.from(decryptedContent.signature, 'hex').toString(
                      'base64'
                    )
                  ) !== 'true'
                ) {
                  logger.warn('invalid signature');
                  decryptedContent.publicKey = undefined;
                  decryptedContent.signature = undefined;
                }
              }
            }

          if (
              decryptedContent?.content.type === 'update-profile' &&
              (!decryptedContent?.publicKey || !decryptedContent?.signature)
            ) {
              decryptedContent = null;
            }
          }
        } else if (envelope.type === 'control') {
          logger.log(`[MessageService] Control message received: ${envelope.message?.type}`);
          const exteriorEnvelope = JSON.parse(message.encryptedContent);
          if (envelope.message.type === 'join') {
            const participant = envelope.message.participant;
            const pointResult = ch.js_verify_point(
              JSON.stringify({
                ratchet_state: keys.state,
                point: participant.pubKey,
                index: participant.id,
              })
            );
            if (pointResult === 'true') {
              const msg = Buffer.from(
                participant.address +
                  participant.id +
                  participant.inboxAddress +
                  participant.pubKey +
                  participant.inboxKey +
                  participant.identityKey +
                  participant.preKey +
                  participant.userIcon +
                  participant.displayName +
                  participant.joinedAt,
                'utf-8'
              ).toString('base64');
              const result = ch.js_verify_ed448(
                Buffer.from(participant.inboxPubKey, 'hex').toString('base64'),
                msg,
                participant.signature
              );
              if (result === 'true') {
                this.messageDB.saveSpaceMember(
                  conversationId.split('/')[0],
                  buildJoinedMemberRow(participant)
                );
                await queryClient.setQueryData(
                  buildSpaceMembersKey({
                    spaceId: conversationId.split('/')[0],
                  }),
                  (oldData: (secureChannel.UserProfile & { joinedAt?: number })[]) => {
                    return [
                      ...(oldData ?? []),
                      // Same slots as the DB write above. Patching the override
                      // slot here instead would leave the cache and IndexedDB
                      // disagreeing about a new joiner until the next refetch.
                      {
                        user_address: participant.address,
                        global_user_icon: participant.userIcon,
                        global_display_name: participant.displayName,
                        globalProfileTimestamp: participant.joinedAt,
                        joinedAt: participant.joinedAt,
                      },
                    ];
                  }
                );
                const ratchet = JSON.parse(keys.state);
                ratchet.id_peer_map = {
                  ...ratchet.id_peer_map,
                  [participant.id]: {
                    public_key: Buffer.from(
                      participant.inboxKey,
                      'hex'
                    ).toString('base64'),
                    identity_public_key: Buffer.from(
                      participant.identityKey,
                      'hex'
                    ).toString('base64'),
                    signed_pre_public_key: Buffer.from(
                      participant.preKey,
                      'hex'
                    ).toString('base64'),
                  },
                };
                ratchet.peer_id_map = {
                  ...ratchet.peer_id_map,
                  [Buffer.from(participant.inboxKey, 'hex').toString('base64')]:
                    participant.id,
                };
                newState = JSON.stringify({
                  ...keys,
                  state: JSON.stringify(ratchet),
                });
                const space = await this.messageDB.getSpace(
                  conversationId.split('/')[0]
                );
                // Member row + ratchet state are already persisted above. The
                // "X joined" system message needs the space's default channel, so
                // skip it if the space row is missing (guards a null-deref under
                // replay) rather than throwing past the rest of the handler.
                if (space) {
                  const messageId = await crypto.subtle.digest(
                    'SHA-256',
                    Buffer.from('join' + participant.inboxAddress, 'utf-8')
                  );
                  const msg = {
                    channelId: space.defaultChannelId,
                    spaceId: conversationId.split('/')[0],
                    messageId: Buffer.from(messageId).toString('hex'),
                    digestAlgorithm: 'SHA-256',
                    nonce: Buffer.from(messageId).toString('hex'),
                    createdDate: participant.joinedAt ?? Date.now(),
                    modifiedDate: participant.joinedAt ?? Date.now(),
                    lastModifiedHash: '',
                    content: {
                      senderId: participant.address,
                      type: 'join',
                    } as JoinMessage,
                  } as Message;
                  await this.saveMessage(
                    msg,
                    this.messageDB,
                    conversationId.split('/')[0],
                    space.defaultChannelId,
                    'group',
                    {},
                    null, // space message — the DM reveal ledger does not read these
                    undefined
                  );
                  await this.addMessage(
                    queryClient,
                    conversationId.split('/')[0],
                    space.defaultChannelId,
                    msg
                  );
                }
              }
            } else {
              console.error(pointResult);
            }
          } else if (envelope.message.type === 'sync-peer-map') {
            let reg = this.spaceInfo.current[conversationId.split('/')[0]];
            if (!reg) {
              reg = (
                await this.apiClient.getSpace(conversationId.split('/')[0])
              ).data;
              this.spaceInfo.current[conversationId.split('/')[0]] = reg;
            }

            if (
              reg.owner_public_keys.includes(
                exteriorEnvelope.owner_public_key
              ) ||
              this.syncInfo.current[conversationId.split('/')[0]]
            ) {
              const verify = JSON.parse(
                ch.js_verify_ed448(
                  Buffer.from(
                    exteriorEnvelope.owner_public_key,
                    'hex'
                  ).toString('base64'),
                  Buffer.from(exteriorEnvelope.envelope, 'utf-8').toString(
                    'base64'
                  ),
                  Buffer.from(exteriorEnvelope.owner_signature, 'hex').toString(
                    'base64'
                  )
                )
              );
              if (verify) {
                const ratchet = JSON.parse(keys.state);
                const incomingIdPeerMap = envelope.message.peerMap.id_peer_map || {};
                const incomingPeerIdMap = envelope.message.peerMap.peer_id_map || {};

                // MERGE peer maps instead of replacing - preserve our own entries
                // This is critical when syncing with a peer that doesn't have us in their map yet
                const existingIdPeerMap = ratchet.id_peer_map || {};
                const existingPeerIdMap = ratchet.peer_id_map || {};

                logger.log(`[MessageService] sync-peer-map: Merging peer maps`);
                logger.log(`[MessageService] sync-peer-map: Existing id_peer_map has ${Object.keys(existingIdPeerMap).length} entries`);
                logger.log(`[MessageService] sync-peer-map: Incoming id_peer_map has ${Object.keys(incomingIdPeerMap).length} entries`);

                ratchet.id_peer_map = {
                  ...existingIdPeerMap,
                  ...incomingIdPeerMap,
                };
                ratchet.peer_id_map = {
                  ...existingPeerIdMap,
                  ...incomingPeerIdMap,
                };

                logger.log(`[MessageService] sync-peer-map: Merged id_peer_map now has ${Object.keys(ratchet.id_peer_map).length} entries`);

                // Sync critical ratchet state fields for decryption to work
                const peerMap = envelope.message.peerMap;
                logger.log(`[MessageService] sync-peer-map: Received peerMap keys: ${Object.keys(peerMap).join(', ')}`);
                logger.log(`[MessageService] sync-peer-map: peerMap.root_key exists: ${!!peerMap.root_key}, peerMap.dkg_ratchet exists: ${!!peerMap.dkg_ratchet}`);
                if (peerMap.root_key) {
                  logger.log(`[MessageService] sync-peer-map: Updating root_key from ${ratchet.root_key?.substring(0, 20)} to ${peerMap.root_key?.substring(0, 20)}`);
                  ratchet.root_key = peerMap.root_key;
                }
                if (peerMap.dkg_ratchet) {
                  logger.log(`[MessageService] sync-peer-map: Updating dkg_ratchet`);
                  ratchet.dkg_ratchet = peerMap.dkg_ratchet;
                  ratchet.next_dkg_ratchet = peerMap.dkg_ratchet; // Keep in sync
                }
                if (peerMap.receiving_group_key) {
                  ratchet.receiving_group_key = peerMap.receiving_group_key;
                }
                if (peerMap.receiving_chain_key) {
                  logger.log(`[MessageService] sync-peer-map: Updating receiving_chain_key`);
                  ratchet.receiving_chain_key = peerMap.receiving_chain_key;
                }
                if (peerMap.current_header_key) {
                  ratchet.current_header_key = peerMap.current_header_key;
                }
                if (peerMap.next_header_key) {
                  ratchet.next_header_key = peerMap.next_header_key;
                }
                if (peerMap.async_dkg_pubkey) {
                  ratchet.async_dkg_pubkey = peerMap.async_dkg_pubkey;
                }
                if (peerMap.threshold) {
                  ratchet.threshold = peerMap.threshold;
                }

                newState = JSON.stringify({
                  ...keys,
                  state: JSON.stringify(ratchet),
                });
              }
            }
          } else if (envelope.message.type === 'space-manifest') {
            let reg = this.spaceInfo.current[conversationId.split('/')[0]];
            if (!reg) {
              reg = (
                await this.apiClient.getSpace(conversationId.split('/')[0])
              ).data;
              this.spaceInfo.current[conversationId.split('/')[0]] = reg;
            }
            const manifest = envelope.message
              .manifest as secureChannel.SpaceManifest;
            if (reg.owner_public_keys.includes(manifest.owner_public_key)) {
              const verify = JSON.parse(
                ch.js_verify_ed448(
                  Buffer.from(manifest.owner_public_key, 'hex').toString(
                    'base64'
                  ),
                  Buffer.from(
                    new Uint8Array([
                      ...new Uint8Array(
                        Buffer.from(manifest.space_manifest, 'utf-8')
                      ),
                      ...int64ToBytes(manifest.timestamp),
                    ])
                  ).toString('base64'),
                  Buffer.from(manifest.owner_signature, 'hex').toString(
                    'base64'
                  )
                )
              );
              if (verify) {
                const ciphertext = JSON.parse(manifest.space_manifest) as {
                  ciphertext: string;
                  initialization_vector: string;
                  associated_data: string;
                };
                const config_key = await this.messageDB.getSpaceKey(
                  conversationId.split('/')[0],
                  'config'
                );
                const space = JSON.parse(
                  Buffer.from(
                    JSON.parse(
                      ch.js_decrypt_inbox_message(
                        JSON.stringify({
                          inbox_private_key: [
                            ...new Uint8Array(
                              Buffer.from(config_key.privateKey, 'hex')
                            ),
                          ],
                          ephemeral_public_key: [
                            ...new Uint8Array(
                              Buffer.from(manifest.ephemeral_public_key, 'hex')
                            ),
                          ],
                          ciphertext: ciphertext,
                        })
                      )
                    )
                  ).toString('utf-8')
                ) as Space;

                // Validate inbound spaceTag before persisting (defense-in-depth)
                // Rejects SVG data URIs (XSS vector) and oversized payloads
                if (space.spaceTag) {
                  if (
                    !validateSpaceTagLetters(space.spaceTag.letters) ||
                    !isValidSpaceTagUrl(space.spaceTag.url)
                  ) {
                    space.spaceTag = undefined;
                  }
                }

                await this.messageDB.saveSpace(space);
                await queryClient.setQueryData(
                  buildSpaceKey({ spaceId: conversationId.split('/')[0] }),
                  () => {
                    return space;
                  }
                );
                // Also update the spaces list cache so components using useSpaces/buildSpacesKey
                // (e.g., UserSettingsModal tag preview) reflect the updated space data
                queryClient.setQueryData(
                  buildSpacesKey({}),
                  (oldSpaces: Space[] | undefined) => {
                    if (!oldSpaces) return oldSpaces;
                    return oldSpaces.map((s) =>
                      s.spaceId === space.spaceId ? space : s
                    );
                  }
                );

                // Auto re-broadcast profile if this space's tag is the one we display
                try {
                  await this.rebroadcastTagIfChanged(
                    space,
                    self_address,
                    keyset,
                    queryClient
                  );
                } catch (err) {
                  logger.error('Failed to re-broadcast space tag on manifest update', err);
                }
              }
            }
          } else if (envelope.message.type === 'leave') {
            const hubKey = await this.messageDB.getSpaceKey(
              conversationId.split('/')[0],
              'hub'
            );

            const verify = JSON.parse(
              ch.js_verify_ed448(
                Buffer.from(envelope.message.inboxPublicKey, 'hex').toString(
                  'base64'
                ),
                Buffer.from(
                  new Uint8Array([
                    ...new Uint8Array(
                      Buffer.from('delete' + hubKey.publicKey, 'utf-8')
                    ),
                  ])
                ).toString('base64'),
                Buffer.from(envelope.message.inboxSignature, 'hex').toString(
                  'base64'
                )
              )
            );
            const sh = await sha256.digest(
              Buffer.from(envelope.message.inboxPublicKey, 'hex')
            );
            const inboxAddress = base58btc.baseEncode(sh.bytes);
            if (verify) {
              const members = await this.messageDB.getSpaceMembers(
                conversationId.split('/')[0]
              );
              for (const member of members) {
                if (member.inbox_address == inboxAddress) {
                  await this.messageDB.saveSpaceMember(
                    conversationId.split('/')[0],
                    { ...member, inbox_address: '' }
                  );
                  await queryClient.setQueryData(
                    buildSpaceMembersKey({
                      spaceId: conversationId.split('/')[0],
                    }),
                    (
                      oldData: (secureChannel.UserProfile & {
                        inbox_address: string;
                        isKicked?: boolean;
                      })[]
                    ) => {
                      const previous = oldData ?? [];
                      return previous.map((m) =>
                        m.user_address === member.user_address
                          ? { ...m, inbox_address: '' }
                          : m
                      );
                    }
                  );
                  const space = await this.messageDB.getSpace(
                    conversationId.split('/')[0]
                  );

                  // No space row locally → tombstone above already applied; we
                  // can't build the "X left" system message without the space's
                  // default channel, so skip it (guards a null-deref under replay).
                  if (space) {
                    // Remove leaving user from all roles
                    space.roles = space.roles.map((role) => ({
                      ...role,
                      members: role.members.filter(
                        (m) => m !== member.user_address
                      ),
                    }));
                    await this.messageDB.saveSpace(space);

                    const messageId = await crypto.subtle.digest(
                      'SHA-256',
                      Buffer.from('leave' + member.inbox_address, 'utf-8')
                    );
                    const msg = {
                      channelId: space.defaultChannelId,
                      spaceId: conversationId.split('/')[0],
                      messageId: Buffer.from(messageId).toString('hex'),
                      digestAlgorithm: 'SHA-256',
                      nonce: Buffer.from(messageId).toString('hex'),
                      createdDate: Date.now(),
                      modifiedDate: Date.now(),
                      lastModifiedHash: '',
                      content: {
                        senderId: member.user_address,
                        type: 'leave',
                      } as LeaveMessage,
                    } as Message;
                    await this.saveMessage(
                      msg,
                      this.messageDB,
                      conversationId.split('/')[0],
                      space.defaultChannelId,
                      'group',
                      {},
                      null, // space message — the DM reveal ledger does not read these
                      undefined
                    );
                    await this.addMessage(
                      queryClient,
                      conversationId.split('/')[0],
                      space.defaultChannelId,
                      msg
                    );
                  }
                  break;
                }
              }
            }
          } else if (envelope.message.type === 'rekey') {
            let reg = this.spaceInfo.current[conversationId.split('/')[0]];
            if (!reg) {
              reg = (
                await this.apiClient.getSpace(conversationId.split('/')[0])
              ).data;
              this.spaceInfo.current[conversationId.split('/')[0]] = reg;
            }
            if (
              reg.owner_public_keys.includes(exteriorEnvelope.owner_public_key)
            ) {
              const verify = JSON.parse(
                ch.js_verify_ed448(
                  Buffer.from(
                    exteriorEnvelope.owner_public_key,
                    'hex'
                  ).toString('base64'),
                  Buffer.from(exteriorEnvelope.envelope, 'utf-8').toString(
                    'base64'
                  ),
                  Buffer.from(exteriorEnvelope.owner_signature, 'hex').toString(
                    'base64'
                  )
                )
              );
              if (verify) {
                const info = JSON.parse(envelope.message.info);
                const inner_envelope = JSON.parse(
                  Buffer.from(
                    new Uint8Array(
                      await secureChannel.UnsealInboxEnvelope(
                        keyset.deviceKeyset.inbox_keyset.inbox_encryption_key
                          .private_key,
                        info
                      )
                    )
                  ).toString('utf-8')
                );
                const configPub = Buffer.from(
                  JSON.parse(
                    ch.js_get_pubkey_x448(
                      Buffer.from(inner_envelope.configKey, 'hex').toString(
                        'base64'
                      )
                    )
                  ),
                  'base64'
                ).toString('hex');
                await this.messageDB.saveSpaceKey({
                  spaceId: conversationId.split('/')[0],
                  keyId: 'config',
                  privateKey: inner_envelope.configKey,
                  publicKey: configPub,
                });
                const template = JSON.parse(inner_envelope.state);
                template.peer_key = Buffer.from(
                  new Uint8Array(
                    keyset.deviceKeyset.inbox_keyset.inbox_encryption_key.private_key
                  )
                ).toString('base64');
                newState = JSON.stringify({
                  ...keys,
                  state: JSON.stringify(template),
                });
                const space = await this.messageDB.getSpace(
                  conversationId.split('/')[0]
                );
                // The "X was kicked" system message needs the space's default
                // channel; require space so a missing row doesn't null-deref
                // under replay (matches the space?.inviteUrl guard just below).
                if (envelope.message.kick && space) {
                  const messageId = await crypto.subtle.digest(
                    'SHA-256',
                    Buffer.from('kick' + envelope.message.kick, 'utf-8')
                  );
                  const msg = {
                    channelId: space.defaultChannelId,
                    spaceId: conversationId.split('/')[0],
                    messageId: Buffer.from(messageId).toString('hex'),
                    digestAlgorithm: 'SHA-256',
                    nonce: Buffer.from(messageId).toString('hex'),
                    createdDate: Date.now(),
                    modifiedDate: Date.now(),
                    lastModifiedHash: '',
                    content: {
                      senderId: envelope.message.kick,
                      type: 'kick',
                    } as KickMessage,
                  } as Message;
                  await this.saveMessage(
                    msg,
                    this.messageDB,
                    conversationId.split('/')[0],
                    space.defaultChannelId,
                    'group',
                    {},
                    null, // space message — the DM reveal ledger does not read these
                    undefined
                  );
                  await this.addMessage(
                    queryClient,
                    conversationId.split('/')[0],
                    space.defaultChannelId,
                    msg
                  );
                }

                if (space?.inviteUrl) {
                  space.inviteUrl = `${getInviteUrlBase(true)}#spaceId=${space.spaceId}&configKey=${inner_envelope.configKey}`;
                  await this.messageDB.saveSpace(space);
                }
              }
            }
          } else if (envelope.message.type === 'kick') {
            let reg = this.spaceInfo.current[conversationId.split('/')[0]];
            if (!reg) {
              reg = (
                await this.apiClient.getSpace(conversationId.split('/')[0])
              ).data;
              this.spaceInfo.current[conversationId.split('/')[0]] = reg;
            }
            if (
              reg.owner_public_keys.includes(exteriorEnvelope.owner_public_key)
            ) {
              const verify = JSON.parse(
                ch.js_verify_ed448(
                  Buffer.from(
                    exteriorEnvelope.owner_public_key,
                    'hex'
                  ).toString('base64'),
                  Buffer.from(exteriorEnvelope.envelope, 'utf-8').toString(
                    'base64'
                  ),
                  Buffer.from(exteriorEnvelope.owner_signature, 'hex').toString(
                    'base64'
                  )
                )
              );
              if (verify) {
                if (envelope.message.kick === self_address) {
                  const spaceId = conversationId.split('/')[0];
                  try {
                    const space = await this.messageDB.getSpace(spaceId);
                    showWarning(
                      `You've been kicked from ${space?.spaceName || spaceId}`
                    );
                  } catch (e) { console.error('[MessageService] Error getting space for kick warning:', e); }
                  // Immediately navigate away from the space view when kicked
                  this.navigate('/messages', {
                    replace: true,
                    state: { from: 'kicked', spaceId },
                  });
                  const hubKey = await this.messageDB.getSpaceKey(
                    spaceId,
                    'hub'
                  );
                  const inboxKey = await this.messageDB.getSpaceKey(
                    spaceId,
                    'inbox'
                  );
                  await this.apiClient.postHubDelete({
                    hub_address: hubKey.address!,
                    hub_public_key: hubKey.publicKey,
                    hub_signature: Buffer.from(
                      JSON.parse(
                        ch.js_sign_ed448(
                          Buffer.from(hubKey.privateKey, 'hex').toString(
                            'base64'
                          ),
                          Buffer.from(
                            new Uint8Array([
                              ...new Uint8Array(
                                Buffer.from(
                                  'delete' + inboxKey.publicKey,
                                  'utf-8'
                                )
                              ),
                            ])
                          ).toString('base64')
                        )
                      ),
                      'base64'
                    ).toString('hex'),
                    inbox_public_key: inboxKey.publicKey,
                    inbox_signature: Buffer.from(
                      JSON.parse(
                        ch.js_sign_ed448(
                          Buffer.from(inboxKey.privateKey, 'hex').toString(
                            'base64'
                          ),
                          Buffer.from(
                            new Uint8Array([
                              ...new Uint8Array(
                                Buffer.from(
                                  'delete' + hubKey.publicKey,
                                  'utf-8'
                                )
                              ),
                            ])
                          ).toString('base64')
                        )
                      ),
                      'base64'
                    ).toString('hex'),
                  });
                  const states = await this.messageDB.getEncryptionStates({
                    conversationId: spaceId + '/' + spaceId,
                  });
                  for (const state of states) {
                    await this.messageDB.deleteEncryptionState(state);
                  }
                  const messages = await this.messageDB.getAllSpaceMessages({
                    spaceId,
                  });
                  for (const message of messages) {
                    await this.messageDB.deleteMessage(message.messageId);
                  }
                  const members = await this.messageDB.getSpaceMembers(spaceId);
                  for (const member of members) {
                    await this.messageDB.deleteSpaceMember(
                      spaceId,
                      member.user_address
                    );
                  }
                  const keys = await this.messageDB.getSpaceKeys(spaceId);
                  for (const key of keys) {
                    await this.messageDB.deleteSpaceKey(spaceId, key.keyId);
                  }
                  let userConfig = await this.messageDB.getUserConfig({
                    address: self_address,
                  });
                  userConfig = {
                    ...(userConfig ?? { address: self_address }),
                    spaceIds: [
                      ...(userConfig?.spaceIds.filter((s) => s != spaceId) ??
                        []),
                    ],
                  };
                  await this.saveConfig({ config: userConfig, keyset });
                  await queryClient.setQueryData(
                    buildConfigKey({ userAddress: self_address }),
                    () => userConfig
                  );
                  // Deletion and departure record in ONE transaction. Without
                  // the record a later backup restore re-adds the Space and
                  // calls postHubAdd, so a kicked user re-announces to the
                  // Space that removed them — the same class of mistake as the
                  // convergence timer below, delayed until they restore. Two
                  // sequential writes would leave a crash window that produces
                  // exactly that state; see deleteSpaceAsDeparture.
                  await this.messageDB.deleteSpaceAsDeparture({
                    spaceId,
                    reason: 'removed',
                  });
                  // The space is gone from under us. Any armed convergence
                  // timer would fire ~20s from now against a deleted space and
                  // broadcast a sync-request into a space we were just removed
                  // from.
                  this.forgetRosterConvergence(spaceId);
                  return;
                }
                // If someone else was kicked, mark them inactive locally
                if (
                  envelope.message.kick &&
                  envelope.message.kick !== self_address
                ) {
                  const spaceId = conversationId.split('/')[0];
                  const kickedAddress = envelope.message.kick;
                  const kicked = await this.messageDB.getSpaceMember(
                    spaceId,
                    kickedAddress
                  );
                  // Upsert: persist the inactive tombstone even if we never had a
                  // row for them, so a replayed kick can't leave them renderable.
                  await this.messageDB.saveSpaceMember(spaceId, {
                    ...(kicked ?? { user_address: kickedAddress }),
                    inbox_address: '',
                  });
                  await queryClient.setQueryData(
                    buildSpaceMembersKey({ spaceId }),
                    (
                      oldData: (secureChannel.UserProfile & {
                        inbox_address: string;
                      })[]
                    ) => {
                      const previous = oldData ?? [];
                      return previous.map((m) =>
                        m.user_address === kickedAddress
                          ? { ...m, inbox_address: '' }
                          : m
                      );
                    }
                  );
                }
              }
            }
          } else if (envelope.message.type === 'sync') {
            await this.synchronizeAll(
              conversationId.split('/')[0],
              envelope.message.inboxAddress
            );
          } else if (envelope.message.type === 'sync-request') {
            // Get our inbox to check if this is our own request
            const ourInboxKey = await this.messageDB.getSpaceKey(conversationId.split('/')[0], 'inbox');
            const isOurOwnRequest = envelope.message.inboxAddress === ourInboxKey?.address;
            logger.log(`[MessageService] sync-request from: ${envelope.message.inboxAddress?.substring(0, 12)}, ourInbox: ${ourInboxKey?.address?.substring(0, 12)}, isOurOwn: ${isOurOwnRequest}, expiry: ${envelope.message.expiry}, now: ${Date.now()}`);
            if (isOurOwnRequest) {
              logger.log(`[MessageService] sync-request: Ignoring our own broadcast`);
            } else if (envelope.message.expiry > Date.now()) {
              logger.log(`[MessageService] sync-request: Calling informSyncData`);
              await this.informSyncData(
                conversationId.split('/')[0],
                envelope.message.inboxAddress,
                envelope.message.messageCount,
                envelope.message.memberCount,
                envelope.message.summary // New protocol: pass summary for hash-based comparison
              );
            } else {
              logger.log(`[MessageService] sync-request: Expired, ignoring`);
            }
          } else if (envelope.message.type === 'sync-info') {
            const spaceId = conversationId.split('/')[0];
            const hasSession = !!this.syncInfo.current[spaceId];
            const sessionExpiry = this.syncInfo.current[spaceId]?.expiry;
            const isExpired = sessionExpiry ? sessionExpiry <= Date.now() : true;
            logger.log(`[MessageService] sync-info from: ${envelope.message.inboxAddress?.substring(0, 12)}, hasSession: ${hasSession}, sessionExpiry: ${sessionExpiry}, isExpired: ${isExpired}`);
            logger.log(`[MessageService] sync-info payload:`, {
              inboxAddress: envelope.message.inboxAddress?.substring(0, 12),
              messageCount: envelope.message.messageCount,
              memberCount: envelope.message.memberCount,
              hasSummary: !!envelope.message.summary,
            });
            // ⚠️ These two calls sit OUTSIDE the session gate below, and that
            // placement is the entire point of them. They were INSIDE it until
            // 2026-08-03, which left the convergence check disarmed in exactly
            // the case it was built to repair.
            //
            // What a peer advertises is true whether or not our own request
            // window is still open. The gate below answers a different
            // question — "may we sync FROM this offer, in THIS session?" — and
            // it is still right to answer that with the expiry. But learning
            // what is out there is not acting on the offer, and it does not
            // need permission from a window we opened.
            //
            // Measured 2026-08-02 against a 300-message reconnect backlog:
            // twelve `sync-info` frames arrived, every one advertising 80
            // members, and every one fell to the `else` branch on
            // `isExpired: true` — the inbound queue took longer to drain than
            // the 30s window. With these calls inside the gate the tracker
            // learned nothing, no check was ever armed, and the client sat on
            // 1 row of 80 with nothing left to try. The roster landed 0/2 that
            // way, and 2/2 when the same request was simply made again once the
            // flood had drained. The request was never wrong; only its timing
            // was, which is why re-asking is the whole repair.
            //
            // See 2026-08-02-sync-requests-arrive-four-minutes-late-and-every-peer-rejects-them.md
            // under .agents/issues/ (filed by state, so grep the name — it moves).
            const learnedTarget = this.rosterConvergence.noteAdvertisedRoster(
              spaceId,
              envelope.message.memberCount ?? envelope.message.summary?.memberCount
            );
            if (learnedTarget) this.scheduleRosterConvergenceCheck(spaceId);

            if (hasSession && !isExpired) {
              if (
                envelope.message.inboxAddress &&
                (envelope.message.messageCount || envelope.message.summary)
              ) {
                logger.log(`[MessageService] sync-info: Adding candidate and scheduling sync`);
                this.syncInfo.current[spaceId].candidates.push(envelope.message);
                // reset the timeout to be 1s to more aggressively grab viable candidates for sync instead of waiting the full 30s
                clearTimeout(this.syncInfo.current[spaceId].invokable);
                this.syncInfo.current[spaceId].invokable =
                  setTimeout(
                    () => this.initiateSync(spaceId),
                    1000
                  );
              } else {
                logger.log(`[MessageService] sync-info: Missing inboxAddress or counts, ignoring`);
              }
            } else {
              // NOT "ignoring" any more, and the wording matters to whoever
              // reads this log next: we cannot sync from this offer, but we
              // have banked what it advertised and a re-ask is pending.
              logger.log(
                `[MessageService] sync-info: No active session or expired — cannot sync from ` +
                  `this offer, roster check armed: ${learnedTarget}`
              );
            }
          } else if (envelope.message.type === 'sync-initiate') {
            logger.log(`[MessageService] sync-initiate received from: ${envelope.message.inboxAddress?.substring(0, 12)}`);
            logger.log(`[MessageService] sync-initiate has manifest: ${!!envelope.message.manifest}`);
            if (envelope.message.inboxAddress) {
              // Check if new protocol (has manifest) or legacy
              if (envelope.message.manifest) {
                // New protocol: respond with manifest
                logger.log(`[MessageService] sync-initiate: Using new protocol, calling handleSyncInitiateV2`);
                await this.handleSyncInitiateV2(
                  conversationId.split('/')[0],
                  envelope.message
                );
              } else {
                // Legacy: send raw data
                await this.directSync(
                  conversationId.split('/')[0],
                  envelope.message
                );
              }
            }
          } else if (envelope.message.type === 'sync-members') {
            let reg = this.spaceInfo.current[conversationId.split('/')[0]];
            if (!reg) {
              reg = (
                await this.apiClient.getSpace(conversationId.split('/')[0])
              ).data;
              this.spaceInfo.current[conversationId.split('/')[0]] = reg;
            }

            if (
              reg.owner_public_keys.includes(
                exteriorEnvelope.owner_public_key
              ) ||
              this.syncInfo.current[conversationId.split('/')[0]]
            ) {
              const verify = JSON.parse(
                ch.js_verify_ed448(
                  Buffer.from(
                    exteriorEnvelope.owner_public_key,
                    'hex'
                  ).toString('base64'),
                  Buffer.from(exteriorEnvelope.envelope, 'utf-8').toString(
                    'base64'
                  ),
                  Buffer.from(exteriorEnvelope.owner_signature, 'hex').toString(
                    'base64'
                  )
                )
              );
              if (verify) {
                for (const member of envelope.message.members) {
                  // A peer is never authoritative about OUR per-space name.
                  // This LEGACY sync-members path writes rows verbatim, with no
                  // timestamp comparison at all, so without this a peer holding
                  // an old copy of our row — including one on an un-migrated
                  // build — pushes it straight back and bypasses the whole
                  // self-authorship model. Same rule as resolveSyncDeltaSlots
                  // applies on the modern delta path.
                  const isSelfRow =
                    (member as any).user_address === self_address;
                  const incoming = isSelfRow
                    ? (() => {
                        const {
                          display_name: _dropName,
                          user_icon: _dropIcon,
                          profileTimestamp: _dropTs,
                          ...rest
                        } = member as any;
                        return rest;
                      })()
                    : (member as any);
                  try {
                    const existing = await this.messageDB.getSpaceMember(
                      conversationId.split('/')[0],
                      (member as any).user_address
                    );
                    await this.messageDB.saveSpaceMember(
                      conversationId.split('/')[0],
                      {
                        ...incoming,
                        isKicked: existing?.isKicked ?? false,
                        joinedAt: (member as any).joinedAt ?? existing?.joinedAt,
                      } as any
                    );
                  } catch {
                    await this.messageDB.saveSpaceMember(
                      conversationId.split('/')[0],
                      incoming as any
                    );
                  }
                }
                await queryClient.setQueryData(
                  buildSpaceMembersKey({
                    spaceId: conversationId.split('/')[0],
                  }),
                  (
                    oldData: (secureChannel.UserProfile & {
                      isKicked?: boolean;
                    })[]
                  ) => {
                    const existingMap = new Map(
                      (oldData ?? []).map((m) => [m.user_address, m])
                    );
                    const merged = (envelope.message.members as any[]).map(
                      (m) => {
                        const prev = existingMap.get(m.user_address);
                        return { ...m, isKicked: prev?.isKicked ?? false };
                      }
                    );
                    return [...(oldData ?? []), ...merged];
                  }
                );
              }
            }
          } else if (envelope.message.type === 'verify-kicked') {
            if (Array.isArray(envelope.message.addresses)) {
              const spaceId = conversationId.split('/')[0];
              for (const address of envelope.message.addresses) {
                const member = await this.messageDB.getSpaceMember(
                  spaceId,
                  address
                );
                // Upsert: if we have no row for this address (e.g. they were
                // kicked before we ever saw their join), still persist a kicked
                // tombstone so they can't later render as an active member.
                await this.messageDB.saveSpaceMember(spaceId, {
                  ...(member ?? {
                    user_address: address,
                    inbox_address: '',
                  }),
                  isKicked: true,
                });
              }
              await queryClient.setQueryData(
                buildSpaceMembersKey({ spaceId }),
                (
                  oldData: (secureChannel.UserProfile & {
                    inbox_address: string;
                    isKicked?: boolean;
                  })[]
                ) => {
                  const previous = oldData ?? [];
                  const mark = new Set(envelope.message.addresses as string[]);
                  return previous.map((m) =>
                    mark.has(m.user_address) ? { ...m, isKicked: true } : m
                  );
                }
              );
            }
          } else if (envelope.message.type === 'sync-messages') {
            let reg = this.spaceInfo.current[conversationId.split('/')[0]];
            if (!reg) {
              reg = (
                await this.apiClient.getSpace(conversationId.split('/')[0])
              ).data;
              this.spaceInfo.current[conversationId.split('/')[0]] = reg;
            }

            if (
              reg.owner_public_keys.includes(
                exteriorEnvelope.owner_public_key
              ) ||
              this.syncInfo.current[conversationId.split('/')[0]]
            ) {
              const verify = JSON.parse(
                ch.js_verify_ed448(
                  Buffer.from(
                    exteriorEnvelope.owner_public_key,
                    'hex'
                  ).toString('base64'),
                  Buffer.from(exteriorEnvelope.envelope, 'utf-8').toString(
                    'base64'
                  ),
                  Buffer.from(exteriorEnvelope.owner_signature, 'hex').toString(
                    'base64'
                  )
                )
              );
              if (verify) {
                const space = await this.messageDB.getSpace(
                  conversationId.split('/')[0]
                );
                for (const message of envelope.message.messages) {
                  // Verify non-repudiable (all types) + control messages (any
                  // space) — control auth must not depend on repudiability.
                  //
                  // ⚠️ VESTIGIAL as an AUTHORIZATION gate — same as the live
                  // path's block: auth re-verifies at its own call site via
                  // `verifySpaceSender`. This only strips unverifiable
                  // signatures off stored rows, and it fingerprints the WIRE
                  // scope, which the auth paths deliberately no longer do.
                  if (
                    space &&
                    message.publicKey &&
                    message.signature &&
                    (!space.isRepudiable ||
                      isControlMessageType(message.content.type) ||
                      message.mentions?.everyone === true)
                  ) {
                    const participant = await this.messageDB.getSpaceMember(
                      space.spaceId,
                      message.content.senderId
                    );
                    const sh = await sha256.digest(
                      Buffer.from(message.publicKey, 'hex')
                    );
                    const inboxAddress = base58btc.baseEncode(sh.bytes);
                    const messageId = await crypto.subtle.digest(
                      'SHA-256',
                      Buffer.from(
                        buildMessageFingerprint({
                          nonce: message.nonce,
                          content: message.content as any,
                          senderId: message.content.senderId,
                          spaceId: message.spaceId,
                          channelId: message.channelId,
                        }),
                        'utf-8'
                      )
                    );
                    // Inbox-binding check is skipped when the participant row is
                    // missing (common — see missing-no-join-row bug), but the
                    // ed448 signature is ALWAYS verified: keeping an unverified
                    // signature would let a forged control message carry a real
                    // mod's (public) key and pass the handler's reverse lookup.
                    // A key that isn't the join binding is still valid if it's an
                    // admitted per-device key (multi-device).
                    const joinMismatch =
                      participant?.inbox_address !== inboxAddress &&
                      !!participant?.inbox_address;
                    const inboxMismatch =
                      joinMismatch &&
                      !(await this.isAdmittedDeviceKey(
                        space.spaceId,
                        message.content.senderId,
                        inboxAddress
                      ));
                    if (
                      inboxMismatch ||
                      message.messageId !==
                        Buffer.from(messageId).toString('hex')
                    ) {
                      message.publicKey = undefined;
                      message.signature = undefined;
                    } else {
                      if (
                        ch.js_verify_ed448(
                          Buffer.from(message.publicKey, 'hex').toString(
                            'base64'
                          ),
                          Buffer.from(messageId).toString('base64'),
                          Buffer.from(message.signature, 'hex').toString(
                            'base64'
                          )
                        ) !== 'true'
                      ) {
                        logger.warn('invalid signature');
                        message.publicKey = undefined;
                        message.signature = undefined;
                      }
                    }
                  }
                  await this.saveMessage(
                    message,
                    this.messageDB,
                    conversationId.split('/')[0],
                    message.channelId,
                    'group',
                    {},
                    null, // space message — the DM reveal ledger does not read these
                    undefined
                  );
                }
                const channelIds = envelope.message.messages
                  .map((m: any) => m.channelId)
                  .sort();
                const checked = {} as { [id: string]: boolean };
                for (const channelId of channelIds) {
                  if (!checked[channelId]) {
                    checked[channelId] = true;
                    // Prefix, not buildMessagesKey: the mounted variant depends
                    // on whether the space allows threads, and this batch has
                    // no idea which one the channel is open under.
                    queryClient.refetchQueries({
                      queryKey: buildMessagesKeyPrefix({
                        spaceId: conversationId.split('/')[0],
                        channelId: channelId,
                      }),
                    });
                  }
                }

                // A synced batch may include an update-profile that saveMessage
                // wrote to the member store above. This bulk-sync path refetched
                // messages but not the members query, so a per-space profile
                // change synced from another device (e.g. a name/avatar edit on
                // mobile) landed in IndexedDB but never refreshed the live
                // SpaceMembers cache — leaving stale member data (empty name /
                // old avatar) until a manual refetch. Refetch it once per batch.
                queryClient.refetchQueries({
                  queryKey: buildSpaceMembersKey({
                    spaceId: conversationId.split('/')[0],
                  }),
                });
              }
            }
          } else if (envelope.message.type === 'sync-manifest') {
            // NEW PROTOCOL: Received manifest from peer - compute and send delta
            const spaceId = conversationId.split('/')[0];
            // The handleSyncManifest method will send deltas back
            if (this.handleSyncManifest && envelope.message.manifest && envelope.message.inboxAddress) {
              logger.log(`[MessageService] sync-manifest: Sending delta to ${envelope.message.inboxAddress.substring(0, 12)}`);
              await this.handleSyncManifest(
                spaceId,
                envelope.message.inboxAddress,
                envelope.message
              );
            }
          } else if (envelope.message.type === 'sync-delta') {
            // NEW PROTOCOL: Received delta from peer - apply to local storage
            const spaceId = conversationId.split('/')[0];

            // Apply message delta
            if (envelope.message.messageDelta) {
              const msgDelta = envelope.message.messageDelta;

              const space = await this.messageDB.getSpace(spaceId);

              // Collect unique channelIds that need to be refetched
              const channelIdsToRefetch = new Set<string>();

              for (const msg of msgDelta.newMessages || []) {
                const channelId = msg.channelId || msgDelta.channelId;
                await this.saveMessage(
                  msg,
                  this.messageDB,
                  spaceId,
                  channelId,
                  'group',
                  {},
                  null, // space message — the DM reveal ledger does not read these
                  undefined
                );
                if (channelId) {
                  channelIdsToRefetch.add(channelId);
                }
              }

              for (const msg of msgDelta.updatedMessages || []) {
                const channelId = msg.channelId || msgDelta.channelId;
                await this.saveMessage(
                  msg,
                  this.messageDB,
                  spaceId,
                  channelId,
                  'group',
                  {},
                  null, // space message — the DM reveal ledger does not read these
                  undefined
                );
                if (channelId) {
                  channelIdsToRefetch.add(channelId);
                }
              }

              for (const msgId of msgDelta.deletedMessageIds || []) {
                await this.messageDB.deleteMessage(msgId);
              }

              // Refetch messages for all channels that had changes
              // If no specific channels were found, fall back to default
              if (channelIdsToRefetch.size === 0) {
                const fallbackChannelId = msgDelta.channelId || space?.defaultChannelId || spaceId;
                channelIdsToRefetch.add(fallbackChannelId);
              }

              for (const channelId of channelIdsToRefetch) {
                // Prefix: matches whichever thread variant the channel mounted.
                queryClient.refetchQueries({
                  queryKey: buildMessagesKeyPrefix({
                    spaceId,
                    channelId,
                  }),
                });
              }
            }

            // Apply member delta
            //
            // Counted on arrival AND after the loop. Without both numbers the
            // send-side logs prove a delta was built and the receive-side logs
            // prove a `sync-delta` arrived, while the roster stays empty and
            // nothing distinguishes "the payload never came", "it came empty"
            // and "it came full and every row was skipped". That gap cost a
            // full debugging session on 2026-08-02.
            // See 2026-08-02-roster-pull-delivers-nothing-to-a-new-joiner.md under .agents/issues/
            logger.log(
              `[MessageService] sync-delta: memberDelta=${
                envelope.message.memberDelta
                  ? `${envelope.message.memberDelta.members?.length ?? 0} members`
                  : 'ABSENT'
              }, messageDelta=${envelope.message.messageDelta ? 'present' : 'absent'}, isFinal=${
                (envelope.message as { isFinal?: boolean }).isFinal
              }`
            );
            if (envelope.message.memberDelta) {
              let savedMembers = 0;
              let skippedNoAddress = 0;
              for (const member of envelope.message.memberDelta.members || []) {
                // Map shared SpaceMember type to desktop DB format:
                // - address -> user_address
                // - profile_image -> user_icon
                // Handle both shared types and legacy field names
                const userAddress = member.address || member.user_address;
                if (!userAddress) {
                  skippedNoAddress++;
                  continue;
                }
                const existing = await this.messageDB.getSpaceMember(spaceId, userAddress);

                // PER-SLOT STALENESS GUARD — the same last-write-wins rule
                // `applyProfileUpdate` applies to `update-profile` messages.
                //
                // The sync protocol compares DIGESTS, which carry no notion of
                // newer or older: `computeMemberDiff` only asks whether two
                // hashes differ, and the responder then sends ITS version. So a
                // peer holding a STALE identity will happily push it back over a
                // newer one. That would revert a deliberate per-space name the
                // member had just changed — the one thing a per-space override
                // must never do, since it exists precisely so the member is NOT
                // shown under their global name here.
                //
                // ⚠️ This became reachable only now. Until the digest was taught
                // to see the global slot, every member hashed as "no identity",
                // so identity deltas were essentially never produced and this
                // path was dead. Turning the digest on turns this on with it.
                //
                // Ties go to the stored value, matching applyProfileUpdate. A
                // member arriving with NO timestamp is treated as timestamp 0,
                // so it can populate an empty row but can never overwrite a
                // stamped one — which is the right call for peers that predate
                // the global slot travelling over sync at all.
                const { applyOverride, applyGlobal } = resolveSyncDeltaSlots({
                  // A peer is never authoritative about OUR per-space name.
                  isSelf: userAddress === self_address,
                  existingOverrideTs: existing?.profileTimestamp,
                  existingGlobalTs: existing?.globalProfileTimestamp,
                  incomingOverrideTs: member.profileTimestamp ?? 0,
                  incomingGlobalTs: member.globalProfileTimestamp ?? 0,
                });

                // `saveSpaceMember` merges, so an omitted slot keeps what is
                // stored rather than blanking it.
                const dbMember = {
                  user_address: userAddress,
                  inbox_address: member.inbox_address,
                  isKicked: member.isKicked,
                  spaceTag: member.spaceTag,
                  // Preserve joinedAt from local DB if sync data doesn't have it
                  joinedAt: member.joinedAt ?? existing?.joinedAt,
                  ...(applyOverride
                    ? {
                        display_name: member.display_name,
                        // Map profile_image to user_icon (desktop DB format)
                        user_icon: member.profile_image || member.user_icon,
                        bio: member.bio,
                        profileTimestamp: member.profileTimestamp,
                      }
                    : {}),
                  ...(applyGlobal
                    ? {
                        global_display_name: member.global_display_name,
                        global_user_icon: member.global_user_icon,
                        global_bio: member.global_bio,
                        globalProfileTimestamp: member.globalProfileTimestamp,
                      }
                    : {}),
                };
                await this.messageDB.saveSpaceMember(spaceId, dbMember as SpaceMemberRow);
                savedMembers++;
              }
              logger.log(
                `[MessageService] sync-delta: saved ${savedMembers} member row(s) for ${spaceId.substring(0, 12)}` +
                  (skippedNoAddress ? `, skipped ${skippedNoAddress} with no address` : '')
              );
              // Use the SHARED key builder. This was hand-written as
              // `['spaceMembers', spaceId]` while every subscriber uses
              // `buildSpaceMembersKey` → `['SpaceMembers', spaceId]`. React Query
              // keys are case-sensitive, so the refetch targeted a key nobody was
              // subscribed to: rows landed in IndexedDB and the member list kept
              // showing the stale roster until the user reloaded, repeatedly.
              // Measured 2026-08-02 — 72 rows on disk, 1 in the list.
              queryClient.refetchQueries({
                queryKey: buildSpaceMembersKey({ spaceId }),
              });
            }

            // Apply peer map delta
            if (envelope.message.peerMapDelta && envelope.message.peerMapDelta.added?.length > 0) {
              logger.log(`[MessageService] sync-delta: ${envelope.message.peerMapDelta.added.length} peer map additions`);
              const encryptionState = await this.messageDB.getEncryptionStates({
                conversationId: spaceId + '/' + spaceId,
              });

              if (encryptionState.length > 0) {
                const stateData = encryptionState[0];
                const parsed = JSON.parse(stateData.state);
                const ratchetState = JSON.parse(parsed.state);

                // Add new peers
                for (const peer of envelope.message.peerMapDelta.added) {
                  if (!ratchetState.id_peer_map) ratchetState.id_peer_map = {};
                  if (!ratchetState.peer_id_map) ratchetState.peer_id_map = {};
                  ratchetState.id_peer_map[peer.peerId] = peer.publicKey;
                  ratchetState.peer_id_map[peer.publicKey] = peer.peerId;
                }

                // Save updated state
                parsed.state = JSON.stringify(ratchetState);
                await this.messageDB.saveEncryptionState({
                  ...stateData,
                  state: JSON.stringify(parsed),
                  timestamp: Date.now(),
                }, true);
              }
            }
          } else if (
            envelope.message.type === 'announce-keys' ||
            envelope.message.type === 'revoke-device'
          ) {
            await this.processDeviceKeyStatement(
              envelope.message as unknown as DeviceKeyStatement,
              conversationId.split('/')[0]
            );
          }
        }
      } catch (e) {
        console.error('[MessageService] Error processing hub/sync message:', e);
        // ⚠️ THE RELAY IS THE ONLY COPY. It holds a frame until we delete it,
        // and that delete IS the ack — so deleting a frame we never opened
        // destroys the message permanently, silently (this log is a no-op in
        // production builds), with no retry and nothing shown to the user.
        //
        // A space frame can fail to open for reasons that are transient by
        // nature: the config key rotated and the frame predates the rotation,
        // or the key that opens it has not arrived yet. Those decrypt fine
        // later, and the relay will redeliver anything we have not acked.
        //
        // Same discipline the DM path has had since 2026-07-25, where replaying
        // real captured frames proved 5 of 6 deleted frames were decryptable
        // against a state the client itself held ~35s later. The budget
        // (40 attempts / 5 min TTL) is what stops a genuinely poisonous frame
        // lingering forever.
        //
        // See issues/.open/2026-08-03-a-space-frame-that-fails-to-decrypt-is-deleted-from-the-relay.md
        if (!opened) {
          retainUnopenedSpaceFrame = !this.undecryptableFrames.recordFailure(
            spaceFrameKey
          );
          if (!retainUnopenedSpaceFrame) {
            logger.warn(
              '[MessageService] giving up on an unopenable space frame after the retry budget — deleting',
              {
                inbox: message.inboxAddress?.slice(0, 16),
                frameTimestamp: message.timestamp,
              }
            );
          }
        }
      }
    }

    if (newState) {
      const newEncryptionState: EncryptionState = {
        state: newState,
        timestamp: message.timestamp,
        inboxId: found.inboxId,
        sentAccept: sentAccept,
        conversationId: conversationId,
      };
      await this.messageDB.saveEncryptionState(newEncryptionState, true);
    }

    if (decryptedContent) {
      if (keys.sending_inbox) {
        // Process delivery receipt data (intercept ack control messages, extract piggybacked acks, buffer for acking)
        const userConfig = await this.messageDB.getUserConfig({ address: self_address });
        const senderAddress = conversationId.split('/')[0];
        // Dual-read: synced config override first, then legacy local record.
        const effectiveDeliveryReceipts =
          getConversationSetting(userConfig?.conversationSettings, conversationId, 'deliveryReceipts') ??
          conversation.conversation?.deliveryReceipts ?? !!userConfig?.deliveryReceipts;
        const effectiveReadReceipts =
          getConversationSetting(userConfig?.conversationSettings, conversationId, 'readReceipts') ??
          conversation.conversation?.readReceipts ?? !!userConfig?.readReceipts;
        if (this.interceptControlMessages(decryptedContent, senderAddress, self_address, effectiveDeliveryReceipts, effectiveReadReceipts, queryClient)) {
          // delivery-ack control message — encryption state saved, but don't save/display the message
          return;
        }

        // MERGE, never replace. `?? existing` was safe only while
        // updatedUserProfile was always undefined on this path; now that a
        // decrypted frame can supply one, a partial profile (real name, blank
        // avatar — an ordinary partner with no picture set) would otherwise be
        // passed through whole. db.saveMessage writes icon/displayName onto the
        // conversation row UNCONDITIONALLY (src/db/messages.ts), and it runs
        // BEFORE addOrUpdateConversation's guarded merge below, so a blank
        // field here permanently wipes a known-good stored value.
        const profileToUse = {
          user_icon: preferIncomingProfileField(
            updatedUserProfile?.user_icon,
            conversation.conversation?.icon
          ),
          display_name: preferIncomingProfileField(
            updatedUserProfile?.display_name,
            conversation.conversation?.displayName
          ),
        };
        await this.saveMessage(
          decryptedContent,
          this.messageDB,
          conversationId.split('/')[0],
          conversationId.split('/')[0],
          keys.sending_inbox ? 'direct' : 'group',
          profileToUse,
          // `conversationId` is `found.conversationId` — the encryption state
          // this frame actually decrypted with, so the counterparty here is
          // crypto-established, not payload-supplied. Unlike the init path
          // there is no self-echo reassignment to guard against (it is `const`).
          //
          // Our OWN message, fanned out to this device from another one, lands
          // on the partner-keyed session and so gets stamped with the partner.
          // That costs this device authorship credit for that row; it never
          // grants it falsely, and it matches the ledger's existing per-device
          // rule that a device waits for its own first deliberate send.
          senderAddress,
          self_address
        );

        // Notify for DM posts from other users only (skip muted conversations)
        if (
          decryptedContent.content?.senderId !== self_address &&
          decryptedContent.content?.type === 'post' &&
          !notificationService.isConversationMuted(conversationId)
        ) {
          const senderDisplayName = profileToUse.display_name ?? t`Unknown`;
          notificationService.addPendingNotification({
            type: 'dm',
            senderName: senderDisplayName,
          });
        }

        await this.addMessage(
          queryClient,
          conversationId.split('/')[0],
          conversationId.split('/')[0],
          decryptedContent,
          true // Skip rate limiting for DMs
        );
        await this.addOrUpdateConversation(
          queryClient,
          conversationId.split('/')[0],
          message.timestamp,
          conversation.conversation?.lastReadTimestamp ?? 0,
          profileToUse
        );
      } else {
        await this.saveMessage(
          decryptedContent,
          this.messageDB,
          conversationId.split('/')[0],
          decryptedContent.channelId,
          // Unreachable with `sending_inbox` set — this is the `else` of the
          // DM branch, so the ternary always yields 'group' here. Left as-is
          // to stay diff-minimal; the `null` below is the honest answer either
          // way, since nothing outside a DM reads the marker.
          keys.sending_inbox ? 'direct' : 'group',
          // Merge, not replace — see the sibling branch above.
          {
            user_icon: preferIncomingProfileField(
              updatedUserProfile?.user_icon,
              conversation.conversation?.icon
            ),
            display_name: preferIncomingProfileField(
              updatedUserProfile?.display_name,
              conversation.conversation?.displayName
            ),
          },
          null, // space message — the DM reveal ledger does not read these
          self_address
        );

        // Check if this space message should trigger a desktop notification
        if (
          decryptedContent?.content?.type === 'post' &&
          decryptedContent.content.senderId !== self_address
        ) {
          const spaceId = conversationId.split('/')[0];
          const config = await this.messageDB.getUserConfig({ address: self_address });
          const settings = config?.notificationSettings?.[spaceId];
          const channelId = decryptedContent.channelId;
          const isChannelMuted = !!channelId &&
            !!config?.mutedChannels?.[spaceId]?.includes(channelId);

          // Don't notify if space is muted or this specific channel is muted
          if (settings?.isMuted !== true && !isChannelMuted) {
            const enabledTypes = settings?.enabledNotificationTypes ??
              ['mention-you', 'mention-everyone', 'mention-roles', 'reply'];

            // Get user's roles for @role mention checking
            const space = await this.messageDB.getSpace(spaceId);
            const userRoles = space?.roles
              ?.filter(role => role.members?.includes(self_address))
              ?.map(role => role.roleId) ?? [];

            // @everyone gate: honor it only if the VERIFIED signer (not the
            // spoofable payload senderId) held mention:everyone. Verification
            // happens here rather than being inherited from the receive-path
            // gate, so this holds even if that gate stops covering @everyone
            // posts. We drop `space` from
            // isMentionedWithSettings (disabling its payload-based @everyone
            // check) and do the @everyone check ourselves against the verified
            // signer; user/@role checks are unaffected (they don't use space).
            const { sender: everyoneSender } = await this.verifySpaceSender(
              decryptedContent,
              this.messageDB,
              spaceId,
              channelId
            );
            const isMentioned =
              isMentionedWithSettings(decryptedContent, {
                userAddress: self_address,
                enabledTypes,
                userRoles,
              }) ||
              (enabledTypes.includes('mention-everyone') &&
                decryptedContent.mentions?.everyone === true &&
                !!everyoneSender &&
                hasPermission(
                  everyoneSender,
                  'mention:everyone',
                  space ?? undefined
                ));

            // Check for reply to user's message
            const isReplyToMe = enabledTypes.includes('reply') &&
              decryptedContent.replyMetadata?.parentAuthor === self_address;

            if (isMentioned || isReplyToMe) {
              // Get sender name
              const member = await this.messageDB.getSpaceMember(spaceId, decryptedContent.content.senderId);
              const senderName = member?.display_name ?? t`Someone`;

              // Determine mention type inline (priority: user > role > everyone)
              let mentionType: 'user' | 'role' | 'everyone' | undefined;
              let roleName: string | undefined;

              if (isMentioned) {
                const mentions = decryptedContent.mentions;
                if (mentions?.memberIds?.includes(self_address)) {
                  mentionType = 'user';
                } else if (mentions?.roleIds && userRoles.length > 0) {
                  const matchedRoleId = userRoles.find(roleId =>
                    mentions.roleIds?.includes(roleId)
                  );
                  if (matchedRoleId) {
                    mentionType = 'role';
                    const role = space?.roles?.find(r => r.roleId === matchedRoleId);
                    roleName = role?.displayName ?? role?.roleTag ?? t`a role`;
                  }
                } else if (mentions?.everyone === true) {
                  mentionType = 'everyone';
                }
              }

              notificationService.addPendingNotification({
                type: isMentioned ? 'mention' : 'reply',
                senderName,
                spaceName: space?.spaceName ?? t`a Space`,
                mentionType,
                roleName,
              });
            }
          }
        }

        await this.addMessage(
          queryClient,
          conversationId.split('/')[0],
          decryptedContent.channelId,
          decryptedContent
        );
      }
    }

    if (keys.sending_inbox) {
      this.dispatchInboxDelete(
        keys.receiving_inbox,
        [message.timestamp],
        'post-processing cleanup (DM inbox)'
      );
    } else {
      const inbox_key = await this.messageDB.getSpaceKey(
        conversationId.split('/')[0],
        'inbox'
      );

      if (!inbox_key) {
        // Space was deleted, silently skip cleanup
        logger.debug(
          `Skipping inbox cleanup for deleted space: ${conversationId.split('/')[0]}`
        );
        return;
      }

      // We could not open this frame and its retry budget is not spent. Do NOT
      // delete it: the delete is the ack, and the relay is the only copy.
      // Leaving it means the relay redelivers it on the next `listen`, by which
      // time the key that opens it may have arrived.
      if (retainUnopenedSpaceFrame) {
        logger.log(
          `[MessageService] keeping an unopenable space frame for retry: ` +
            `${conversationId.split('/')[0].substring(0, 12)} ts=${message.timestamp}`
        );
        return;
      }

      this.ackSpaceFrame(
        inbox_key,
        message.timestamp,
        'post-processing cleanup (space inbox)'
      );
    }
  }

  /**
   * Tell the relay we are finished with a space frame.
   *
   * ⚠️ The delete IS the ack, and the relay is the only copy — it retains a
   * frame until we delete it and re-pushes anything un-acked on every `listen`.
   * So a frame we process and never ack is not merely untidy: it comes back on
   * every reconnect, forever, each time costing a full unseal and a slot in the
   * inbound queue.
   *
   * That is why this is a named helper rather than inline code. It had exactly
   * one call site — the tail of `handleNewMessage` — and every path that
   * returned before reaching it leaked a frame permanently. Typing indicators
   * did (MEASURED: an ordinary post was redelivered 0x after a reconnect, a
   * typing frame 2x; `yarn harness space-typing`). If you add an early return to
   * the space path, call this first.
   */
  private ackSpaceFrame(
    inboxKey: { address?: string; publicKey: string; privateKey: string },
    timestamp: number,
    context: string
  ): void {
    this.dispatchInboxDelete(
      {
        inbox_address: inboxKey.address!,
        inbox_encryption_key: {} as never,
        inbox_key: {
          type: 'ed448',
          public_key: hexToSpreadArray(inboxKey.publicKey),
          private_key: hexToSpreadArray(inboxKey.privateKey),
        },
      },
      [timestamp],
      context
    );
  }

  /**
   * Sanitizes error messages for display to users.
   * Never exposes sensitive data like IP addresses, paths, or stack traces.
   */
  private sanitizeError(error: unknown): string {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('network') || msg.includes('fetch') || msg.includes('socket')) {
        return 'Network error';
      }
      if (msg.includes('encrypt') || msg.includes('ratchet') || msg.includes('crypto')) {
        return 'Encryption error';
      }
      if (msg.includes('timeout')) {
        return 'Connection timed out';
      }
    }
    return 'Failed to send message';
  }

  /**
   * Submits channel message: encrypts with triple ratchet, sends via hub, saves locally.
   * For post messages: uses optimistic updates (message appears immediately with "Sending" status).
   */
  async submitChannelMessage(
    spaceId: string,
    channelId: string,
    pendingMessage: string | object,
    queryClient: QueryClient,
    currentPasskeyInfo: {
      credentialId: string;
      address: string;
      publicKey: string;
      displayName?: string;
      pfpUrl?: string;
      completedOnboarding: boolean;
    },
    inReplyTo?: string,
    skipSigning?: boolean,
    isSpaceOwner?: boolean,
    parentMessage?: Message,
    threadId?: string
  ) {
    // Determine message type for optimistic update handling
    const isEditMessage =
      typeof pendingMessage === 'object' &&
      (pendingMessage as any).type === 'edit-message';
    const isPinMessage =
      typeof pendingMessage === 'object' &&
      (pendingMessage as any).type === 'pin';
    const isUpdateProfileMessage =
      typeof pendingMessage === 'object' &&
      (pendingMessage as any).type === 'update-profile';
    const isThreadMessage =
      typeof pendingMessage === 'object' &&
      (pendingMessage as any).type === 'thread';

    // Post messages (regular text messages) use optimistic updates
    const isPostMessage =
      typeof pendingMessage === 'string' ||
      (!isEditMessage && !isPinMessage && !isUpdateProfileMessage && !isThreadMessage);

    // For post messages: prepare and show optimistically BEFORE enqueueing
    if (isPostMessage) {
      // Generate nonce and fetch required data (fast local operations)
      const nonce = crypto.randomUUID();
      const space = await this.messageDB.getSpace(spaceId);

      // Read-only posts must always be signed (receive-side drops unsigned ones,
      // including a manager's own), so force-sign regardless of the repudiable
      // "send unsigned" toggle.
      const targetChannel = space
        ? this.findChannelInSpace(space, channelId)
        : undefined;
      // Same reasoning, one class wider: every type on
      // SIGNATURE_REQUIRED_MESSAGE_TYPES is refused unsigned by receivers, so
      // honoring "send unsigned" for one would produce an action that appears
      // to succeed locally and is silently discarded by everyone else.
      //
      // This does NOT touch deniability. That is a property of ordinary posts,
      // which are absent from the list and still send unsigned at the user's
      // choice. What is excluded is the small set of frames that moderate or
      // destroy OTHER people's content, where "who did this" has to be provable
      // for the receiver to act on it at all.
      const signatureRequired = requiresVerifiedSignature(
        (pendingMessage as { type?: string })?.type ?? ''
      );
      const effectiveSkipSigning =
        targetChannel?.isReadOnly || signatureRequired ? false : skipSigning;

      // Calculate messageId (SHA-256 of the canonical fingerprint). Uses the
      // shared builder so the real content.type is hashed (control messages
      // like remove-message no longer sign under a hardcoded 'post') and
      // control types bind spaceId/channelId. Posts are unchanged.
      const messageIdBuffer = await crypto.subtle.digest(
        'SHA-256',
        Buffer.from(
          buildMessageFingerprint({
            nonce,
            content: pendingMessage as any,
            senderId: currentPasskeyInfo.address,
            spaceId,
            channelId,
          }),
          'utf-8'
        )
      );
      const messageIdHex = Buffer.from(messageIdBuffer).toString('hex');

      // Extract mentions
      const canUseEveryone = hasPermission(
        currentPasskeyInfo.address,
        'mention:everyone',
        space ?? undefined,
        isSpaceOwner || false
      );
      const spaceRoles =
        space?.roles
          ?.filter((r) => r.isPublic !== false)
          .map((r) => ({
            roleId: r.roleId,
            roleTag: r.roleTag,
          })) || [];
      const spaceChannels =
        space?.groups?.flatMap((g) =>
          g.channels.map((c) => ({
            channelId: c.channelId,
            channelName: c.channelName,
          }))
        ) || [];

      let mentions;
      if (typeof pendingMessage === 'string') {
        mentions = extractMentionsFromText(pendingMessage, {
          allowEveryone: canUseEveryone,
          spaceRoles,
          spaceChannels,
        });
      } else if ((pendingMessage as any).text) {
        mentions = extractMentionsFromText((pendingMessage as any).text, {
          allowEveryone: canUseEveryone,
          spaceRoles,
          spaceChannels,
        });
      }

      // Build reply metadata
      let replyMetadata:
        | { parentAuthor: string; parentChannelId: string }
        | undefined;
      if (inReplyTo && parentMessage) {
        if (parentMessage.content.senderId !== currentPasskeyInfo.address) {
          replyMetadata = {
            parentAuthor: parentMessage.content.senderId,
            parentChannelId: channelId,
          };
        }
      }

      // Create message object
      const message = {
        spaceId: spaceId,
        channelId: channelId,
        messageId: messageIdHex,
        digestAlgorithm: 'SHA-256',
        nonce: nonce,
        createdDate: Date.now(),
        modifiedDate: Date.now(),
        lastModifiedHash: '',
        content:
          typeof pendingMessage === 'string'
            ? ({
                type: 'post',
                senderId: currentPasskeyInfo.address,
                text: pendingMessage,
                repliesToMessageId: inReplyTo,
              } as PostMessage)
            : {
                ...(pendingMessage as any),
                senderId: currentPasskeyInfo.address,
              },
        mentions:
          mentions &&
          (mentions.memberIds.length > 0 ||
            mentions.roleIds.length > 0 ||
            mentions.channelIds.length > 0 ||
            mentions.everyone)
            ? mentions
            : undefined,
        replyMetadata,
        reactions: [],
        // Thread fields
        ...(threadId ? { threadId, isThreadReply: true } : {}),
      } as Message;

      // Sign message BEFORE optimistic display (non-repudiability requirement)
      if (
        !space?.isRepudiable ||
        (space?.isRepudiable && !effectiveSkipSigning)
      ) {
        const inboxKey = await this.getSigningKey(spaceId);
        message.publicKey = inboxKey.publicKey;
        message.signature = Buffer.from(
          JSON.parse(
            ch.js_sign_ed448(
              Buffer.from(inboxKey.privateKey, 'hex').toString('base64'),
              Buffer.from(messageIdBuffer).toString('base64')
            )
          ),
          'base64'
        ).toString('hex');
      }

      // Add to cache with 'sending' status (optimistic update)
      // Thread replies go to thread cache only, not main feed
      if (threadId) {
        queryClient.setQueryData(
          ['thread-messages', spaceId, channelId, threadId],
          (oldData: any) => {
            if (!oldData) return oldData;
            const optimisticMessage = { ...message, sendStatus: 'sending' as const };
            return {
              ...oldData,
              messages: [
                ...oldData.messages.filter((m: Message) => m.messageId !== message.messageId),
                optimisticMessage,
              ],
              replyCount: oldData.replyCount + 1,
            };
          }
        );
      } else {
        await this.addMessage(queryClient, spaceId, channelId, {
          ...message,
          sendStatus: 'sending',
        });
      }

      // Queue to ActionQueue for persistent, crash-resistant delivery
      if (!this.actionQueueService) {
        throw new Error(
          'ActionQueueService not initialized. This is a bug - MessageService.setActionQueueService() must be called before sending messages.'
        );
      }
      await this.actionQueueService.enqueue(
        'send-channel-message',
        {
          spaceId,
          channelId,
          signedMessage: message,
          messageId: messageIdHex,
          replyMetadata: message.replyMetadata,
        },
        `send:${spaceId}:${channelId}:${messageIdHex}`
      );

      return; // Post message handling complete
    }

    // For edit-message, pin-message, and update-profile: use existing flow (no optimistic update)
    this.enqueueOutbound(async () => {
      const outbounds: string[] = [];
      const nonce = crypto.randomUUID();
      const space = await this.messageDB.getSpace(spaceId);

      // Handle edit-message type
      if (
        typeof pendingMessage === 'object' &&
        (pendingMessage as any).type === 'edit-message'
      ) {
        const editMessage = pendingMessage as EditMessage;
        // Verify the original message exists and can be edited
        const originalMessage = await this.messageDB.getMessage({
          spaceId,
          channelId,
          messageId: editMessage.originalMessageId,
        });

        if (!originalMessage) {
          return outbounds;
        }

        // Check permissions
        if (originalMessage.content.senderId !== currentPasskeyInfo.address) {
          return outbounds;
        }

        // Only allow editing post messages
        if (originalMessage.content.type !== 'post') {
          return outbounds;
        }

        // Check edit time window
        const timeSinceCreation = Date.now() - originalMessage.createdDate;
        if (timeSinceCreation > MESSAGE_EDIT_WINDOW_MS) {
          return outbounds;
        }

        // Create the edit message with proper structure. Shared builder binds
        // spaceId/channelId (edit-message is a control type), matching receive.
        const messageId = await crypto.subtle.digest(
          'SHA-256',
          Buffer.from(
            buildMessageFingerprint({
              nonce,
              content: {
                ...editMessage,
                senderId: currentPasskeyInfo.address,
              } as EditMessage,
              senderId: currentPasskeyInfo.address,
              spaceId,
              channelId,
            }),
            'utf-8'
          )
        );

        const message = {
          spaceId: spaceId,
          channelId: channelId,
          messageId: Buffer.from(messageId).toString('hex'),
          digestAlgorithm: 'SHA-256',
          nonce: nonce,
          createdDate: Date.now(),
          modifiedDate: Date.now(),
          lastModifiedHash: '',
          content: {
            ...editMessage,
            senderId: currentPasskeyInfo.address,
          } as EditMessage,
        } as Message;

        const conversationId = spaceId + '/' + channelId;
        const conversation = await this.messageDB.getConversation({
          conversationId,
        });

        // Edit inherit rule: an edit is signed iff the message it edits was
        // signed, so a deliberately-unsigned (deniable) message never silently
        // gains a signature on edit. In a non-repudiable space the original is
        // always signed, so edits are too (consistent with the space rule).
        if (shouldSignEdit(originalMessage)) {
          const inboxKey = await this.getSigningKey(spaceId);
          message.publicKey = inboxKey.publicKey;
          message.signature = Buffer.from(
            JSON.parse(
              ch.js_sign_ed448(
                Buffer.from(inboxKey.privateKey, 'hex').toString('base64'),
                Buffer.from(messageId).toString('base64')
              )
            ),
            'base64'
          ).toString('hex');
        }

        outbounds.push(await this.encryptAndSendToSpace(spaceId, message));
        await this.saveMessage(
          message,
          this.messageDB,
          spaceId,
          channelId,
          'group',
          {
            user_icon:
              conversation.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
            display_name:
              conversation.conversation?.displayName ?? t`Unknown User`,
          },
          null, // space message — the DM reveal ledger does not read these
          currentPasskeyInfo.address // Update lastReadTimestamp for own messages
        );
        await this.addMessage(queryClient, spaceId, channelId, message);

        return outbounds;
      }

      // Handle pin-message type
      if (
        typeof pendingMessage === 'object' &&
        (pendingMessage as any).type === 'pin'
      ) {
        const pinMessage = pendingMessage as PinMessage;

        // Reject DMs - pins are Space-only feature
        if (spaceId === channelId) {
          return outbounds;
        }

        // Validate permissions (same logic as saveMessage/addMessage)
        let hasPermission: boolean;

        // For read-only channels: check manager privileges FIRST
        const channel = space?.groups
          ?.find((g) => g.channels.find((c) => c.channelId === channelId))
          ?.channels.find((c) => c.channelId === channelId);

        if (channel?.isReadOnly) {
          const isManager = !!(
            channel.managerRoleIds &&
            space?.roles?.some(
              (role) =>
                channel.managerRoleIds?.includes(role.roleId) &&
                role.members.includes(currentPasskeyInfo.address)
            )
          );
          hasPermission = isManager;
        } else {
          // For regular channels: check explicit role membership (NO isSpaceOwner bypass)
          hasPermission = !!(
            space?.roles?.some(
              (role) =>
                role.members.includes(currentPasskeyInfo.address) &&
                role.permissions.includes('message:pin')
            )
          );
        }

        if (!hasPermission) {
          return outbounds;
        }

        // messageId = SHA-256 of the canonical fingerprint (pin is a control
        // type: shared builder binds spaceId/channelId, matching receive).
        const messageId = await crypto.subtle.digest(
          'SHA-256',
          Buffer.from(
            buildMessageFingerprint({
              nonce,
              content: { ...pinMessage, senderId: currentPasskeyInfo.address },
              senderId: currentPasskeyInfo.address,
              spaceId,
              channelId,
            }),
            'utf-8'
          )
        );

        const message = {
          spaceId: spaceId,
          channelId: channelId,
          messageId: Buffer.from(messageId).toString('hex'),
          digestAlgorithm: 'SHA-256',
          nonce: nonce,
          createdDate: Date.now(),
          modifiedDate: Date.now(),
          lastModifiedHash: '',
          content: {
            ...pinMessage,
            senderId: currentPasskeyInfo.address,
          } as PinMessage,
        } as Message;

        const conversationId = spaceId + '/' + channelId;
        const conversation = await this.messageDB.getConversation({
          conversationId,
        });

        // Enforce non-repudiability
        if (!space?.isRepudiable || (space?.isRepudiable && !skipSigning)) {
          const inboxKey = await this.getSigningKey(spaceId);
          message.publicKey = inboxKey.publicKey;
          message.signature = Buffer.from(
            JSON.parse(
              ch.js_sign_ed448(
                Buffer.from(inboxKey.privateKey, 'hex').toString('base64'),
                Buffer.from(messageId).toString('base64')
              )
            ),
            'base64'
          ).toString('hex');
        }

        outbounds.push(await this.encryptAndSendToSpace(spaceId, message));
        await this.saveMessage(
          message,
          this.messageDB,
          spaceId,
          channelId,
          'group',
          {
            user_icon:
              conversation.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
            display_name:
              conversation.conversation?.displayName ?? t`Unknown User`,
          },
          null, // space message — the DM reveal ledger does not read these
          currentPasskeyInfo.address // Update lastReadTimestamp for own messages
        );
        await this.addMessage(queryClient, spaceId, channelId, message);

        return outbounds;
      }

      // Handle thread-message type
      if (
        typeof pendingMessage === 'object' &&
        (pendingMessage as any).type === 'thread'
      ) {
        const threadMsg = pendingMessage as ThreadMessage;

        // Pre-send validation (DM check, idempotency, auth)
        // Returns targetMessage to avoid a second DB fetch
        const preCheck = await this.threadService.handleThreadSend({
          threadMsg,
          spaceId,
          channelId,
          queryClient,
          currentUserAddress: currentPasskeyInfo.address,
        });
        if (!preCheck.shouldProceed || !preCheck.targetMessage) return outbounds;
        const targetMessage = preCheck.targetMessage;

        const messageId = await crypto.subtle.digest(
          'SHA-256',
          Buffer.from(
            nonce +
              'thread' +
              currentPasskeyInfo.address +
              canonicalize(threadMsg),
            'utf-8'
          )
        );

        const message = {
          spaceId: spaceId,
          channelId: channelId,
          messageId: Buffer.from(messageId).toString('hex'),
          digestAlgorithm: 'SHA-256',
          nonce: nonce,
          createdDate: Date.now(),
          modifiedDate: Date.now(),
          lastModifiedHash: '',
          content: {
            ...threadMsg,
            senderId: currentPasskeyInfo.address,
          } as ThreadMessage,
        } as Message;

        // Sign (same pattern as pin messages)
        if (!space?.isRepudiable || (space?.isRepudiable && !skipSigning)) {
          const inboxKey = await this.getSigningKey(spaceId);
          message.publicKey = inboxKey.publicKey;
          message.signature = Buffer.from(
            JSON.parse(
              ch.js_sign_ed448(
                Buffer.from(inboxKey.privateKey, 'hex').toString('base64'),
                Buffer.from(messageId).toString('base64')
              )
            ),
            'base64'
          ).toString('hex');
        }

        outbounds.push(await this.encryptAndSendToSpace(spaceId, message));

        // Resolve conversation profile for DB saves (uses DefaultImages + i18n)
        const conversationId = spaceId + '/' + channelId;
        const conversation = await this.messageDB.getConversation({ conversationId });

        // Post-broadcast: DB writes and cache updates
        const { earlyReturn } = await this.threadService.handleThreadSendPostBroadcast({
          threadMsg,
          targetMessage,
          spaceId,
          channelId,
          queryClient,
          currentUserAddress: currentPasskeyInfo.address,
          conversationProfile: {
            user_icon: conversation.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
            display_name: conversation.conversation?.displayName ?? t`Unknown User`,
          },
        });
        if (earlyReturn) return outbounds;

        return outbounds;
      }

      // Handle update-profile type
      if (
        typeof pendingMessage === 'object' &&
        (pendingMessage as any).type === 'update-profile'
      ) {
        const updateProfileMessage = pendingMessage as UpdateProfileMessage;

        // Generate message ID
        const messageId = await crypto.subtle.digest(
          'SHA-256',
          Buffer.from(
            nonce +
              'update-profile' +
              currentPasskeyInfo.address +
              canonicalize(updateProfileMessage),
            'utf-8'
          )
        );

        const createdDate = Date.now();
        const message = {
          spaceId: spaceId,
          channelId: channelId,
          messageId: Buffer.from(messageId).toString('hex'),
          digestAlgorithm: 'SHA-256',
          nonce: nonce,
          createdDate,
          modifiedDate: createdDate,
          lastModifiedHash: '',
          content: {
            ...updateProfileMessage,
            senderId: currentPasskeyInfo.address,
          } as UpdateProfileMessage,
        } as Message;

        // Enforce non-repudiability (required for profile updates to verify sender)
        const inboxKey = await this.getSigningKey(spaceId);
        message.publicKey = inboxKey.publicKey;
        message.signature = Buffer.from(
          JSON.parse(
            ch.js_sign_ed448(
              Buffer.from(inboxKey.privateKey, 'hex').toString('base64'),
              Buffer.from(messageId).toString('base64')
            )
          ),
          'base64'
        ).toString('hex');

        // Send to hub
        outbounds.push(await this.encryptAndSendToSpace(spaceId, message));

        // Update local database immediately (don't wait for server echo)
        // This ensures the profile change is visible right away
        const participant = await this.messageDB.getSpaceMember(
          spaceId,
          currentPasskeyInfo.address
        );
        if (participant) {
          // Self-apply our own just-sent edit locally (don't wait for echo).
          // Same two-slot, presence-checked, per-slot-LWW merge as the receive
          // handlers — a global-only save omits the override fields, so they're
          // left untouched rather than wiped. `createdDate` is our own send
          // timestamp, so our latest edit always wins over our stored value.
          applyProfileUpdate(participant, updateProfileMessage, createdDate);
          if (updateProfileMessage.spaceTag !== undefined) {
            participant.spaceTag = updateProfileMessage.spaceTag;
          }
          await this.messageDB.saveSpaceMember(spaceId, participant);

          // Update query cache for immediate UI refresh. Use the already-merged
          // `participant` (which the presence-checked writes above produced), NOT
          // the raw message fields — spreading raw `updateProfileMessage.display_name`
          // etc. would write `undefined` on a global-only save and briefly wipe the
          // user's own per-space override in the UI until the next refetch.
          queryClient.setQueryData(
            buildSpaceMembersKey({ spaceId }),
            (oldData: secureChannel.UserProfile[]) => {
              if (!oldData) return oldData;
              return oldData.map((member) =>
                member.user_address === currentPasskeyInfo.address
                  ? participant
                  : member
              );
            }
          );
        }

        return outbounds;
      }

      // No matching message type in this path
      return outbounds;
    });
  }

  async createThread(
    spaceId: string,
    channelId: string,
    targetMessageId: string,
    queryClient: QueryClient,
    currentPasskeyInfo: {
      credentialId: string;
      address: string;
      publicKey: string;
      displayName?: string;
      pfpUrl?: string;
      completedOnboarding: boolean;
    },
    skipSigning?: boolean,
    isSpaceOwner?: boolean
  ) {
    if (spaceId === channelId) return; // Reject DMs

    const threadIdBuffer = await crypto.subtle.digest(
      'SHA-256',
      Buffer.from(targetMessageId + ':thread', 'utf-8')
    );
    const threadId = Buffer.from(threadIdBuffer).toString('hex');

    const threadMeta: ThreadMeta = { threadId, createdBy: currentPasskeyInfo.address };
    const threadMessage: ThreadMessage = {
      type: 'thread',
      senderId: currentPasskeyInfo.address,
      targetMessageId,
      action: 'create',
      threadMeta,
    };

    await this.submitChannelMessage(
      spaceId,
      channelId,
      threadMessage,
      queryClient,
      currentPasskeyInfo,
      undefined,
      skipSigning,
      isSpaceOwner
    );

    return { threadId, threadMeta };
  }

  /**
   * Retries sending a failed message.
   * Re-uses the same signed message (messageId preserved) with fresh encryption.
   */
  async retryMessage(
    spaceId: string,
    channelId: string,
    failedMessage: Message,
    queryClient: QueryClient
  ) {
    // Validate message is in 'failed' state
    if (failedMessage.sendStatus !== 'failed') {
      logger.warn('Cannot retry message that is not in failed state');
      return;
    }

    // Update status to 'sending' (optimistic)
    queryClient.setQueriesData(
      { queryKey: buildMessagesKeyPrefix({ spaceId, channelId }) },
      (oldData: InfiniteData<any>) => {
        if (!oldData?.pages) return oldData;
        return {
          pageParams: oldData.pageParams,
          pages: oldData.pages.map((page) => ({
            ...page,
            messages: page.messages.map((msg: Message) =>
              msg.messageId === failedMessage.messageId
                ? { ...msg, sendStatus: 'sending' as const, sendError: undefined }
                : msg
            ),
            nextCursor: page.nextCursor,
            prevCursor: page.prevCursor,
          })),
        };
      }
    );

    // Enqueue the retry
    this.enqueueOutbound(async () => {
      const outbounds: string[] = [];
      try {
        // Get conversation for user profile info
        const conversationId = spaceId + '/' + channelId;
        const conversation = await this.messageDB.getConversation({
          conversationId,
        });

        // Triple Ratchet encrypt with fresh envelope (strips ephemeral fields)
        outbounds.push(
          await this.encryptAndSendToSpace(spaceId, failedMessage, {
            stripEphemeralFields: true,
          })
        );

        // Strip ephemeral fields for saving to IndexedDB
        const {
          sendStatus: _sendStatus,
          sendError: _sendError,
          ...messageToEncrypt
        } = failedMessage;

        // Save to IndexedDB (without sendStatus/sendError)
        await this.saveMessage(
          messageToEncrypt as Message,
          this.messageDB,
          spaceId,
          channelId,
          'group',
          {
            user_icon:
              conversation.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
            display_name:
              conversation.conversation?.displayName ?? t`Unknown User`,
          },
          null, // space message — the DM reveal ledger does not read these
          failedMessage.content?.senderId // Update lastReadTimestamp for own messages
        );

        // Update status to 'sent'
        this.updateMessageStatus(
          queryClient,
          spaceId,
          channelId,
          failedMessage.messageId,
          'sent'
        );

        return outbounds;
      } catch (error) {
        // Revert status to 'failed' with updated error
        const sanitizedError = this.sanitizeError(error);
        this.updateMessageStatus(
          queryClient,
          spaceId,
          channelId,
          failedMessage.messageId,
          'failed',
          sanitizedError
        );
        console.error('Retry failed:', error);
        return outbounds;
      }
    });
  }

  /**
   * Retries sending a failed direct message.
   * Re-uses the same signed message (messageId preserved) with fresh encryption.
   */
  async retryDirectMessage(
    address: string,
    failedMessage: Message,
    self: secureChannel.UserRegistration,
    counterparty: secureChannel.UserRegistration,
    queryClient: QueryClient,
    currentPasskeyInfo: {
      credentialId: string;
      address: string;
      publicKey: string;
      displayName?: string;
      pfpUrl?: string;
      completedOnboarding: boolean;
    },
    keyset: {
      deviceKeyset: secureChannel.DeviceKeyset;
      userKeyset: secureChannel.UserKeyset;
    }
  ) {
    // Validate message is in 'failed' state
    if (failedMessage.sendStatus !== 'failed') {
      logger.warn('Cannot retry message that is not in failed state');
      return;
    }

    // Pressing retry is a deliberate act, and only a PERSISTED message can
    // reach here — the delete-conversation control frames are never saved (see
    // submitMessage: "do not save delete-conversation (control) messages"), so
    // this can never be a retry of one. Record consent for the same reason the
    // original send did.
    //
    // ⚠️ These two are UNCONDITIONAL aliases, NOT a gate — unlike the
    // identically-named values in submitMessage, which are conditional on
    // `mayRevealIdentity`. That is safe only because of the invariant stated
    // above (a delete frame can never be retried here), which makes the gate's
    // answer always "true" on this path. They exist as separate names purely so
    // the session-creating calls below read the same as submitMessage's. If
    // that invariant ever breaks, THIS PATH HAS NO GATE to catch it.
    //
    // The `encryptAndSendDm` chokepoint gate does not cover this path either:
    // these values go to `NewDoubleRatchetSenderSession` and friends directly.
    this.recordRevealAndAnnounce(currentPasskeyInfo.address, address, keyset);
    const outgoingDisplayName = currentPasskeyInfo.displayName;
    const outgoingUserIcon = currentPasskeyInfo.pfpUrl;

    // Update status to 'sending' (optimistic)
    queryClient.setQueriesData(
      { queryKey: buildMessagesKeyPrefix({ spaceId: address, channelId: address }) },
      (oldData: InfiniteData<any>) => {
        if (!oldData?.pages) return oldData;
        return {
          pageParams: oldData.pageParams,
          pages: oldData.pages.map((page) => ({
            ...page,
            messages: page.messages.map((msg: Message) =>
              msg.messageId === failedMessage.messageId
                ? { ...msg, sendStatus: 'sending' as const, sendError: undefined }
                : msg
            ),
            nextCursor: page.nextCursor,
            prevCursor: page.prevCursor,
          })),
        };
      }
    );

    // Enqueue the retry
    this.enqueueOutbound(async () => {
      const outbounds: string[] = [];
      try {
        const conversationId = address + '/' + address;
        const conversation = await this.messageDB.getConversation({
          conversationId,
        });
        // Strip local-only fields before encrypting (declared outside the
        // lock — also used by saveMessage after it).
        //
        // `authenticatedSenderId` is stripped here too: `failedMessage` is a
        // PERSISTED row, so it carries the marker, and re-serializing it whole
        // would put a field the shared type calls "NEVER TRANSMITTED" on the
        // wire. The receiver overwrites it anyway, so this was not a live leak
        // — it is the invariant being kept true rather than nearly true.
        const messageToEncrypt = stripNonTransmissibleFields(failedMessage);
        // Ratchet critical section: read state → encrypt → save. Serialized per
        // conversation to prevent concurrent state forks (see dmRatchetMutex).
        await dmRatchetMutex.runExclusive(conversationId, async () => {
          let response = await this.messageDB.getEncryptionStates({
            conversationId,
          });
          const inboxes = self.device_registrations
            .map((d) => d.inbox_registration.inbox_address)
            .concat(
              counterparty.device_registrations.map(
                (d) => d.inbox_registration.inbox_address
              )
            )
            .sort();
          for (const res of response) {
            if (!inboxes.includes(JSON.parse(res.state).tag)) {
              await this.messageDB.deleteEncryptionState(res);
            }
          }

          response = await this.messageDB.getEncryptionStates({ conversationId });
          const sets = orderSessionsForSend(response);

          let sessions: secureChannel.SealedMessageAndMetadata[] = [];

          for (const inbox of inboxes.filter(
            (i) => i !== keyset.deviceKeyset.inbox_keyset.inbox_address
          )) {
            const set = sets.find((s) => s.tag === inbox);
            if (set) {
              if (set.sending_inbox.inbox_public_key === '') {
                sessions = [
                  ...sessions,
                  ...secureChannel.DoubleRatchetInboxEncryptForceSenderInit(
                    keyset.deviceKeyset,
                    [set],
                    JSON.stringify(messageToEncrypt),
                    self,
                    outgoingDisplayName,
                    outgoingUserIcon
                  ),
                ];
              } else {
                sessions = [
                  ...sessions,
                  ...secureChannel.DoubleRatchetInboxEncrypt(
                    keyset.deviceKeyset,
                    [set],
                    JSON.stringify(messageToEncrypt),
                    self,
                    outgoingDisplayName,
                    outgoingUserIcon
                  ),
                ];
              }
            } else {
              sessions = [
                ...sessions,
                ...(await secureChannel.NewDoubleRatchetSenderSession(
                  keyset.deviceKeyset,
                  self.user_address,
                  self.device_registrations
                    .concat(counterparty.device_registrations)
                    .find((d) => d.inbox_registration.inbox_address === inbox)!,
                  JSON.stringify(messageToEncrypt),
                  outgoingDisplayName,
                  outgoingUserIcon
                )),
              ];
            }
          }

          for (const session of sessions) {
            const newEncryptionState: EncryptionState = {
              state: JSON.stringify({
                ratchet_state: session.ratchet_state,
                receiving_inbox: session.receiving_inbox,
                tag: session.tag,
                sending_inbox: session.sending_inbox,
              } as secureChannel.DoubleRatchetStateAndInboxKeys),
              timestamp: Date.now(),
              inboxId: session.receiving_inbox.inbox_address,
              conversationId: address + '/' + address,
              sentAccept: session.sent_accept,
            };
            await this.messageDB.saveEncryptionState(newEncryptionState, true);
            outbounds.push(
              JSON.stringify({
                type: 'listen',
                inbox_addresses: [session.receiving_inbox.inbox_address],
              })
            );
            outbounds.push(
              JSON.stringify({ type: 'direct', ...session.sealed_message })
            );
          }
        });

        // Save to IndexedDB (without sendStatus/sendError)
        await this.saveMessage(
          messageToEncrypt as Message,
          this.messageDB,
          address,
          address,
          'direct',
          {
            user_icon:
              conversation?.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
            display_name:
              conversation?.conversation?.displayName ?? t`Unknown User`,
          },
          // Retrying our OWN failed send, so we are provably the author.
          // Deliberately NOT `failedMessage.content.senderId` (which the
          // argument below still uses): that is payload, and payload is
          // precisely what this field exists to stop trusting.
          currentPasskeyInfo.address,
          failedMessage.content?.senderId // Update lastReadTimestamp for own messages
        );

        // Update status to 'sent'
        this.updateMessageStatus(
          queryClient,
          address,
          address,
          failedMessage.messageId,
          'sent'
        );

        return outbounds;
      } catch (error) {
        // Revert status to 'failed' with updated error
        const sanitizedError = this.sanitizeError(error);
        this.updateMessageStatus(
          queryClient,
          address,
          address,
          failedMessage.messageId,
          'failed',
          sanitizedError
        );
        console.error('Retry DM failed:', error);
        return outbounds;
      }
    });
  }

  /**
   * Deletes conversation: removes messages, encryption states, updates cache.
   */
  async deleteConversation(
    conversationId: string,
    currentPasskeyInfo: {
      credentialId: string;
      address: string;
      publicKey: string;
      displayName?: string;
      pfpUrl?: string;
      completedOnboarding: boolean;
    },
    queryClient: QueryClient,
    keyset: {
      deviceKeyset: secureChannel.DeviceKeyset;
      userKeyset: secureChannel.UserKeyset;
    },
    submitMessage: (
      address: string,
      pendingMessage: string | object,
      self: secureChannel.UserRegistration,
      counterparty: secureChannel.UserRegistration,
      queryClient: QueryClient,
      currentPasskeyInfo: {
        credentialId: string;
        address: string;
        publicKey: string;
        displayName?: string;
        pfpUrl?: string;
        completedOnboarding: boolean;
      },
      keyset: {
        deviceKeyset: secureChannel.DeviceKeyset;
        userKeyset: secureChannel.UserKeyset;
      },
      inReplyTo?: string,
      skipSigning?: boolean
    ) => Promise<void>
  ) {
    try {
      const [spaceId, channelId] = conversationId.split('/');
      // Notify counterparty for direct conversations before local deletion
      if (spaceId && channelId && spaceId === channelId) {
        try {
          const counterparty = await this.apiClient.getUser(spaceId);

          if (currentPasskeyInfo?.address) {
            const self = await this.apiClient.getUser(
              currentPasskeyInfo?.address!
            );
            // Timestamped send-side log so any RESET SIGNAL received later
            // (see the receive-side warns) can be correlated with the reset
            // that emitted it — or exposed as stale if none matches.
            logger.warn(
              '[MessageService] ⚠️ RESET SIGNAL sending (delete-conversation + delete-conversation-self)',
              { conversation: spaceId?.slice(0, 16), at: Date.now() }
            );
            // 1. Notify the counterparty: resets their encryption session.
            await submitMessage(
              spaceId,
              { type: 'delete-conversation' },
              self.data,
              counterparty.data,
              queryClient,
              currentPasskeyInfo,
              keyset,
              undefined,
              false
            );
            // 2. Self-sync: tell our OWN other devices to delete the whole
            // conversation. The fan-out reaches both parties, but the receive
            // handler acts on delete-conversation-self only when the sender is
            // self, so the counterparty can never trigger a delete on us.
            await submitMessage(
              spaceId,
              {
                type: 'delete-conversation-self',
                senderId: currentPasskeyInfo.address,
                conversationAddress: spaceId,
              },
              self.data,
              counterparty.data,
              queryClient,
              currentPasskeyInfo,
              keyset,
              undefined,
              false
            );
          }
        } catch { /* Best effort notification - deletion still proceeds */ }
      }
      await this.deleteConversationLocally(conversationId, queryClient);
    } catch {
      // no-op
    }
  }

  // Full local teardown of a DM conversation (states, mappings, messages,
  // metadata, cache). No outbound send. Used by deleteConversation (after
  // signalling) and by the delete-conversation-self receive handler.
  private async deleteConversationLocally(
    conversationId: string,
    queryClient: QueryClient
  ) {
    const [spaceId, channelId] = conversationId.split('/');
    const states = await this.messageDB.getEncryptionStates({ conversationId });
    for (const state of states) {
      await this.messageDB.deleteEncryptionState(state);
      if (state.inboxId) {
        await this.messageDB.deleteInboxMapping(state.inboxId);
      }
    }
    await this.messageDB.deleteLatestState(conversationId);
    await this.messageDB.deleteMessagesForConversation(conversationId);
    await this.messageDB.deleteConversationUsers(conversationId);
    await this.messageDB.deleteConversation(conversationId);
    if (spaceId && spaceId === channelId) {
      await this.messageDB.deleteUser(spaceId);
    }
    await queryClient.invalidateQueries({
      queryKey: buildMessagesKeyPrefix({ spaceId, channelId }),
    });
    await queryClient.invalidateQueries({
      queryKey: buildConversationKey({ conversationId }),
    });
    await queryClient.invalidateQueries({
      queryKey: buildConversationsKey({ type: 'direct' }),
    });
  }
}
