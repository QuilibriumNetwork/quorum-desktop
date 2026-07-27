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

export function makeApiClient(): QuorumApiClient {
  return new QuorumApiClient({ baseUrl: config.apiUrl, wsUrl: config.wsUrl });
}

export class WsTransport {
  private ws: WebSocket | undefined;
  private handler: InboundHandler | undefined;
  private subscriptions: string[] = [];
  private closed = false;
  connected = false;

  constructor(private readonly wsUrl: string = config.wsUrl) {}

  onMessage(handler: InboundHandler): void {
    this.handler = handler;
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
          if (!this.handler) return;
          try {
            const frame = JSON.parse(data.toString()) as InboundFrame;
            void this.handler(frame);
          } catch {
            /* ignore non-JSON control frames */
          }
        });

        ws.on('close', () => {
          this.connected = false;
          if (!this.closed) setTimeout(open, 1000);
        });

        ws.on('error', (err: Error) => {
          if (!this.connected) reject(new Error(`WS connect failed: ${err.message}`));
        });
      };
      open();
    });
  }

  /** Subscribe to inbox addresses. Remembered and re-sent on reconnect. */
  listen(inboxAddresses: string[]): void {
    this.subscriptions = Array.from(new Set([...this.subscriptions, ...inboxAddresses]));
    if (this.connected) this.sendListen(this.subscriptions);
  }

  private sendListen(inboxAddresses: string[]): void {
    this.ws?.send(JSON.stringify({ type: 'listen', inbox_addresses: inboxAddresses }));
  }

  /** Raw send — used later to push outbound sealed frames. */
  send(raw: string): void {
    this.ws?.send(raw);
  }

  close(): void {
    this.closed = true;
    this.ws?.close();
  }
}
