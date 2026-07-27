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
import type { Message, UserRegistration } from '@quilibrium/quorum-shared';
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
  /** handleNewMessage failures (e.g. DmDecryptError), for aging measurement. */
  errors: { t: number; message: string; frame: unknown }[];
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
  const messageDB = await makeMessageDB();
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
  const refreshSubscriptions = async () => {
    const states = await messageDB.getAllEncryptionStates();
    transport.listen([identity.inboxAddress, ...states.map((s) => s.inboxId)]);
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

  transport.onMessage(async (frame) => {
    try {
      await messageService.handleNewMessage(
        identity.address,
        identity.keyset,
        frame as unknown as EncryptedMessage,
        queryClient
      );
    } catch (err) {
      const message = (err as Error)?.message ?? String(err);
      bot.errors.push({ t: Date.now(), message, frame });
      // Auto-capture the failing (state, frame) pair in dr-ablate format.
      if (!xpdump) xpdump = new XpdumpLog(name, Date.now());
      try {
        await xpdump.capture(messageDB, frame as Record<string, unknown>, Date.now());
      } catch { /* capture is best-effort */ }
      bot.onError?.(message, frame);
    }
    // Processing a frame may have created a new session inbox — keep subscriptions current.
    await refreshSubscriptions();
  });

  return bot;
}
