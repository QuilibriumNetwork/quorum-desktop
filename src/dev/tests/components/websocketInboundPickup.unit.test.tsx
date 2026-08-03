import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import {
  WebSocketProvider,
  useWebSocket,
} from '@/components/context/WebsocketProvider';

/**
 * When does a frame that arrives DURING processing actually get processed?
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 *
 * `processInbound` is the single most load-bearing function in the receive path
 * and, until this file, had NO test of any kind. The only other test that
 * imports `WebsocketProvider` exercises the outbound flush.
 *
 * That gap is not academic. It let a whole investigation reason about this
 * function's behaviour from reading alone, propose a fix for it, and
 * pre-register an acceptance test (`yarn harness space-backlog`) that
 * structurally CANNOT observe it — the harness runs its own inbound dispatcher
 * (`WsTransport.dispatch`), not this function.
 *
 * So this is the instrument. It drives the real provider with a fake socket and
 * measures the one property the fix is about: a frame that arrives while a batch
 * is in flight — how long does it wait?
 *
 * See issues/2026-08-02-sync-requests-arrive-four-minutes-late-and-every-peer-rejects-them.md
 */

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static last: FakeWebSocket | null = null;

  readyState = FakeWebSocket.CONNECTING;
  bufferedAmount = 0;
  sent: string[] = [];

  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(_url: string) {
    FakeWebSocket.last = this;
    setTimeout(() => {
      this.readyState = FakeWebSocket.OPEN;
      this.onopen?.();
    }, 0);
  }

  send(message: string) {
    this.sent.push(message);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
  }

  /** Deliver one inbound frame exactly the way the real socket does. */
  deliver(frame: unknown) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}

type Ctx = ReturnType<typeof useWebSocket>;

const Probe: React.FunctionComponent<{ onReady: (ctx: Ctx) => void }> = ({
  onReady,
}) => {
  onReady(useWebSocket());
  return null;
};

const renderProvider = async () => {
  let ctx: Ctx | null = null;
  render(
    <WebSocketProvider>
      <Probe onReady={(c) => (ctx = c)} />
    </WebSocketProvider>
  );

  await waitFor(() => {
    expect(FakeWebSocket.last?.readyState).toBe(FakeWebSocket.OPEN);
  });

  return { ctx: ctx as unknown as Ctx, socket: FakeWebSocket.last! };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A frame the provider will route by `inboxAddress`. */
const frame = (inbox: string, id: string) => ({
  inboxAddress: inbox,
  encryptedContent: id,
  timestamp: Date.now(),
});

describe('processInbound: when is a mid-batch arrival picked up?', () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    originalWebSocket = global.WebSocket;
    global.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    FakeWebSocket.last = null;
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    vi.restoreAllMocks();
  });

  /**
   * THE MEASUREMENT — models a RELAY DUMP, which is the shape that matters.
   *
   * A dump lands on inbox A. Once it is under way, ONE frame arrives on inbox
   * B, standing in for the perishable `sync-info` reply this whole
   * investigation is about. Its inbox is different ON PURPOSE: `processInbound`
   * groups by inbox and runs those groups CONCURRENTLY, so a frame that merely
   * queued behind the flood would still be handled promptly. It is not — because
   * it is not in the running batch at all.
   *
   * Where `LATE` lands in the processing order is the number this file exists to
   * produce.
   *
   * Two earlier attempts measured nothing, and the reason is worth keeping:
   *
   * - Delivering everything synchronously → the FIRST arrival starts a batch of
   *   one, the rest merely queue, and the late frame's own arrival triggers the
   *   next drain. It landed at position 1 of 13.
   * - Delivering evenly spaced, 4x faster than processing → batches grow
   *   geometrically but stay small while arrival is spread out. The late frame
   *   waited 9 frames out of a 500-frame flood.
   *
   * Both are real behaviours and neither is the bug. The wait is bounded by the
   * frames REMAINING IN THE BATCH THAT IS ALREADY RUNNING — so to make it large,
   * the whole backlog has to be inside one batch before the late frame arrives.
   *
   * That is exactly a reconnect: the relay dumps thousands of retained frames
   * essentially at once, they all land before the next drain, and one batch ends
   * up holding the lot.
   */
  const runRelayDumpProbe = async (opts: {
    floodSize: number;
    perFrameMs: number;
    /** Inject once this many frames of the big batch have been handled. */
    injectAfterProcessed: number;
  }) => {
    const { ctx, socket } = await renderProvider();

    const order: string[] = [];
    ctx.setMessageHandler(async (m: { encryptedContent: string }) => {
      order.push(m.encryptedContent);
      // Real handling is dominated by sequential IndexedDB round trips, each a
      // genuine macrotask yield. A timer models that faithfully enough for a
      // scheduling test.
      await sleep(opts.perFrameMs);
    });

    await act(async () => {
      // One frame opens a batch...
      socket.deliver(frame('inbox-A', 'A0'));
      // ...and the dump lands while that batch holds the guard, so every one of
      // these accumulates and the NEXT drain swallows all of them at once.
      for (let i = 1; i < opts.floodSize; i++) {
        socket.deliver(frame('inbox-A', `A${i}`));
      }

      // Wait for the big batch to be genuinely under way.
      const deadline = Date.now() + 10_000;
      while (
        order.length < opts.injectAfterProcessed &&
        Date.now() < deadline
      ) {
        await sleep(5);
      }

      socket.deliver(frame('inbox-B', 'LATE'));

      await sleep(opts.floodSize * opts.perFrameMs * 3 + 8000);
    });

    return {
      order,
      latePosition: order.indexOf('LATE'),
      total: order.length,
      /** Flood frames handled between injection and pickup. */
      waitedFrames: order.indexOf('LATE') - opts.injectAfterProcessed,
    };
  };

  it('a frame arriving during a relay dump waits for the whole dump', async () => {
    const floodSize = 400;
    const perFrameMs = 4;
    const injectAfterProcessed = 40;

    const { order, latePosition, total, waitedFrames } =
      await runRelayDumpProbe({
        floodSize,
        perFrameMs,
        injectAfterProcessed,
      });

    console.log(
      `[processInbound] LATE landed at ${latePosition} of ${total}; ` +
        `waited ${waitedFrames} frames after injection ` +
        `(~${waitedFrames * perFrameMs}ms)`
    );

    // Integrity, whatever the ordering.
    expect(total).toBe(floodSize + 1);
    expect(new Set(order).size).toBe(total);

    // ⛔ THE DEFECT, pinned as a number.
    //
    // `LATE` is on a DIFFERENT inbox from the flood. Once it is in a batch it
    // runs concurrently with the flood's chain, so it should be handled almost
    // immediately. Instead it waits for nearly the entire dump — because it is
    // not in the running batch at all, and nothing re-reads the queue.
    //
    // ⚠️ WHEN THE FIX LANDS, THIS ASSERTION FLIPS. Bounded chunks mean the wait
    // becomes at most one chunk. Replace it with an upper bound —
    // `expect(waitedFrames).toBeLessThanOrEqual(CHUNK_SIZE * 2)` — and keep the
    // integrity assertions above unchanged. A green run on the OLD assertion
    // after a fix means the fix did not take.
    expect(waitedFrames).toBeGreaterThan(floodSize * 0.5);
  }, 60_000);
});
