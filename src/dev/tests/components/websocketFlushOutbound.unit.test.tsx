import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import {
  WebSocketProvider,
  useWebSocket,
} from '@/components/context/WebsocketProvider';

/**
 * flushOutbound() is the barrier that makes deregister-before-wipe real: reset
 * broadcasts revoke-device frames and then reloads the page, and a reload
 * discards both the outbound queue and the socket's send buffer. If the barrier
 * resolves early the frames vanish silently — the failure mode that looks fine
 * in every test that doesn't check the wire.
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
    // The real socket opens asynchronously; mirror that so the provider's
    // onopen handler runs the way it does in a browser.
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

describe('WebSocketProvider.flushOutbound', () => {
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

  it('resolves only after frames queued before it reach the socket', async () => {
    const { ctx, socket } = await renderProvider();

    // A slow action, the way a real one is: signing and serializing happen
    // inside the queued closure, not before it.
    await act(async () => {
      ctx.enqueueOutbound(async () => {
        await new Promise((r) => setTimeout(r, 30));
        return ['revoke-device'];
      });
    });

    let flushed = false;
    await act(async () => {
      flushed = await ctx.flushOutbound(1000);
    });

    expect(flushed).toBe(true);
    expect(socket.sent).toEqual(['revoke-device']);
  });

  it('waits for every queued frame, not just the first', async () => {
    const { ctx, socket } = await renderProvider();

    await act(async () => {
      ctx.enqueueOutbound(async () => {
        await new Promise((r) => setTimeout(r, 20));
        return ['space-1'];
      });
      ctx.enqueueOutbound(async () => ['space-2', 'space-3']);
    });

    await act(async () => {
      await ctx.flushOutbound(1000);
    });

    expect(socket.sent).toEqual(['space-1', 'space-2', 'space-3']);
  });

  it('waits for the socket send buffer to drain', async () => {
    const { ctx, socket } = await renderProvider();

    // Bytes handed to send() but not yet on the wire — a reload here would
    // still lose them, so the barrier must not resolve.
    socket.bufferedAmount = 512;
    setTimeout(() => {
      socket.bufferedAmount = 0;
    }, 60);

    let flushed = false;
    await act(async () => {
      flushed = await ctx.flushOutbound(1000);
    });

    expect(flushed).toBe(true);
    expect(socket.bufferedAmount).toBe(0);
  });

  it('reports failure instead of hanging when the buffer never drains', async () => {
    const { ctx, socket } = await renderProvider();
    socket.bufferedAmount = 512;

    let flushed = true;
    await act(async () => {
      flushed = await ctx.flushOutbound(120);
    });

    // Bounded: the caller proceeds with the wipe rather than being stuck.
    expect(flushed).toBe(false);
  });

  it('returns immediately when the socket is not open (offline reset)', async () => {
    const { ctx, socket } = await renderProvider();
    socket.readyState = FakeWebSocket.CLOSED;

    const started = Date.now();
    let flushed = true;
    await act(async () => {
      flushed = await ctx.flushOutbound(5000);
    });

    expect(flushed).toBe(false);
    // Must not sit on the timeout — resetting while offline stays instant.
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
