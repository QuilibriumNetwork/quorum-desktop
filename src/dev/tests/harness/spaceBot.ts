// A headless client that can hold SPACE membership — the DM bot's sibling.
//
// Same construction as `bot.ts` (real identity, real MessageDB on
// fake-indexeddb, real ws transport, real MessageService, the saveMessage
// capture seam), with the space/sync service graph wired for real instead of
// stubbed. See `spaceDeps.ts` for why that graph is built in the order it is.
//
// What it adds over the DM bot:
//   - createSpace / inviteLink / join / post, driven through the real services
//   - a MEMBER capture seam. Space messages land via saveMessage like DMs, but
//     the member roster lands via `messageDB.saveSpaceMember`, on a completely
//     different path (sync-delta → memberDelta apply). The bug this harness
//     exists for is a roster that does not arrive, so "how many member rows did
//     the real code persist, and when" has to be observable directly rather
//     than inferred from message traffic.
import { QueryClient } from '@tanstack/react-query';
import { logger, type Message, type UserRegistration } from '@quilibrium/quorum-shared';
import type { MessageDB } from '../../../db/messages';
import type { EncryptedMessage } from '../../../db/messages';
import { makeMessageDB } from './storage';
import { makeApiClient, WsTransport } from './transport';
import { createSpaceGraph, type SpaceGraph } from './spaceDeps';
import { deleteInboxMessages } from './deps';
import { loadOrCreateBot, type Bot as Identity } from './identity';

/** One member row as the real code persisted it, with arrival time. */
export interface MemberWrite {
  t: number;
  spaceId: string;
  userAddress: string | undefined;
  displayName: string | undefined;
}

export interface HarnessSpaceBot {
  identity: Identity;
  transport: WsTransport;
  messageDB: MessageDB;
  queryClient: QueryClient;
  graph: SpaceGraph;
  /** Every message the real code persisted, in arrival order. */
  captured: Message[];
  /** Every space-member row the real code persisted, in write order. */
  memberWrites: MemberWrite[];
  /**
   * Receive-path failures the service reported.
   *
   * `replay` splits the two kinds, and the split is load-bearing: a frame this
   * bot already decrypted is refused on a second delivery, which is the protocol
   * working. Un-acked frames are redelivered on every `listen`, so replays
   * dominate a raw count. **Quote `novelErrors()`, never `errors`.**
   */
  errors: { t: number; message: string; frame: unknown; replay: boolean }[];
  /** Failures on a frame never successfully decrypted before. */
  novelErrors(): { t: number; message: string; frame: unknown; replay: boolean }[];
  onDecrypted?: (m: Message) => void;
  onMember?: (w: MemberWrite) => void;

  /** Create a space (bot becomes owner). Returns its ids. */
  createSpace(spaceName: string): Promise<{ spaceId: string; channelId: string }>;
  /** Mint a one-time invite link for a space this bot owns. */
  inviteLink(spaceId: string): Promise<string>;
  /** Join a space from an invite link. */
  join(inviteLink: string): Promise<{ spaceId: string; channelId: string }>;
  /** Post a text message to a channel via the real submitChannelMessage path. */
  post(spaceId: string, channelId: string, text: string): Promise<void>;
  /** Ask the space for a roster/message sync (the pull under investigation). */
  requestSync(spaceId: string): Promise<boolean>;
  /** Member rows currently on disk for a space. */
  members(spaceId: string): Promise<number>;
  /** Wait until everything enqueued so far has been handed to the socket. */
  flush(timeoutMs?: number): Promise<boolean>;
  /** Fetch + delete queued frames on the device inbox. */
  drainInbox(): Promise<number>;
  start(): Promise<void>;
  stop(): void;
}

