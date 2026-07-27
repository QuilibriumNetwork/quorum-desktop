// A full headless client: the real MessageService + MessageDB (fake-indexeddb) +
// ActionQueueService + the ws transport + a registered identity, wired together
// the way MessageDB.tsx wires them in the browser — minus React.
//
// Inbound frames from the socket are handed to the REAL
// MessageService.handleNewMessage. Outbound is the REAL submitMessage → action
// queue → sendDm → sendDirectMessages → enqueueOutbound → socket. Every message
// the real code persists is captured by teeing messageDB.saveMessage (the single
// seam every DM path funnels through), so a scenario observes exactly what the
// real code produced — no reimplemented routing or crypto.
import { QueryClient } from '@tanstack/react-query';
import { logger, type Message, type UserRegistration } from '@quilibrium/quorum-shared';
import { MessageService } from '../../../services/MessageService';
import type { MessageServiceDependencies } from '../../../services/MessageService';
import { ActionQueueService } from '../../../services/ActionQueueService';
import { ActionQueueHandlers } from '../../../services/ActionQueueHandlers';
import type { HandlerDependencies } from '../../../services/ActionQueueHandlers';
import type { EncryptedMessage, MessageDB } from '../../../db/messages';
import { makeMessageDB } from './storage';
import { makeApiClient, WsTransport } from './transport';
import { makeDeps, deleteInboxMessages } from './deps';
import { XpdumpLog } from './xpdump';
import { loadOrCreateBot, type Bot as Identity } from './identity';

export interface HarnessBot {
  identity: Identity;
  transport: WsTransport;
  messageService: MessageService;
  /** The bot's live MessageDB — for reading ratchet state (see inspect.ts). */
  messageDB: MessageDB;
  /** Every message the real code persisted, in arrival order. */
  captured: Message[];
  /**
   * Receive-path decrypt failures.
   *
   * `replay` distinguishes the two kinds, and the distinction is load-bearing: a
   * frame this bot ALREADY decrypted once is refused by the ratchet on a second
   * delivery, which is the protocol working, not a defect. Un-acked frames are
   * redelivered on every `listen`, so replays dominate a raw failure count — the
   * same 2-5x overstatement the manual rig kept hitting. Quote `novel` failures.
   */
  errors: { t: number; message: string; frame: unknown; replay: boolean }[];
  /** Failures on a frame never successfully decrypted before. */
  novelErrors(): { t: number; message: string; frame: unknown; replay: boolean }[];
  /** Fires as each message is persisted (received OR locally saved on send). */
  onDecrypted?: (m: Message) => void;
  /** Fires on a receive-path failure, with the frame that failed. */
  onError?: (message: string, frame: unknown) => void;
  /** Send a DM to another account address via the real submitMessage path. */
  send(toAddress: string, text: string): Promise<void>;
  /** Delete all local DM sessions — simulates a reset/wipe. Returns rows removed. */
  wipeSessions(): Promise<number>;
  /** Fetch + delete queued frames on the device inbox (clears stale-frame confound). */
  drainInbox(): Promise<number>;
  start(): Promise<void>;
  stop(): void;
}

