// The transport half of a headless client: the same two channels the browser
// app uses, minus React.
//
//   - REST  via QuorumApiClient (register, fetch/post/delete inbox) — already
//     node-safe: baseTypes uses globalThis.fetch, which Node 22 provides.
//   - WebSocket for the live inbox stream. The subscribe protocol is one frame:
//     {type:'listen', inbox_addresses:[...]} — see MessageDB.tsx setResubscribe.
//     Inbound frames are the same EncryptedMessage JSON the browig app parses.
//
// This mirrors WebsocketProvider.tsx (connect, resubscribe on open, 1s
// reconnect) but exposes it as a plain object a scenario can await, instead of a
// React context.
import WebSocket from 'ws';
import { QuorumApiClient } from '../../../api/baseTypes';
import { config } from './env';

/** The inbound frame shape (matches db/messages EncryptedMessage). */
export interface InboundFrame {
  inboxAddress: string;
  [k: string]: unknown;
}

export type InboundHandler = (frame: InboundFrame) => void | Promise<void>;

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** One outbound frame handed to the socket. */
export interface SentFrame {
  t: number;
  /** Ciphertext fingerprint — matches the peer's `arrived` entry for this frame. */
  fp: string | undefined;
  /** Target inbox address the frame was addressed to, when the frame carries one. */
  target: string | undefined;
}

// ── Fault injection: a deliberately slow POST /inbox/delete ─────────────────
//
// `bugs/.solved/2026-07-28-dm-receive-holds-ratchet-lock-across-http.md` says the receive
// path holds the per-conversation ratchet lock across this POST, so one slow ack
// stalls every message on the conversation, both directions.
//
// ⚠️ That hypothesis CANNOT be tested on a healthy relay, and the 2026-07-29 run
// proved it the expensive way: 100/100 on every device, no lock hold above 555ms,
// which is exactly what the mechanism predicts when the POST is fast. A null there
// cannot separate "no bug" from "no trigger", so repeating it adds nothing.
//
// The trigger has to be SUPPLIED. This makes a fraction of inbox-delete calls slow
// the way a degrading relay would — and the relay really does degrade: it returned
// 502 on every path for over an hour on 2026-07-28, which is the condition that
// makes this bite.
//
// Selection is DETERMINISTIC (every Nth call), not random, so a run reproduces and
// a before/after comparison is like-for-like. The counter is module-level, so the
// rate is global across every bot in the process rather than per-bot.
//
// OFF unless HARNESS_FAULT_DELETE_DELAY_MS is set, so no existing run changes.
export const deleteFault = {
  /** ms to stall each selected call. 0 disables injection entirely. */
  delayMs: Number(process.env.HARNESS_FAULT_DELETE_DELAY_MS ?? 0),
  /** Fraction of calls to stall, 0..1. 0.1 => every 10th. */
  rate: Number(process.env.HARNESS_FAULT_DELETE_RATE ?? 0.1),
  /** How many inbox-delete calls were made. */
  calls: 0,
  /** How many of them this injector stalled. */
  injected: 0,
  /** One-line summary for the run log. */
  summary(): string {
    return this.delayMs > 0
      ? `delete-fault ON: ${this.injected}/${this.calls} calls stalled by ${this.delayMs}ms (rate ${this.rate})`
      : 'delete-fault OFF (healthy-relay baseline)';
  },
};

type DeleteInbox = QuorumApiClient['deleteInbox'];

export function makeApiClient(): QuorumApiClient {
  const client = new QuorumApiClient({
    baseUrl: config.apiUrl,
    wsUrl: config.wsUrl,
  });
  if (deleteFault.delayMs > 0) {
    const original = client.deleteInbox.bind(client) as DeleteInbox;
    const every = Math.max(
      1,
      Math.round(1 / Math.min(1, Math.max(0.0001, deleteFault.rate)))
    );
    (client as unknown as { deleteInbox: DeleteInbox }).deleteInbox = ((
      ...args: Parameters<DeleteInbox>
    ) => {
      deleteFault.calls += 1;
      if (deleteFault.calls % every !== 0) return original(...args);
      deleteFault.injected += 1;
      // Stall BEFORE delegating. The lock is held for this whole time either way,
      // which is the thing under test; doing it here also keeps the stall exactly
      // as long as configured instead of at the mercy of the client's own
      // timeout/retry arithmetic, so the expected histogram bucket is predictable.
      return new Promise((r) => setTimeout(r, deleteFault.delayMs)).then(() =>
        original(...args)
      );
    }) as DeleteInbox;
  }
  return client;
}

export class WsTransport {
  private ws: WebSocket | undefined;
  private handler: InboundHandler | undefined;
  private subscriptions: string[] = [];
  private closed = false;
  connected = false;