export async function createSpaceBot(
  name: string,
  opts: { privateKeyHex?: string } = {}
): Promise<HarnessSpaceBot> {
  const apiClient = makeApiClient();
  const identity = await loadOrCreateBot(name, apiClient, opts);
  const messageDB = await makeMessageDB(name);
  const transport = new WsTransport();
  const queryClient = new QueryClient();

  const graph = createSpaceGraph({
    messageDB,
    apiClient,
    transport,
    queryClient,
    selfAddress: identity.address,
    keyset: identity.keyset,
  });

  // Subscribe to the device inbox plus every encryption-state inbox. Space
  // membership writes an encryption state whose inboxId IS the space inbox, so
  // spaces are covered by the same rule the DM bot uses — no special case.
  // Only re-sent when the set changes: a `listen` makes the relay re-push
  // everything still queued (see bot.ts).
  let subscribed = '';
  const refreshSubscriptions = async () => {
    const states = await messageDB.getAllEncryptionStates();
    const addresses = [identity.inboxAddress, ...states.map((s) => s.inboxId)];
    const key = [...new Set(addresses)].sort().join(',');
    if (key === subscribed) return;
    subscribed = key;
    transport.listen(addresses);
  };

  const passkeyInfo = {
    credentialId: '',
    address: identity.address,
    publicKey: Buffer.from(
      new Uint8Array(identity.keyset.userKeyset.user_key.public_key)
    ).toString('hex'),
    completedOnboarding: true,
  };

  /** Resolve once no queue task is pending or processing (or the wait expires). */
  const drainActionQueue = async (timeoutMs = 30_000): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const stats = await graph.actionQueueService.getStats();
      if (stats.pending === 0 && stats.processing === 0) return true;
      if (Date.now() >= deadline) return false;
      await new Promise((r) => setTimeout(r, 50));
    }
  };

  const bot: HarnessSpaceBot = {
    identity,
    transport,
    messageDB,
    queryClient,
    graph,
    captured: [],
    memberWrites: [],
    errors: [],
    novelErrors: () => bot.errors.filter((e) => !e.replay),

    createSpace: async (spaceName: string) => {
      const registration = (await apiClient.getUser(identity.address))
        ?.data as UserRegistration;
      if (!registration) throw new Error(`no registration for ${identity.address}`);
      const ids = await graph.spaceService.createSpace(
        spaceName,
        '',
        identity.keyset,
        registration as unknown as Parameters<SpaceGraph['spaceService']['createSpace']>[3],
        false,
        false,
        '',
        '',
        queryClient
      );
      await graph.outbound.flush();
      await refreshSubscriptions();
      return ids;
    },

    inviteLink: (spaceId: string) => graph.invitationService.constructInviteLink(spaceId),

    join: async (link: string) => {
      const result = await graph.invitationService.joinInviteLink(
        link,
        identity.keyset,
        passkeyInfo
      );
      if (!result) throw new Error('joinInviteLink returned nothing (unparseable link?)');
      await graph.outbound.flush();
      await refreshSubscriptions();
      return result;
    },

    post: async (spaceId: string, channelId: string, text: string) => {
      await graph.messageService.submitChannelMessage(
        spaceId,
        channelId,
        text,
        queryClient,
        passkeyInfo
      );
      // A channel post is enqueued on the ActionQueue and encrypted+sent by a
      // handler later, so submitChannelMessage returning means "queued", not
      // "sent". Wait for the queue to drain and THEN for the outbound FIFO,
      // in that order — the handler is what puts frames into the FIFO.
      await drainActionQueue();
      await graph.outbound.flush();
    },

    requestSync: (spaceId: string) => graph.syncService.requestSync(spaceId),

    members: async (spaceId: string) => (await messageDB.getSpaceMembers(spaceId)).length,

    flush: (timeoutMs?: number) => graph.outbound.flush(timeoutMs),

    drainInbox: async () => {
      const res = await apiClient.getInbox(identity.inboxAddress);
      const timestamps = (res?.data ?? []).map((m) => m.timestamp);
      if (timestamps.length) {
        await deleteInboxMessages(
          identity.keyset.deviceKeyset.inbox_keyset,
          timestamps,
          apiClient
        );
      }
      return timestamps.length;
    },

    start: async () => {
      await transport.connect();
      await refreshSubscriptions();
      graph.actionQueueService.start();
    },

    stop: () => {
      graph.actionQueueService.stop();
      transport.close();
    },
  };

  // Capture seam 1 — messages. Faithful: this is the Message the real code chose
  // to persist, received or locally saved on send.
  const origSaveMessage = messageDB.saveMessage.bind(messageDB);
  (messageDB as unknown as { saveMessage: MessageDB['saveMessage'] }).saveMessage =
    async (message: Message, ...rest: unknown[]) => {
      bot.captured.push(message);
      bot.onDecrypted?.(message);
      return (origSaveMessage as (...a: unknown[]) => Promise<void>)(message, ...rest);
    };

  // Capture seam 2 — member rows. The roster arrives on the sync-delta path, not
  // the message path, so nothing above would see it.
  const origSaveMember = messageDB.saveSpaceMember.bind(messageDB);
  (messageDB as unknown as { saveSpaceMember: MessageDB['saveSpaceMember'] }).saveSpaceMember =
    async (spaceId: string, row: Record<string, unknown>, ...rest: unknown[]) => {
      const write: MemberWrite = {
        t: Date.now(),
        spaceId,
        userAddress: row?.user_address as string | undefined,
        displayName: row?.display_name as string | undefined,
      };
      bot.memberWrites.push(write);
      bot.onMember?.(write);
      return (origSaveMember as (...a: unknown[]) => Promise<void>)(spaceId, row, ...rest);
    };

  // Frames this bot has decrypted at least once, by ciphertext fingerprint.
  const decryptedOk = new Set<string>();

  // ⚠️ The space receive path does NOT report failures the way the DM path does,
  // and getting this wrong makes the harness lie in the most dangerous direction.
  //
  //   - Nothing propagates. The terminal catch of the whole hub/sync branch is
  //     `MessageService.ts:6110`, which swallows the error, so a try/catch around
  //     handleNewMessage sees nothing. Same as DM (see bot.ts note 2).
  //   - It logs through `console.error`, NOT `logger.error`. The DM path uses
  //     `logger.error`. A tee that wraps only `logger` therefore reports ZERO
  //     space failures no matter how many occur — a count that is structurally
  //     incapable of being non-zero, printed next to counts that are real.
  //
  // So both sinks are teed, and matching is against an explicit marker list
  // rather than a loose substring: `'Failed to'` alone also matches
  // `'Failed to re-broadcast space tag on manifest update'`, which is a
  // cosmetic tag rebroadcast and not a delivery failure at all.
  const FAILURE_MARKERS = [
    'Error processing hub/sync message', // MessageService.ts:6110 — the space branch
    'DM decrypt failed', // the DM branch, for a bot that does both
    'TripleRatchetDecrypt failed',
    'UnsealSyncEnvelope',
    'UnsealHubEnvelope',
  ];
  const isFailure = (first: string) => FAILURE_MARKERS.some((m) => first.includes(m));

  transport.onMessage(async (frame) => {
    let loggedFailure: string | undefined;
    const origLoggerError = logger.error;
    const origConsoleError = console.error;
    const tee = (orig: (...a: unknown[]) => unknown) =>
      ((...args: unknown[]) => {
        const first = String(args[0] ?? '');
        if (isFailure(first)) loggedFailure ??= `${first} ${String(args[1] ?? '')}`.trim();
        return orig(...args);
      }) as never;
    logger.error = tee(origLoggerError as (...a: unknown[]) => unknown);
    console.error = tee(origConsoleError as (...a: unknown[]) => unknown);
    try {
      await graph.messageService.handleNewMessage(
        identity.address,
        identity.keyset,
        frame as unknown as EncryptedMessage,
        queryClient
      );
    } catch (err) {
      loggedFailure ??= (err as Error)?.message ?? String(err);
    } finally {
      logger.error = origLoggerError;
      console.error = origConsoleError;
    }
    // Novel vs replay, exactly as the DM bot splits them and for the same reason:
    // an un-acked frame is redelivered on every `listen`, so a raw failure count
    // is dominated by refusals of frames this bot already decrypted. That
    // overstatement has been measured at 2-5x three separate times in this
    // investigation. Quote `novelErrors()`.
    const fp = WsTransport.ciphertextFp(frame) ?? WsTransport.fingerprint(frame);
    if (loggedFailure) {
      bot.errors.push({
        t: Date.now(),
        message: loggedFailure,
        frame,
        replay: decryptedOk.has(fp),
      });
    } else {
      decryptedOk.add(fp);
    }
    await refreshSubscriptions();
  });

  return bot;
}