export async function createBot(
  name: string,
  opts: { privateKeyHex?: string } = {}
): Promise<HarnessBot> {
  const apiClient = makeApiClient();
  const identity = await loadOrCreateBot(name, apiClient, opts);
  // Per-bot database — see storage.ts. Sharing one made two bots into one client.
  const messageDB = await makeMessageDB(name);
  const transport = new WsTransport();
  const queryClient = new QueryClient();

  const messageService = new MessageService(
    makeDeps({ messageDB, apiClient, transport }) as unknown as MessageServiceDependencies
  );
  // Lazily created on the first decrypt failure (dr-ablate-format capture).
  let xpdump: XpdumpLog | undefined;

  // Listen on the device inbox + every current session inbox — mirrors the app's
  // setResubscribe, so frames on newly-created session inboxes (e.g. after a
  // reset/re-init) actually arrive.
  //
  // Only re-sent when the inbox SET actually changes. A `listen` makes the relay
  // re-push everything still queued, so re-sending it after every frame turns one
  // undecryptable frame into an unbounded redelivery loop: a reorder run that
  // should have produced ~3 failures produced 437. The app subscribes on connect,
  // not per frame.
  let subscribed = '';
  const refreshSubscriptions = async () => {
    const states = await messageDB.getAllEncryptionStates();
    const addresses = [identity.inboxAddress, ...states.map((s) => s.inboxId)];
    const key = [...new Set(addresses)].sort().join(',');
    if (key === subscribed) return;
    subscribed = key;
    transport.listen(addresses);
  };

  // Action queue: the send path routes through it once a session is established.
  // send-dm never touches configService/spaceService (only the space handlers do),
  // so those are safely absent.
  const actionQueueService = new ActionQueueService(messageDB);
  actionQueueService.setUserKeyset(identity.keyset);
  const handlers = new ActionQueueHandlers({
    messageDB,
    messageService,
    queryClient,
    getUserKeyset: () => actionQueueService.getUserKeyset(),
  } as unknown as HandlerDependencies);
  actionQueueService.setHandlers(handlers);
  messageService.setActionQueueService(actionQueueService);
  actionQueueService.start();

  const bot: HarnessBot = {
    identity,
    transport,
    messageService,
    messageDB,
    captured: [],
    errors: [],
    novelErrors: () => bot.errors.filter((e) => !e.replay),
    send: async (toAddress: string, text: string) => {
      const self = (await apiClient.getUser(identity.address))?.data as UserRegistration;
      const counterparty = (await apiClient.getUser(toAddress))?.data as UserRegistration;
      if (!self || !counterparty) {
        throw new Error(`missing registration (self=${!!self} counterparty=${!!counterparty})`);
      }
      const passkeyInfo = {
        credentialId: '',
        address: identity.address,
        publicKey: Buffer.from(
          new Uint8Array(identity.keyset.userKeyset.user_key.public_key)
        ).toString('hex'),
        completedOnboarding: true,
      };
      await messageService.submitMessage(
        toAddress,
        text,
        self,
        counterparty,
        queryClient,
        passkeyInfo,
        identity.keyset
      );
      // A send may have created a new session inbox — subscribe to it.
      await refreshSubscriptions();
    },
    wipeSessions: async () => {
      const rows = await messageDB.getAllEncryptionStates();
      for (const r of rows) await messageDB.deleteEncryptionState(r);
      return rows.length;
    },
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
    },
    stop: () => {
      actionQueueService.stop();
      transport.close();
    },
  };

  // Capture seam: tee saveMessage. Faithful — this is the real Message object the
  // real code chose to persist (both received DMs and locally-saved sent DMs).
  const origSave = messageDB.saveMessage.bind(messageDB);
  (messageDB as unknown as { saveMessage: MessageDB['saveMessage'] }).saveMessage =
    async (message: Message, ...rest: unknown[]) => {
      bot.captured.push(message);
      bot.onDecrypted?.(message);
      return (origSave as (...a: unknown[]) => Promise<void>)(message, ...rest);
    };

  // Frames this bot has decrypted at least once, by ciphertext fingerprint.
  const decryptedOk = new Set<string>();

  const record = async (message: string, frame: unknown, replay: boolean) => {
    bot.errors.push({ t: Date.now(), message, frame, replay });
    // Only dump NOVEL failures: a replay's state has legitimately moved past the
    // frame, so feeding it to dr-ablate would fill the corpus with expected
    // refusals and dilute the real signal.
    if (!replay) {
      if (!xpdump) xpdump = new XpdumpLog(name, Date.now());
      try {
        await xpdump.capture(messageDB, frame as Record<string, unknown>, Date.now());
      } catch { /* capture is best-effort */ }
    }
    bot.onError?.(message, frame);
  };

  transport.onMessage(async (frame) => {
    // A DM decrypt failure does NOT propagate: the receive path catches it,
    // retains the frame for redelivery and returns `handled` (that retention is
    // what makes recovery possible). So the only external signal is the log line
    // the service writes — teed here, and attributed to this frame because
    // inbound dispatch is serialized. Without this, `errors` stayed empty and the
    // XPDUMP emitter never fired even while the service logged AEAD failures.
    let loggedFailure: string | undefined;
    const origError = logger.error;
    logger.error = ((...args: unknown[]) => {
      const first = String(args[0] ?? '');
      if (first.includes('DM decrypt failed')) loggedFailure = first;
      return (origError as (...a: unknown[]) => unknown)(...args);
    }) as typeof logger.error;
    try {
      await messageService.handleNewMessage(
        identity.address,
        identity.keyset,
        frame as unknown as EncryptedMessage,
        queryClient
      );
    } catch (err) {
      loggedFailure ??= (err as Error)?.message ?? String(err);
    } finally {
      logger.error = origError;
    }
    // Capture BEFORE re-subscribing: refreshSubscriptions can pull further frames
    // that advance the ratchet, and the dump must hold the state the frame failed
    // against.
    const fp = WsTransport.ciphertextFp(frame) ?? WsTransport.fingerprint(frame);
    if (loggedFailure) await record(loggedFailure, frame, decryptedOk.has(fp));
    else decryptedOk.add(fp);
    // Processing a frame may have created a new session inbox — keep subscriptions current.
    await refreshSubscriptions();
  });

  return bot;
}