  // ---- controlled reordering ------------------------------------------------
  // The relay delivers in order, so nothing is ever skipped and no skipped-keys
  // bucket ever forms — which is why the volume scenario measured zero of them.
  // A bucket needs a LATER frame of a sending chain to be processed before an
  // EARLIER one. This buffer makes that happen on demand.
  //
  // ⚠️ Withholding has to be enforced by FINGERPRINT, not just by not-dispatching
  // once: an un-acked frame stays on the relay inbox and is pushed again on every
  // `listen`, and the receive path re-subscribes after each frame. A first version
  // of this that only buffered the initial copy was silently defeated — the relay
  // redelivered the withheld frames in order and no bucket formed.
  private holding = false;
  private held: InboundFrame[] = [];
  private suppressed = new Map<string, InboundFrame>();
  /** Every frame this transport has ever received, in arrival order. */
  readonly arrived: InboundFrame[] = [];
  /** Every frame this transport has ever handed to the socket. */
  readonly sent: SentFrame[] = [];
  /** Inbound dispatch is serialized — see dispatch(). */
  private chain: Promise<void> = Promise.resolve();
  /** Handler invocations started but not yet settled — see stuckFrames(). */
  private inFlightFrames = new Map<
    number,
    { fp: string; inbox: string; at: number }
  >();
  private dispatchSeq = 0;

  constructor(private readonly wsUrl: string = config.wsUrl) {}

  onMessage(handler: InboundHandler): void {
    this.handler = handler;
  }

  /** Stable id for a frame, so redelivered copies are recognised. */
  static fingerprint(frame: InboundFrame): string {
    return fnv1a(
      String((frame as { encryptedContent?: string }).encryptedContent ?? '')
    );
  }

  /**
   * Identify a frame by its CIPHERTEXT, so the same frame can be matched on the
   * sending side (a raw outbound JSON string) and on the receiving side (where the
   * relay has rewrapped it as `{inboxAddress, encryptedContent, timestamp}`).
   * This is what makes a send-vs-arrive loss count possible.
   */
  static ciphertextFp(rawOrFrame: string | InboundFrame): string | undefined {
    let obj: Record<string, unknown> | undefined;
    try {
      const s =
        typeof rawOrFrame === 'string'
          ? rawOrFrame
          : String(
              (rawOrFrame as { encryptedContent?: string }).encryptedContent ??
                ''
            );
      obj = JSON.parse(s) as Record<string, unknown>;
    } catch {
      return undefined;
    }
    // Outbound frames may wrap the sealed message; unwrap one level if needed.
    const sealed =
      obj && typeof obj.envelope === 'string'
        ? obj
        : (obj?.message as Record<string, unknown> | undefined);
    const env =
      sealed && typeof sealed.envelope === 'string'
        ? sealed.envelope
        : undefined;
    return env ? fnv1a(env) : undefined;
  }

  /** Start buffering inbound frames instead of dispatching them. */
  holdInbound(): void {
    this.holding = true;
  }

  /** How many distinct frames are currently buffered. */
  get heldCount(): number {
    return this.held.length;
  }

  /** How many frames are being withheld across redeliveries. */
  get suppressedCount(): number {
    return this.suppressed.size;
  }

  /**
   * Stop buffering and dispatch the frames `order` selects, in its order.
   * `(held) => [held.at(-1)]` delivers only the last, which is what files the
   * earlier indices as skipped keys.
   *
   * Frames `order` omits stay WITHHELD by fingerprint: further copies pushed by
   * the relay are dropped too, until `deliverWithheld()` lets them through.
   */
  async releaseInbound(
    order: (held: InboundFrame[]) => InboundFrame[] = (h) => h
  ): Promise<{ delivered: number; withheld: number }> {
    const batch = this.held;
    this.held = [];
    this.holding = false;
    const chosen = order([...batch]).filter(Boolean);
    const chosenFps = new Set(chosen.map((f) => WsTransport.fingerprint(f)));
    for (const frame of batch) {
      const fp = WsTransport.fingerprint(frame);
      if (!chosenFps.has(fp)) this.suppressed.set(fp, frame);
    }
    for (const frame of chosen) await this.dispatch(frame);
    return { delivered: chosen.length, withheld: this.suppressed.size };
  }

  /** Let the withheld frames through — a delayed redelivery. */
  async deliverWithheld(): Promise<number> {
    const frames = [...this.suppressed.values()];
    this.suppressed.clear();
    for (const frame of frames) await this.dispatch(frame);
    return frames.length;
  }

  /** Hand a frame to the receive path directly. */
  async deliver(frame: InboundFrame): Promise<void> {
    await this.dispatch(frame);
  }

