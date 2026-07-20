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
  resolveVerifiedSender,
  authorizeControlMessage,
  isControlMessageType,
  shouldSignEdit,
  canManageReadOnlyChannel,
  verifyDeviceKeyStatement,
  type ControlMessageContent,
  type DeviceKeyStatement,
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
  buildMessagesKey,
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
import { showWarning, noteSyncActivity } from '../utils/toast';
import { notificationService } from './NotificationService';
import type { ActionQueueService } from './ActionQueueService';
import type { ReceiptService, ReceiptEnvelopeFields } from '@quilibrium/quorum-shared';
import { TypingService, type TypingMessage } from '@quilibrium/quorum-shared';
import { ENABLE_DM_ACTION_QUEUE } from '../config/features';
import { dmRatchetMutex } from '../utils/keyedMutex';
import { isStaleInitEnvelope } from '../utils/initEnvelopeGuard';
import { ThreadService } from './ThreadService';
import type { Ref } from '../types/ref';
import type { SpaceInfoMap, SyncInfoMap } from '../types/spaceRefs';

// Visible-content types gated by read-only-channel enforcement. Control
// messages (reaction/pin/edit/remove/…) carry their own authorization.
const READ_ONLY_GATED_TYPES = new Set(['post', 'embed', 'sticker']);
const isReadOnlyGatedType = (type: string): boolean =>
  READ_ONLY_GATED_TYPES.has(type);

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
  private directSync: (spaceId: string, message: any) => Promise<void>;
  private saveConfig: (args: { config: any; keyset: any }) => Promise<void>;
  private sendHubMessage: (spaceId: string, message: string) => Promise<string>;
  private handleSyncInitiateV2: (spaceId: string, message: any) => Promise<void>;
  private handleSyncManifest: (spaceId: string, targetInbox: string, payload: any) => Promise<void>;

  private threadService: ThreadService;

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

  // Broadcasts the sender's current profile to every DM partner over their
  // existing session, so receivers can refresh their stored displayName /
  // icon / bio. Per-partner failures (no established session yet, etc.) are
  // logged and skipped — never block the user-facing profile save.
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

    for (const conv of conversations) {
      const partnerAddress = conv.address;
      if (!partnerAddress || partnerAddress === selfUserAddress) continue;

      const msg: DMUpdateProfileMessage = {
        type: 'dm-update-profile',
        senderId: selfUserAddress,
        displayName,
        userIcon,
        ...(bio !== undefined ? { bio } : {}),
      };

      try {
        await this.encryptAndSendDm(
          partnerAddress,
          msg as unknown as Record<string, unknown>,
          selfUserAddress,
          keyset,
        );
      } catch (err) {
        logger.warn('[DMProfile] broadcast to partner failed', {
          err,
          partner: partnerAddress.slice(0, 16),
        });
      }
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
          this.receiptService.onReadAckReceived(upToMessageId, upToTimestamp, senderAddress);
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
    if (raw.type === 'dm-update-profile') {
      const profileMsg = raw as DMUpdateProfileMessage;
      if (profileMsg.senderId === senderAddress) {
        this.handleDMProfileUpdate(senderAddress, profileMsg, queryClient).catch((err) => {
          logger.warn('[DMProfile] handleDMProfileUpdate failed', { err, sender: senderAddress.slice(0, 16) });
        });
      } else {
        logger.warn('[DMProfile] Rejected dm-update-profile with mismatched senderId', {
          envelopeSender: senderAddress.slice(0, 16),
          claimedSender: profileMsg.senderId?.slice(0, 16),
        });
      }
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
      this.receiptService.onReadAckReceived(readAckUpTo.messageId, readAckUpTo.timestamp, senderAddress);
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
    profileMsg: DMUpdateProfileMessage,
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
    const resolvedTag: BroadcastSpaceTag | undefined = currentTag?.letters
      ? { ...currentTag, spaceId: space.spaceId }
      : undefined;

    // 7. Broadcast update-profile to all spaces
    const allSpaces = await this.messageDB.getSpaces();
    this.enqueueOutbound(async () => {
      const outbounds: string[] = [];

      for (const s of allSpaces) {
        try {
          // Per-space profile follows the sender's global value unless a
          // deliberate OVERRIDE was set in this space. The stored member
          // row carries an override iff its field is a non-empty value;
          // empty/absent = follow global. We must NOT stamp the global
          // config value as a per-space field (that froze the space to a
          // stale global and broke "clear the override" — the bug this
          // whole effort removes). So: send the per-space override if one
          // exists, else OMIT the field so receivers fall back to the
          // sender's global (public-profile) value via the render fallback.
          // (See per-space-profile-empty-follows-global design.)
          const ownMember = await this.messageDB.getSpaceMember(
            s.spaceId,
            selfAddress
          );
          const nameOverride = ownMember?.display_name || undefined;
          // Member avatar lives on `user_icon` (typed UserProfile field);
          // some rows also carry `profile_image` from other write paths, so
          // read both defensively (mirrors the fallback at line ~4479).
          const iconOverride =
            ownMember?.user_icon ||
            (ownMember as { profile_image?: string })?.profile_image ||
            undefined;
          const bioOverride = ownMember?.bio || undefined;

          const nonce = crypto.randomUUID();
          // Current GLOBAL identity from config — carried in the global* slots
          // so members who missed the global save learn it on our tag-rotation
          // rebroadcast. Separate from the override fields. (Two-slot design.)
          const globalName = config.name || undefined;
          const globalIcon = config.profile_image || undefined;
          const globalBioVal = config.bio || undefined;
          const updateProfileMessage = {
            type: 'update-profile',
            senderId: selfAddress,
            // Omit any field with no per-space override — the receiver's
            // upsert merge treats absent fields as "no change" and its
            // render fallback surfaces the sender's global value. Only a
            // real per-space override goes on the wire.
            ...(nameOverride !== undefined ? { displayName: nameOverride } : {}),
            ...(iconOverride !== undefined ? { userIcon: iconOverride } : {}),
            ...(bioOverride !== undefined ? { bio: bioOverride } : {}),
            ...(globalName !== undefined ? { globalDisplayName: globalName } : {}),
            ...(globalIcon !== undefined ? { globalUserIcon: globalIcon } : {}),
            ...(globalBioVal !== undefined ? { globalBio: globalBioVal } : {}),
            ...(resolvedTag ? { spaceTag: resolvedTag } : {}),
          } as UpdateProfileMessage;

          const messageId = await crypto.subtle.digest(
            'SHA-256',
            Buffer.from(
              nonce +
                'update-profile' +
                selfAddress +
                canonicalize(updateProfileMessage),
              'utf-8'
            )
          );

          const message = {
            spaceId: s.spaceId,
            channelId: s.defaultChannelId,
            messageId: Buffer.from(messageId).toString('hex'),
            digestAlgorithm: 'SHA-256',
            nonce,
            createdDate: Date.now(),
            modifiedDate: Date.now(),
            lastModifiedHash: '',
            content: updateProfileMessage,
          } as Message;

          // Sign (non-repudiable — required for profile updates)
          const inboxKey = await this.getSigningKey(s.spaceId);
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
    // Strip ephemeral fields if requested (for retries)
    const messageToSend = options.stripEphemeralFields
      ? (({ sendStatus: _sendStatus, sendError: _sendError, ...rest }) => rest)(message as any)
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
      const sets = response.map((e) => JSON.parse(e.state));

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
   * `decryptedContent.publicKey` is non-null only after signature verification
   * (see the verify blocks); unsigned/invalid control messages resolve to a
   * null sender and are dropped (except the unsigned-edit-of-unsigned case).
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
   * Resolve a verified signer against BOTH the join-bound member table and the
   * per-device signing keys admitted via master-signed statements. Every
   * control/read-only/update-profile auth path funnels through here so the
   * two lookup paths stay consistent.
   */
  private async resolveSpaceSender(
    publicKey: string,
    messageDB: MessageDB,
    spaceId: string,
    members: SpaceMemberRow[]
  ) {
    const deviceKeys = await messageDB.getSpaceMemberDevices(spaceId);
    return resolveVerifiedSender(
      publicKey,
      members as unknown as Parameters<typeof resolveVerifiedSender>[1],
      deviceKeys as unknown as Parameters<typeof resolveVerifiedSender>[2]
    );
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
    const verifiedSender = decryptedContent.publicKey
      ? await this.resolveSpaceSender(
          decryptedContent.publicKey,
          messageDB,
          spaceId,
          members
        )
      : null;
    return authorizeControlMessage({
      content: decryptedContent.content as ControlMessageContent,
      verifiedSender,
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
    spaceId: string
  ): Promise<boolean> {
    if (!decryptedContent.publicKey || !decryptedContent.signature) {
      return false;
    }
    const members = await messageDB.getSpaceMembers(spaceId);
    const verifiedSender = await this.resolveSpaceSender(
      decryptedContent.publicKey,
      messageDB,
      spaceId,
      members
    );
    return (
      verifiedSender === null ||
      verifiedSender === decryptedContent.content.senderId
    );
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
    if (!decryptedContent.publicKey || !decryptedContent.signature) {
      return false;
    }
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
    if (
      decryptedContent.messageId !== Buffer.from(messageId).toString('hex') ||
      ch.js_verify_ed448(
        Buffer.from(decryptedContent.publicKey, 'hex').toString('base64'),
        Buffer.from(messageId).toString('base64'),
        Buffer.from(decryptedContent.signature, 'hex').toString('base64')
      ) !== 'true'
    ) {
      return false;
    }
    const verifiedSender = await this.resolveSpaceSender(
      decryptedContent.publicKey,
      this.messageDB,
      space.spaceId,
      members
    );
    return (
      !!verifiedSender &&
      canManageReadOnlyChannel(verifiedSender, false, space, channel)
    );
  }

  /**
   * Saves message to DB and updates query cache.
   * @param currentUserAddress - Pass current user's address when sending messages to update lastReadTimestamp
   */
  async saveMessage(
    decryptedContent: Message,
    messageDB: MessageDB,
    spaceId: string,
    channelId: string,
    conversationType: string,
    updatedUserProfile: { user_icon?: string; display_name?: string },
    currentUserAddress?: string
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
      // .agents/tasks/2026-06-25-MASTER-RECAP-control-message-auth.md.
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

      // Check edit time window (15 minutes = 900000 ms)
      const editTimeWindow = 15 * 60 * 1000;
      const timeSinceCreation = Date.now() - targetMessage.createdDate;
      if (timeSinceCreation > editTimeWindow) {
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
        // For DMs, check conversation setting
        const conversationId = `${spaceId}/${channelId}`;
        const conversation = await messageDB.getConversation({
          conversationId,
        });
        saveEditHistoryEnabled =
          conversation?.conversation?.saveEditHistory ?? false;
      } else {
        // For spaces, check space setting
        const space = await messageDB.getSpace(spaceId);
        saveEditHistoryEnabled = space?.saveEditHistory ?? false;
      }

      // Check if this edit has already been applied (by comparing lastModifiedHash with editNonce)
      // This prevents duplicate edits when processing the same edit message multiple times
      const isAlreadyApplied =
        targetMessage.lastModifiedHash === editMessage.editNonce;

      // Preserve current content in edits array before updating (only if saveEditHistory is enabled)
      const currentText =
        targetMessage.content.type === 'post' ? targetMessage.content.text : '';

      // Create edits array if it doesn't exist
      const existingEdits = targetMessage.edits || [];

      // Only add to edits if saveEditHistory is enabled AND this edit hasn't been applied yet
      let edits: Array<{
        text: string | string[];
        modifiedDate: number;
        lastModifiedHash: string;
      }>;

      if (isAlreadyApplied) {
        // Edit already applied: use existing edits array (don't modify)
        edits = existingEdits;
      } else if (!saveEditHistoryEnabled) {
        // saveEditHistory disabled: don't preserve edits
        edits = [];
      } else if (targetMessage.modifiedDate === targetMessage.createdDate) {
        // First edit: add original content to edits array
        edits = [
          {
            text: currentText,
            modifiedDate: targetMessage.createdDate,
            lastModifiedHash: targetMessage.nonce, // Use original nonce as hash
          },
        ];
      } else if (existingEdits.length > 0) {
        // Subsequent edits: add current version (which is now the previous version)
        edits = [
          ...existingEdits,
          {
            text: currentText,
            modifiedDate: targetMessage.modifiedDate,
            lastModifiedHash:
              targetMessage.lastModifiedHash || targetMessage.nonce,
          },
        ];
      } else {
        // Edge case: edited before but edits array is empty (shouldn't happen, but handle gracefully)
        edits = existingEdits;
      }

      // Update the original message with edited text and mentions
      const updatedMessage: Message = {
        ...targetMessage,
        modifiedDate: editMessage.editedAt,
        lastModifiedHash: editMessage.editNonce,
        mentions: editMessage.mentions || targetMessage.mentions, // Update mentions if provided
        content: {
          ...targetMessage.content,
          text: editMessage.editedText,
        } as PostMessage,
        edits: edits,
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
      await this.threadService.handleThreadReceive({
        threadMsg,
        spaceId,
        channelId,
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
          spaceId
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
      const inboundTag = decryptedContent.content.spaceTag;
      participant.spaceTag =
        inboundTag &&
        validateSpaceTagLetters(inboundTag.letters) &&
        isValidSpaceTagUrl(inboundTag.url)
          ? inboundTag
          : undefined;
      await messageDB.saveSpaceMember(spaceId, participant);
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
        { ...decryptedContent, channelId: channelId, spaceId: spaceId },
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

                      // Check edit time window (15 minutes)
                      const editTimeWindow = 15 * 60 * 1000;
                      const timeSinceCreation = Date.now() - m.createdDate;
                      if (timeSinceCreation > editTimeWindow) {
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
      await this.threadService.handleThreadCache({
        threadMsg,
        spaceId,
        channelId,
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
          spaceId
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
      // Validate inbound spaceTag — reject SVG data URIs (XSS) and oversized payloads
      const inboundTag = decryptedContent.content.spaceTag;
      participant.spaceTag =
        inboundTag &&
        validateSpaceTagLetters(inboundTag.letters) &&
        isValidSpaceTagUrl(inboundTag.url)
          ? inboundTag
          : undefined;
      await this.messageDB.saveSpaceMember(spaceId, participant);
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
            senderDisplayName: currentPasskeyInfo.displayName,
            senderUserIcon: currentPasskeyInfo.pfpUrl,
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

        // Check edit time window (15 minutes)
        const editTimeWindow = 15 * 60 * 1000;
        const timeSinceCreation = Date.now() - originalMessage.createdDate;
        if (timeSinceCreation > editTimeWindow) {
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
          const sets = response.map((e) => JSON.parse(e.state));

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
                    currentPasskeyInfo!.displayName,
                    currentPasskeyInfo?.pfpUrl
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
                    currentPasskeyInfo!.displayName,
                    currentPasskeyInfo?.pfpUrl
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
                  currentPasskeyInfo!.displayName,
                  currentPasskeyInfo?.pfpUrl
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
        const sets = response.map((e) => JSON.parse(e.state));

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
                  currentPasskeyInfo!.displayName,
                  currentPasskeyInfo?.pfpUrl
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
                  currentPasskeyInfo!.displayName,
                  currentPasskeyInfo?.pfpUrl
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
                currentPasskeyInfo!.displayName,
                currentPasskeyInfo?.pfpUrl
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
        currentPasskeyInfo.address // Update lastReadTimestamp for own messages
      );
      await this.addMessage(queryClient, address, address, message);
      await this.addOrUpdateConversation(
        queryClient,
        address,
        Date.now(),
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

        let decryptedContent: Message | null = null;
        let newState: any | null = null;

        let conversationId = session.user_address + '/' + session.user_address;

        let updatedUserProfile: secureChannel.UserProfile | undefined;
        decryptedContent = JSON.parse(session.message);

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
          await this.deleteInboxMessages(
            keyset.deviceKeyset.inbox_keyset,
            [envelope.timestamp],
            this.apiClient
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
          await this.deleteInboxMessages(
            keyset.deviceKeyset.inbox_keyset,
            [envelope.timestamp],
            this.apiClient
          );
          return;
        }
        // delete-conversation-self: another of OUR OWN devices deleted this DM.
        // Delete the whole conversation here too. Gated to self — the
        // counterparty also receives the fan-out but must never delete our copy.
        // (Self-sync messages only arrive on this init-envelope branch.)
        if (
          decryptedContent?.content?.type === 'delete-conversation-self' &&
          decryptedContent.content.senderId === self_address
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
          await this.deleteInboxMessages(
            keyset.deviceKeyset.inbox_keyset,
            [envelope.timestamp],
            this.apiClient
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
            logger.warn(
              '[MessageService] ⚠️ STALE init envelope IGNORED — zombie defused, keeping current session',
              {
                conversationId: conversationId?.slice(0, 16),
                envelopeTimestamp: envelope.timestamp,
                envelopeAgeSeconds: Math.round(
                  (Date.now() - envelope.timestamp) / 1000
                ),
                newestRowTimestamp: Math.max(...existing.map((e) => e.timestamp)),
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
          // Stale envelope refused: delete it from the server so it cannot
          // be redelivered again (defuse the mine), keep the current session.
          await this.deleteInboxMessages(
            keyset.deviceKeyset.inbox_keyset,
            [envelope.timestamp],
            this.apiClient
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

          // Process delivery receipt data (intercept ack control messages, extract piggybacked acks, buffer for acking)
          const userConfig = await this.messageDB.getUserConfig({ address: self_address });
          const conversation = await this.messageDB.getConversation({
            conversationId,
          });
          const effectiveDeliveryReceipts = conversation.conversation?.deliveryReceipts ?? !!userConfig?.deliveryReceipts;
          const effectiveReadReceipts = conversation.conversation?.readReceipts ?? !!userConfig?.readReceipts;
          if (this.interceptControlMessages(decryptedContent, session.user_address, self_address, effectiveDeliveryReceipts, effectiveReadReceipts, queryClient)) {
            // delivery-ack control message — encryption state saved, but don't save/display the message
            return;
          }
          await this.saveMessage(
            decryptedContent,
            this.messageDB,
            session.user_address,
            session.user_address,
            'direct',
            updatedUserProfile ?? {
              user_icon:
                conversation?.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
              display_name:
                conversation?.conversation?.displayName ?? t`Unknown User`,
            }
          );

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
          const profileToUse = updatedUserProfile ?? {
            user_icon:
              conversation?.conversation?.icon ?? DefaultImages.UNKNOWN_USER,
            display_name:
              conversation?.conversation?.displayName ?? t`Unknown User`,
          };
          await this.addOrUpdateConversation(
            queryClient,
            session.user_address,
            envelope.timestamp,
            0,
            profileToUse
          );
        } else {
          console.error(t`Failed to decrypt message with any known state`);
        }
        await this.deleteInboxMessages(
          keyset.deviceKeyset.inbox_keyset,
          [envelope.timestamp],
          this.apiClient
        );
      } catch {
        await this.deleteInboxMessages(
          keyset.deviceKeyset.inbox_keyset,
          [message.timestamp],
          this.apiClient
        );
        return;
      }
      return;
    }

    if (!found) {
      // No encryption state for this inbox — the frame cannot be decrypted
      // and is dropped. Historically this branch was fully silent, which hid
      // post-session-loss message losses across six months of debugging.
      // Keep the delete (leaving the frame would redeliver it forever) but
      // log loudly so the drop is visible in any debug session.
      logger.warn(
        '[MessageService] DM frame for unknown inbox — no encryption state, dropping unread',
        {
          inbox: message.inboxAddress?.slice(0, 12),
          timestamp: message.timestamp,
        }
      );
      await this.deleteInboxMessages(
        keyset.deviceKeyset.inbox_keyset,
        [message.timestamp],
        this.apiClient
      );
      return;
    }

    const conversationId = found.conversationId;
    const conversation = await this.messageDB.getConversation({
      conversationId,
    });

    let decryptedContent: Message | null = null;
    let newState: string | null = null;

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
        if (freshKeys.sending_inbox.inbox_public_key === '') {
          try {
            const result =
              await secureChannel.ConfirmDoubleRatchetSenderSession(
                JSON.parse(fresh.state),
                JSON.parse(message.encryptedContent)
              );
            const content = JSON.parse(result.message);
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
              await this.deleteInboxMessages(
                freshKeys.receiving_inbox,
                [message.timestamp],
                this.apiClient
              );
              return { outcome: 'handled' as const };
            }
            await this.messageDB.saveEncryptionState(
              {
                state: JSON.stringify({
                  ratchet_state: result.ratchet_state,
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
            logger.error('[MessageService] DM decrypt failed (ConfirmDoubleRatchetSenderSession) — skipping frame, keeping session', decryptError);
            await this.deleteInboxMessages(
              freshKeys.receiving_inbox,
              [message.timestamp],
              this.apiClient
            );
            return { outcome: 'handled' as const };
          }
        } else {
          try {
            const result = await secureChannel.DoubleRatchetInboxDecrypt(
              JSON.parse(fresh.state),
              JSON.parse(message.encryptedContent)
            );
            const maybeInit = result as {
              receiving_inbox: secureChannel.InboxKeyset;
              user_profile: secureChannel.UserProfile;
              tag: any;
              sending_inbox: secureChannel.SendingInbox;
              ratchet_state: string;
              message: string;
            };

            let advancedState: string;
            if (maybeInit.user_profile) {
              advancedState = JSON.stringify({
                ratchet_state: maybeInit.ratchet_state,
                receiving_inbox: maybeInit.receiving_inbox,
                sending_inbox: maybeInit.sending_inbox,
                tag: maybeInit.tag,
              });
            } else {
              advancedState = JSON.stringify({
                ratchet_state: result.ratchet_state,
                receiving_inbox: freshKeys.receiving_inbox,
                sending_inbox: freshKeys.sending_inbox,
                tag: freshKeys.tag,
              });
            }
            const content = JSON.parse(result.message);
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
              await this.deleteInboxMessages(
                freshKeys.receiving_inbox,
                [message.timestamp],
                this.apiClient
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
            return {
              outcome: 'ok' as const,
              content,
              sentAccept: fresh.sentAccept,
              updatedUserProfile: undefined,
            };
          } catch (decryptError) {
            // Double Ratchet spec: on a decrypt/authentication failure, discard the
            // message but LEAVE the session state untouched — a single bad/duplicate/
            // out-of-order frame does not mean the session is broken, and later frames
            // decrypt fine. Destroying the session here was the root cause of the
            // long-standing "DM direction goes permanently dead" bug: the sender kept
            // encrypting to a session the receiver had torn down.
            // (https://signal.org/docs/specifications/doubleratchet/)
            logger.error('[MessageService] DM decrypt failed (DoubleRatchetInboxDecrypt) — skipping frame, keeping session', decryptError);
            await this.deleteInboxMessages(
              freshKeys.receiving_inbox,
              [message.timestamp],
              this.apiClient
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
      // State already persisted inside the locked section — `newState` stays
      // null so the deferred tail save (space path) does not run for DMs.
    } else {
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
              // .agents/bugs/2026-06-13-space-members-missing-no-join-row.md).
              // Optional-chain the deref; a missing inbox_address means we have
              // nothing to compare against, so there is no mismatch to flag and
              // the signature is verified below as normal. Without the guard
              // this threw a TypeError that the outer catch swallowed, silently
              // dropping the message on non-repudiable spaces.
              const inboxMismatch =
                !isUpdateProfile &&
                participant?.inbox_address !== inboxAddress &&
                participant?.inbox_address;
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
                this.messageDB.saveSpaceMember(conversationId.split('/')[0], {
                  user_address: participant.address,
                  user_icon: participant.userIcon,
                  display_name: participant.displayName,
                  inbox_address: participant.inboxAddress,
                  isKicked: false,
                  joinedAt: participant.joinedAt,
                });
                await queryClient.setQueryData(
                  buildSpaceMembersKey({
                    spaceId: conversationId.split('/')[0],
                  }),
                  (oldData: (secureChannel.UserProfile & { joinedAt?: number })[]) => {
                    return [
                      ...(oldData ?? []),
                      {
                        user_address: participant.address,
                        user_icon: participant.userIcon,
                        display_name: participant.displayName,
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
                    {}
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
                      {}
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
                    {}
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
                  await this.messageDB.deleteSpace(spaceId);
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
              logger.log(`[MessageService] sync-info: No active session or expired, ignoring`);
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
                  try {
                    const existing = await this.messageDB.getSpaceMember(
                      conversationId.split('/')[0],
                      (member as any).user_address
                    );
                    await this.messageDB.saveSpaceMember(
                      conversationId.split('/')[0],
                      {
                        ...(member as any),
                        isKicked: existing?.isKicked ?? false,
                        joinedAt: (member as any).joinedAt ?? existing?.joinedAt,
                      } as any
                    );
                  } catch {
                    await this.messageDB.saveSpaceMember(
                      conversationId.split('/')[0],
                      member as any
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
                    if (
                      (participant?.inbox_address !== inboxAddress &&
                        participant?.inbox_address) ||
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
                    {}
                  );
                }
                const channelIds = envelope.message.messages
                  .map((m: any) => m.channelId)
                  .sort();
                const checked = {} as { [id: string]: boolean };
                for (const channelId of channelIds) {
                  if (!checked[channelId]) {
                    checked[channelId] = true;
                    queryClient.refetchQueries({
                      queryKey: buildMessagesKey({
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

                noteSyncActivity();
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
                  {}
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
                  {}
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
                queryClient.refetchQueries({
                  queryKey: buildMessagesKey({
                    spaceId,
                    channelId,
                  }),
                });
              }

              noteSyncActivity();
            }

            // Apply member delta
            if (envelope.message.memberDelta) {
              for (const member of envelope.message.memberDelta.members || []) {
                // Map shared SpaceMember type to desktop DB format:
                // - address -> user_address
                // - profile_image -> user_icon
                // Handle both shared types and legacy field names
                const userAddress = member.address || member.user_address;
                if (!userAddress) {
                  continue;
                }
                const existing = await this.messageDB.getSpaceMember(spaceId, userAddress);
                const dbMember = {
                  ...member,
                  user_address: userAddress,
                  // Map profile_image to user_icon (desktop DB format)
                  user_icon: member.profile_image || member.user_icon,
                  // Preserve joinedAt from local DB if sync data doesn't have it
                  joinedAt: member.joinedAt ?? existing?.joinedAt,
                };
                await this.messageDB.saveSpaceMember(spaceId, dbMember);
              }
              queryClient.refetchQueries({
                queryKey: ['spaceMembers', spaceId],
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
      } catch (e) { console.error('[MessageService] Error processing hub/sync message:', e); }
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
        const effectiveDeliveryReceipts = conversation.conversation?.deliveryReceipts ?? !!userConfig?.deliveryReceipts;
        const effectiveReadReceipts = conversation.conversation?.readReceipts ?? !!userConfig?.readReceipts;
        if (this.interceptControlMessages(decryptedContent, senderAddress, self_address, effectiveDeliveryReceipts, effectiveReadReceipts, queryClient)) {
          // delivery-ack control message — encryption state saved, but don't save/display the message
          return;
        }

        const profileToUse = updatedUserProfile ?? {
          user_icon: conversation.conversation?.icon,
          display_name: conversation.conversation?.displayName,
        };
        await this.saveMessage(
          decryptedContent,
          this.messageDB,
          conversationId.split('/')[0],
          conversationId.split('/')[0],
          keys.sending_inbox ? 'direct' : 'group',
          profileToUse
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
          keys.sending_inbox ? 'direct' : 'group',
          updatedUserProfile ?? {
            user_icon: conversation.conversation?.icon,
            display_name: conversation.conversation?.displayName,
          }
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
            // spoofable payload senderId) held mention:everyone. The verify
            // block above always verifies @everyone-bearing posts, so a present
            // publicKey here is proven. We drop `space` from
            // isMentionedWithSettings (disabling its payload-based @everyone
            // check) and do the @everyone check ourselves against the verified
            // signer; user/@role checks are unaffected (they don't use space).
            const everyoneSender = decryptedContent.publicKey
              ? await this.resolveSpaceSender(
                  decryptedContent.publicKey,
                  this.messageDB,
                  spaceId,
                  await this.messageDB.getSpaceMembers(spaceId)
                )
              : null;
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
      await this.deleteInboxMessages(
        keys.receiving_inbox,
        [message.timestamp],
        this.apiClient
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

      await this.deleteInboxMessages(
        {
          inbox_address: inbox_key.address!,
          inbox_encryption_key: {} as never,
          inbox_key: {
            type: 'ed448',
            public_key: hexToSpreadArray(inbox_key.publicKey),
            private_key: hexToSpreadArray(inbox_key.privateKey),
          },
        },
        [message.timestamp],
        this.apiClient
      );
    }
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
      const effectiveSkipSigning = targetChannel?.isReadOnly
        ? false
        : skipSigning;

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

        // Check edit time window (15 minutes)
        const editTimeWindow = 15 * 60 * 1000;
        const timeSinceCreation = Date.now() - originalMessage.createdDate;
        if (timeSinceCreation > editTimeWindow) {
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
        // Strip ephemeral fields before encrypting (declared outside the
        // lock — also used by saveMessage after it)
        const { sendStatus: _sendStatus, sendError: _sendError, ...messageToEncrypt } = failedMessage;
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
          const sets = response.map((e) => JSON.parse(e.state));

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
                    currentPasskeyInfo!.displayName,
                    currentPasskeyInfo?.pfpUrl
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
                    currentPasskeyInfo!.displayName,
                    currentPasskeyInfo?.pfpUrl
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
                  currentPasskeyInfo!.displayName,
                  currentPasskeyInfo?.pfpUrl
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
      queryKey: buildMessagesKey({ spaceId, channelId }),
    });
    await queryClient.invalidateQueries({
      queryKey: buildConversationKey({ conversationId }),
    });
    await queryClient.invalidateQueries({
      queryKey: buildConversationsKey({ type: 'direct' }),
    });
  }
}
