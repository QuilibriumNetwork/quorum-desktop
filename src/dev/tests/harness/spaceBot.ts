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
import { type Message, type UserRegistration } from '@quilibrium/quorum-shared';
import type { MessageDB } from '../../../db/messages';
import type { EncryptedMessage } from '../../../db/messages';
import { sha256, base58btc } from '../../../utils/crypto';
import { makeMessageDB } from './storage';
import { makeApiClient, WsTransport } from './transport';
import { createSpaceGraph, type SpaceGraph } from './spaceDeps';
import { deleteInboxMessages } from './deps';
import { runAttributed } from './errorTap';
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
  novelErrors(): {
    t: number;
    message: string;
    frame: unknown;
    replay: boolean;
  }[];
  onDecrypted?: (m: Message) => void;
  onMember?: (w: MemberWrite) => void;

  /** Create a space (bot becomes owner). Returns its ids. */
  createSpace(
    spaceName: string
  ): Promise<{ spaceId: string; channelId: string }>;
  /** Mint a one-time invite link for a space this bot owns. */
  inviteLink(spaceId: string): Promise<string>;
  /** Join a space from an invite link. */
  join(inviteLink: string): Promise<{ spaceId: string; channelId: string }>;
  /** Post a text message to a channel via the real submitChannelMessage path. */
  post(spaceId: string, channelId: string, text: string): Promise<void>;
  /**
   * Post `count` messages, draining ONCE at the end rather than per message.
   *
   * Same real path as `post`; only the waiting differs. Used to build a relay
   * backlog for an offline member, where the point is volume and per-message
   * timing is not the measurement.
   */
  postMany(
    spaceId: string,
    channelId: string,
    count: number,
    prefix: string
  ): Promise<void>;
  /** Drop the socket without tearing the bot down — simulates going offline. */
  disconnect(): void;
  /** Reopen the socket and re-subscribe — simulates coming back. */
  reconnect(): Promise<void>;
  /** Ask the space for a roster/message sync (the pull under investigation). */
  requestSync(spaceId: string): Promise<boolean>;
  /** Member rows currently on disk for a space. */
  members(spaceId: string): Promise<number>;
  /**
   * Sync-handshake log lines this bot emitted, in order.
   *
   * The real services log every step; this captures the ones the roster bugs
   * argue about, so a failing trial can say WHICH step died instead of only
   * that the roster is short.
   */
  syncTrace: string[];
  /** Count trace lines containing `needle`. */
  traceCount(needle: string): number;
  /**
   * Add `count` synthetic member rows to this bot's roster for a space.
   *
   * ⚠️ READ BEFORE USING — this is a deliberate, load-bearing shortcut and it
   * bounds what the resulting measurement means.
   *
   * The reported roster failure happens at ~79 members. Reaching that with real
   * clients would cost 79 account registrations and 79 real joins PER
   * ITERATION, which makes a rate measurement unaffordable. It is unnecessary
   * because the responder builds its delta from its OWN stored rows and nothing
   * else: `getPayloadCache` fills `memberMap` from
   * `storage.getSpaceMembers(spaceId)` (`quorum-shared/src/sync/service.ts:141`),
   * and the receiver's apply path validates nothing against the manifest or any
   * registration — it skips rows with no address and writes the rest
   * (`MessageService.ts:6010-6052`). So seeded rows travel the identical code
   * path real ones do.
   *
   * What this therefore measures: **whether a roster of size N is delivered.**
   * What it does NOT measure: the behaviour of N live clients — their traffic,
   * their own sync requests, or peer selection among many candidates. Those are
   * separate variables and must not be claimed from this.
   */
  seedMembers(spaceId: string, count: number): Promise<number>;
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

  /** Spaces this bot created or joined — needed to clear their timers at stop(). */
  const joinedSpaces = new Set<string>();

  // ── Sync handshake trace ──────────────────────────────────────────────────
  //
  // The real services already log every step of the sync handshake. In a browser
  // those lines are trapped behind DevTools and a human scrolling; in-process
  // they are data, and they are the difference between "the roster did not
  // arrive" and "the request was read 210s after it expired".
  //
  // Filtered at capture, because an unfiltered trace of a 1200-frame backlog is
  // tens of thousands of lines. These are the steps the two roster bugs actually
  // argue about — the chain in `2026-08-02-sync-requests-arrive-four-minutes-
  // late…` §4, plus the member-delta counters shared #72 added.
  const TRACE_PATTERNS = [
    'requestSync',
    'sync-request',
    'sync-info',
    'sync-initiate',
    'sync-manifest',
    'sync-delta',
    'initiateSync',
    'member delta',
    'delta payload',
    'informSyncData',
    // ⚠️ Added 2026-08-03, and its absence had already cost a wrong conclusion.
    // Desktop #300 made the roster re-ask the mechanism that repairs a starved
    // handshake — but every line that mechanism emits ("roster did not converge
    // … asking again", "roster check for X: not asking (cap-reached)") starts
    // with "roster" and matched none of the patterns above. So the harness could
    // measure that a run FAILED while being structurally unable to show WHY, and
    // a 0/2 result at 1200 backlog was read as "the re-ask ladder is exhausted"
    // on no evidence at all.
    //
    // `shouldReAsk` deliberately returns a REASON rather than a boolean, and the
    // caller logs it on every branch (see rosterConvergence.ts). Capturing it is
    // the entire point of that design.
    'roster',
  ];
  const syncTrace: string[] = [];
  const trace = (line: string) => {
    if (TRACE_PATTERNS.some((p) => line.includes(p))) syncTrace.push(line);
  };
  /** Run a send-side operation with its log lines traced too, not just receives. */
  const traced = <T>(fn: () => Promise<T>): Promise<T> =>
    runAttributed({ record: () => {}, trace }, fn);

  /**
   * Fail loudly when the send pipeline did not drain.
   *
   * These booleans used to be discarded at every call site, and that is a trap
   * specific to this instrument: if an outbound action hangs rather than throws
   * (the relay returned 502 on every path for over an hour on 2026-07-28), the
   * queue wedges, `failures` stays EMPTY because nothing threw, and `createSpace`
   * / `join` / `post` all return as though the work was sent. The scenario then
   * reports zero posts and a roster of 1 — and that is indistinguishable from the
   * roster bug under study, while actually being the harness never having sent
   * anything. Throwing here separates the two.
   */
  const mustDrain = async (
    ok: Promise<boolean>,
    what: string
  ): Promise<void> => {
    if (!(await ok)) {
      throw new Error(
        `[harness] ${what} did not drain — outbound backlog=${graph.outbound.backlog}, ` +
          `connected=${transport.connected}. The send pipeline is wedged; any delivery ` +
          `result from this run is meaningless.`
      );
    }
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
      if (!registration)
        throw new Error(`no registration for ${identity.address}`);
      const ids = await graph.spaceService.createSpace(
        spaceName,
        '',
        identity.keyset,
        registration as unknown as Parameters<
          SpaceGraph['spaceService']['createSpace']
        >[3],
        false,
        false,
        '',
        '',
        queryClient
      );
      await mustDrain(graph.outbound.flush(), 'createSpace outbound');
      await refreshSubscriptions();
      joinedSpaces.add(ids.spaceId);
      return ids;
    },

    inviteLink: (spaceId: string) =>
      graph.invitationService.constructInviteLink(spaceId),

    join: async (link: string) => {
      const result = await traced(() =>
        graph.invitationService.joinInviteLink(
          link,
          identity.keyset,
          passkeyInfo
        )
      );
      if (!result)
        throw new Error('joinInviteLink returned nothing (unparseable link?)');
      await mustDrain(graph.outbound.flush(), 'join outbound');
      await refreshSubscriptions();
      joinedSpaces.add(result.spaceId);
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
      await mustDrain(drainActionQueue(), 'post action queue');
      await mustDrain(graph.outbound.flush(), 'post outbound');
    },

    postMany: async (
      spaceId: string,
      channelId: string,
      count: number,
      prefix: string
    ) => {
      for (let i = 1; i <= count; i++) {
        await graph.messageService.submitChannelMessage(
          spaceId,
          channelId,
          `${prefix} ${i}/${count}`,
          queryClient,
          passkeyInfo
        );
      }
      // One drain for the whole batch. Generous timeout: the ActionQueue
      // encrypts and sends each message serially, so a large batch legitimately
      // takes minutes, and a premature "wedged" throw here would be wrong.
      await mustDrain(drainActionQueue(10 * 60_000), 'postMany action queue');
      await mustDrain(graph.outbound.flush(10 * 60_000), 'postMany outbound');
    },

    disconnect: () => transport.close(),

    reconnect: async () => {
      transport.reopen();
      await transport.connect();
      // Force a re-listen: the subscription memo still holds the old key, and
      // the relay only re-pushes a retained backlog in response to a `listen`.
      subscribed = '';
      await refreshSubscriptions();
    },

    requestSync: (spaceId: string) =>
      traced(() => graph.syncService.requestSync(spaceId)),

    members: async (spaceId: string) =>
      (await messageDB.getSpaceMembers(spaceId)).length,

    syncTrace,
    traceCount: (needle: string) =>
      syncTrace.filter((l) => l.includes(needle)).length,

    seedMembers: async (spaceId: string, count: number) => {
      for (let i = 0; i < count; i++) {
        // Real-shaped addresses (base58btc of a sha256), derived deterministically
        // from the space + index so two runs at the same size are comparable.
        const digest = await sha256.digest(
          Buffer.from(`${spaceId}:seed:${i}`, 'utf-8')
        );
        const address = base58btc.baseEncode(digest.bytes);
        const inboxDigest = await sha256.digest(
          Buffer.from(`${spaceId}:seed-inbox:${i}`, 'utf-8')
        );
        await messageDB.saveSpaceMember(spaceId, {
          user_address: address,
          inbox_address: base58btc.baseEncode(inboxDigest.bytes),
          // A populated GLOBAL slot, because that is what the follow-global work
          // left real rows carrying — seeding the override slot instead would
          // exercise a shape production stopped producing in 2026-07.
          global_display_name: `Seeded Member ${i}`,
          globalProfileTimestamp: Date.now(),
          joinedAt: Date.now(),
        } as Parameters<MessageDB['saveSpaceMember']>[1]);
      }
      // The responder caches its payload view; without this the seeded rows are
      // invisible until something else invalidates it, and the sweep would
      // silently measure N=1 at every size.
      (
        graph.syncService as unknown as {
          sharedSyncService: {
            invalidateCache: (s: string, c?: string) => void;
          };
        }
      ).sharedSyncService.invalidateCache(spaceId);
      return (await messageDB.getSpaceMembers(spaceId)).length;
    },

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
      graph.outbound.dispose();
      // The real sync path arms timers that outlive the socket: a 20s roster
      // convergence re-ask (`MessageService.scheduleRosterConvergenceCheck`,
      // armed on every `sync-info`) and the 1s `initiateSync` kick. Left running,
      // they fire against a closed transport after teardown — polluting
      // `outbound.failures` with post-mortem noise — and keep the whole service
      // graph and its fake-indexeddb store reachable until they do. At volume
      // that is one orphaned graph per iteration.
      for (const spaceId of joinedSpaces) {
        graph.messageService.forgetRosterConvergence(spaceId);
        delete graph.syncInfo.current[spaceId];
      }
      transport.close();
    },
  };

  // Capture seam 1 — messages. Faithful: this is the Message the real code chose
  // to persist, received or locally saved on send.
  const origSaveMessage = messageDB.saveMessage.bind(messageDB);
  (
    messageDB as unknown as { saveMessage: MessageDB['saveMessage'] }
  ).saveMessage = async (message: Message, ...rest: unknown[]) => {
    bot.captured.push(message);
    bot.onDecrypted?.(message);
    return (origSaveMessage as (...a: unknown[]) => Promise<void>)(
      message,
      ...rest
    );
  };

  // Capture seam 2 — member rows. The roster arrives on the sync-delta path, not
  // the message path, so nothing above would see it.
  const origSaveMember = messageDB.saveSpaceMember.bind(messageDB);
  (
    messageDB as unknown as { saveSpaceMember: MessageDB['saveSpaceMember'] }
  ).saveSpaceMember = async (
    spaceId: string,
    row: Record<string, unknown>,
    ...rest: unknown[]
  ) => {
    const write: MemberWrite = {
      t: Date.now(),
      spaceId,
      userAddress: row?.user_address as string | undefined,
      displayName: row?.display_name as string | undefined,
    };
    bot.memberWrites.push(write);
    bot.onMember?.(write);
    return (origSaveMember as (...a: unknown[]) => Promise<void>)(
      spaceId,
      row,
      ...rest
    );
  };

  // Frames this bot has decrypted at least once, by ciphertext fingerprint.
  const decryptedOk = new Set<string>();

  // Failure attribution is delegated to `errorTap.ts` — read the header there
  // before changing anything here. Short version: the space receive path
  // swallows every failure into one terminal catch and reports it through
  // `console.error`, so it can only be observed by teeing a process-global; and
  // teeing a process-global PER FRAME silently corrupts the count as soon as a
  // second bot exists, which is every scenario that matters.
  transport.onMessage(async (frame) => {
    let loggedFailure: string | undefined;
    const sink = {
      record: (m: string) => {
        loggedFailure ??= m;
      },
      trace,
    };
    try {
      await runAttributed(sink, () =>
        graph.messageService.handleNewMessage(
          identity.address,
          identity.keyset,
          frame as unknown as EncryptedMessage,
          queryClient
        )
      );
    } catch (err) {
      loggedFailure ??= (err as Error)?.message ?? String(err);
    }
    // Novel vs replay, exactly as the DM bot splits them and for the same reason:
    // an un-acked frame is redelivered on every `listen`, so a raw failure count
    // is dominated by refusals of frames this bot already decrypted. That
    // overstatement has been measured at 2-5x three separate times in this
    // investigation. Quote `novelErrors()`.
    const fp =
      WsTransport.ciphertextFp(frame) ?? WsTransport.fingerprint(frame);
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
    // Guarded: `transport.dispatch` swallows ANY outcome of this handler
    // (`.then(() => undefined, () => undefined)`), so an unguarded throw here
    // would be invisible to every counter the scenarios report — a silent
    // swallow of exactly the kind this file exists to avoid.
    try {
      await refreshSubscriptions();
    } catch (err) {
      bot.errors.push({
        t: Date.now(),
        message: `refreshSubscriptions failed: ${(err as Error)?.message ?? String(err)}`,
        frame,
        replay: false,
      });
    }
  });

  return bot;
}
