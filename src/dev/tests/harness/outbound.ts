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
}

export function createOutboundQueue(transport: WsTransport): OutboundQueue {
  const queue: OutboundAction[] = [];
  const failures: { t: number; error: string }[] = [];
  const listened: string[] = [];
  let draining = false;
  let sent = 0;

  const drain = async () => {
    if (draining) return;
    draining = true;
    try {
      let action: OutboundAction | undefined;
      while ((action = queue.shift())) {
        try {
          const frames = await action();
          for (const raw of frames) {
            if (routeListen(raw)) continue;
            sent += 1;
            transport.send(raw);
          }
        } catch (err) {
          failures.push({ t: Date.now(), error: (err as Error)?.message ?? String(err) });
          logger.warn('[harness] outbound action failed', { err });
        }
      }
    } finally {
      draining = false;
    }
  };

  // Returns true when the frame was a subscribe request and has been handled.
  const routeListen = (raw: string): boolean => {
    let parsed: { type?: string; inbox_addresses?: unknown };
    try {
      parsed = JSON.parse(raw) as { type?: string; inbox_addresses?: unknown };
    } catch {
      return false;
    }
    if (parsed.type !== 'listen' || !Array.isArray(parsed.inbox_addresses)) return false;
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
  };
}