  // Serialized: the browser's receive path is entered once per socket message and
  // guards the ratchet with a mutex, but a harness that fires handleNewMessage
  // concurrently would also make per-frame attribution of a failure ambiguous.
  private dispatch(frame: InboundFrame): Promise<void> {
    if (!this.handler) return Promise.resolve();
    this.chain = this.chain
      .then(() => {
        // Registered before the handler runs, removed when it settles. Anything
        // left in here at the end of a run is a handler invocation that NEVER
        // returned — and because this chain is serial, it has blocked every frame
        // behind it permanently.
        //
        // This is deliberately broader than the lock probe: it catches a hang
        // ANYWHERE in handleNewMessage, not only inside runExclusive. Together the
        // two localise the stall — outstanding in both ⇒ the lock; outstanding
        // here only ⇒ somewhere else in the handler.
        const id = ++this.dispatchSeq;
        this.inFlightFrames.set(id, {
          fp: WsTransport.fingerprint(frame),
          inbox: String(frame.inboxAddress ?? '?'),
          at: Date.now(),
        });
        return Promise.resolve(this.handler!(frame)).finally(() =>
          this.inFlightFrames.delete(id)
        );
      })
      .then(
        () => undefined,
        () => undefined
      );
    return this.chain;
  }

  /**
   * Handler invocations that started and never settled.
   *
   * Empty is expected. A non-empty result means this bot's inbound queue is
   * permanently stuck: `dispatch` is serial, so every frame after the stuck one
   * is blocked forever, which is exactly the "device stopped at message #N and
   * never recovered" shape — while the socket keeps receiving, because
   * `arrived` is appended in `ws.on('message')` upstream of this.
   */
  stuckFrames(): { fp: string; inbox: string; stuckMs: number }[] {
    const now = Date.now();
    return [...this.inFlightFrames.values()].map((f) => ({
      fp: f.fp,
      inbox: f.inbox,
      stuckMs: now - f.at,
    }));
  }

  /** Open the socket; resolves on the first `open`. Re-subscribes automatically. */
  connect(): Promise<void> {
    return new Promise((resolvePromise, reject) => {
      const open = () => {
        const ws = new WebSocket(this.wsUrl);
        this.ws = ws;

        ws.on('open', () => {
          this.connected = true;
          if (this.subscriptions.length) this.sendListen(this.subscriptions);
          resolvePromise();
        });

        ws.on('message', (data: WebSocket.RawData) => {
          let frame: InboundFrame;
          try {
            frame = JSON.parse(data.toString()) as InboundFrame;
          } catch {
            return; /* non-JSON control frame */
          }
          this.arrived.push(frame);
          const fp = WsTransport.fingerprint(frame);
          // Already withheld: drop this redelivered copy too.
          if (this.suppressed.has(fp)) return;
          if (this.holding) {
            if (!this.held.some((f) => WsTransport.fingerprint(f) === fp)) {
              this.held.push(frame);
            }
            return;
          }
          void this.dispatch(frame);
        });

        ws.on('close', () => {
          this.connected = false;
          if (!this.closed) setTimeout(open, 1000);
        });

        ws.on('error', (err: Error) => {
          if (!this.connected)
            reject(new Error(`WS connect failed: ${err.message}`));
        });
      };
      open();
    });
  }

  /** Subscribe to inbox addresses. Remembered and re-sent on reconnect. */
  listen(inboxAddresses: string[]): void {
    this.subscriptions = Array.from(
      new Set([...this.subscriptions, ...inboxAddresses])
    );
    if (this.connected) this.sendListen(this.subscriptions);
  }

  private sendListen(inboxAddresses: string[]): void {
    this.ws?.send(
      JSON.stringify({ type: 'listen', inbox_addresses: inboxAddresses })
    );
  }

  /** Raw send — pushes an outbound sealed frame, and records it for loss counting. */
  send(raw: string): void {
    let target: string | undefined;
    try {
      const o = JSON.parse(raw) as {
        inbox_address?: string;
        message?: { inbox_address?: string };
      };
      target = o.inbox_address ?? o.message?.inbox_address;
    } catch {
      /* not JSON — still counted */
    }
    this.sent.push({
      t: Date.now(),
      fp: WsTransport.ciphertextFp(raw),
      target,
    });
    this.ws?.send(raw);
  }

  close(): void {
    this.closed = true;
    this.ws?.close();
  }

  /**
   * Undo `close()`'s latch so `connect()` works again.
   *
   * `close()` sets `closed = true` specifically to stop the 1s auto-reconnect in
   * `ws.on('close')`, which is right for teardown and wrong for a scenario that
   * deliberately takes a client offline and brings it back. Without this a
   * reconnect silently produces a socket that is immediately abandoned.
   */
  reopen(): void {
    this.closed = false;
  }
}
