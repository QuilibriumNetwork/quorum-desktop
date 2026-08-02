// A faithful copy of the app's outbound queue (WebsocketProvider.processOutbound).
//
// ⚠️ This is NOT the same thing the DM harness does, and the difference matters
// for spaces. `deps.ts` runs each enqueued action immediately and concurrently
// (`void (async () => …)()`), which is harmless for DM — one action, one frame.
// The app instead appends to a FIFO and drains it with a single in-flight action
// at a time (WebsocketProvider.tsx:136-163). Space flows depend on that: joining
// enqueues the `join` broadcast and then `requestSync`, and a responder enqueues
// several sealed delta payloads that the receiver reassembles in order. Firing
// them concurrently would reorder the wire in a way production never does — and
// this harness exists to characterise a delivery bug, so an unfaithful send
// order would be measuring the harness.
//
// Two things it adds that the app has no need for:
//   - `flush()`, so a scenario can await "everything queued so far has been
//     handed to the socket" instead of sleeping and hoping.
//   - `listen` interception: space create/join emit
//     `{type:'listen', inbox_addresses:[…]}` through enqueueOutbound. Passing
//     that straight to the socket works once, but the transport would not know
//     about the subscription and would drop it on reconnect. Routing it through
//     `transport.listen()` makes it durable, which is what the app gets from
//     setResubscribe.
import { logger } from '@quilibrium/quorum-shared';
import type { WsTransport } from './transport';

export type OutboundAction = () => Promise<string[]>;

export interface OutboundQueue {
  /** Append an action. Fire-and-forget, exactly like the app's. */
  enqueue: (action: OutboundAction) => void;
  /** Resolve once every action enqueued before this call has been sent. */
  flush: (timeoutMs?: number) => Promise<boolean>;
  /** Actions that threw while running. Empty is the expected state. */
  readonly failures: { t: number; error: string }[];
  /** Frames handed to the socket by this queue (excludes intercepted `listen`). */
  readonly sentCount: number;
  /** Inbox addresses this queue routed into transport.listen(). */
  readonly listenedInboxes: string[];
  /** Actions still waiting because the socket is not open. */
  readonly backlog: number;
  /** Stop the reconnect-retry timer. Call from the bot's stop(). */
  dispose: () => void;
}

/** Matches the app's 1s processOutbound interval (WebsocketProvider.tsx:217-221). */
const RECONNECT_RETRY_MS = 1000;

export function createOutboundQueue(transport: WsTransport): OutboundQueue {
  const queue: OutboundAction[] = [];
  const failures: { t: number; error: string }[] = [];
  const listened: string[] = [];
  let draining = false;
  let disposed = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let sent = 0;

  const drain = async () => {
    if (draining) return;
    draining = true;
    try {
      while (queue.length) {
        // The socket-readiness gate. The app checks `readyState === OPEN` BEFORE
        // dequeuing anything and leaves the queue untouched otherwise
        // (`WebsocketProvider.tsx:146`), so a reconnect window DELAYS frames;
        // `ws.onopen` and a 1s interval then drain them.
        //
        // An earlier version of this file shifted and sent unconditionally,
        // which can destroy a frame silently: `WsTransport.send` passes no
        // callback to `ws.send()`, and the `ws` library's `sendAfterClose` only
        // constructs an error `if (cb)`. No throw, no callback, no entry in
        // `failures`.
        //
        // ⚠️ HOW LIKELY IS THAT HERE? Low — and it is worth knowing why, because
        // the honest answer is not "we hardened it". Node's `ws` auto-pongs over
        // a wired connection in sub-millisecond time, so a harness socket never
        // approaches the relay's ~1 s deadline; desktop connections have been
        // observed holding 20+ minutes, and this is precisely why every harness
        // bench measures 0% loss while physical devices measured 15-25%
        // (`tasks/transport/measurements.md`, "Why every bench was green").
        // The trigger essentially cannot be hosted here.
        //
        // So this gate is cheap insurance against a window that rarely opens,
        // not a fix for an observed harness failure. It is kept because it costs
        // ~10 lines, matches the app exactly, and removes a class of artifact
        // that would be indistinguishable from the bug under study if it ever
        // did fire. Same reasoning as transport item B1, which is open on the
        // app for the same reason: the protection is MISSING, not unnecessary.
        if (!transport.connected) {
          scheduleRetry();
          break;
        }
        const action = queue.shift()!;
        try {
          const frames = await action();
          for (const raw of frames) {
            if (routeListen(raw)) continue;
            sent += 1;
            transport.send(raw);
          }
        } catch (err) {
          failures.push({
            t: Date.now(),
            error: (err as Error)?.message ?? String(err),
          });
          logger.warn('[harness] outbound action failed', { err });
        }
      }
    } finally {
      draining = false;
    }
  };

  // The app's equivalent is the 1s interval that re-calls processOutbound
  // (`WebsocketProvider.tsx:217-221`). Only armed while a backlog is waiting on
  // the socket, so an idle bot has no live timer to leak at teardown.
  const scheduleRetry = () => {
    if (retryTimer || disposed) return;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void drain();
    }, RECONNECT_RETRY_MS);
  };

  // Returns true when the frame was a subscribe request and has been handled.
  const routeListen = (raw: string): boolean => {
    let parsed: { type?: string; inbox_addresses?: unknown };
    try {
      parsed = JSON.parse(raw) as { type?: string; inbox_addresses?: unknown };
    } catch {
      return false;
    }
    if (parsed.type !== 'listen' || !Array.isArray(parsed.inbox_addresses))
      return false;
    const addresses = parsed.inbox_addresses.filter(
      (a): a is string => typeof a === 'string'
    );
    if (!addresses.length) return true;
    listened.push(...addresses);
    transport.listen(addresses);
    return true;
  };

  return {
    enqueue: (action: OutboundAction) => {
      queue.push(action);
      void drain();
    },
    flush: async (timeoutMs = 30_000) => {
      const deadline = Date.now() + timeoutMs;
      // A sentinel behind the caller's actions: the FIFO only reaches it after
      // every earlier action has been sent. Polling `draining` alone would race
      // with an action that has not started yet.
      let reached = false;
      queue.push(async () => {
        reached = true;
        return [];
      });
      void drain();
      while (!reached && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 25));
      }
      return reached;
    },
    failures,
    get sentCount() {
      return sent;
    },
    get listenedInboxes() {
      return [...listened];
    },
    get backlog() {
      return queue.length;
    },
    dispose: () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = undefined;
    },
  };
}
