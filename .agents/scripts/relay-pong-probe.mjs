#!/usr/bin/env node
// Relay ping/pong deadline probe — reproduces the transport root cause in ~10s,
// from any machine, with NO phone, NO instrumentation and NO dependencies
// (node builtins only). Speaks the WebSocket protocol directly over TLS because
// every JS WebSocket client (browser, React Native, and the `ws` library before
// v8.15) pongs automatically and cannot be told not to — and NOT ponging is
// exactly the condition under test.
//
// WHAT IT ESTABLISHED (2026-07-30, production relay):
//   - the relay sends a protocol PING every 9.0s
//   - it enforces a read deadline of 10.0s that ONLY a pong refreshes
//   - application traffic does NOT refresh it (valid frames included)
//   - on timeout it destroys the TCP connection with no close frame, so the
//     client sees code 1006, clean=false, empty reason
//   => a client has a ~1.0s budget to answer each ping or it is killed.
//
// Modes:
//   pong             control — answers pings. Expect: survives indefinitely.
//   nopong           never pongs, sends nothing. Expect: dies at ~10.0s.
//   nopong-listen    never pongs, sends a VALID listen every 5s.
//   nopong-unlisten  never pongs, sends a VALID unlisten every 5s.
//   nopong-app       never pongs, sends an EMPTY listen (relay rejects it).
//   pong-slow        answers pings after argv[4] ms. Measures the budget:
//                    500ms survives, 900ms already dies.
//
// Usage:
//   node relay-pong-probe.mjs <mode> [maxSeconds] [pongDelayMs]
//   node relay-pong-probe.mjs nopong 30
//   node relay-pong-probe.mjs pong-slow 32 900
//
// Env: QUORUM_WS_HOST (default api.quorummessenger.com), QUORUM_WS_PATH (/ws)
import tls from 'node:tls';
import crypto from 'node:crypto';

const HOST = process.env.QUORUM_WS_HOST ?? 'api.quorummessenger.com';
const PATH = process.env.QUORUM_WS_PATH ?? '/ws';
const mode = process.argv[2] ?? 'pong';
const maxMs = (Number(process.argv[3]) || 90) * 1000;
const PONG_DELAY_MS = Number(process.argv[4]) || 4000;
const APP_FRAME_MS = 5000;

// Any syntactically valid inbox address works — the point is only whether the
// relay ACCEPTS the frame, never what it subscribes to.
const SAMPLE_INBOX = 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco';

const t0 = Date.now();
const el = () => ((Date.now() - t0) / 1000).toFixed(2).padStart(6);
const log = (...a) => console.log(`[${el()}s]`, ...a);

let openAt = null, pings = 0, pongsSent = 0, appSent = 0;

const key = crypto.randomBytes(16).toString('base64');
const sock = tls.connect({ host: HOST, port: 443, servername: HOST }, () => {
  sock.write(
    `GET ${PATH} HTTP/1.1\r\n` +
    `Host: ${HOST}\r\n` +
    `Upgrade: websocket\r\n` +
    `Connection: Upgrade\r\n` +
    `Sec-WebSocket-Key: ${key}\r\n` +
    `Sec-WebSocket-Version: 13\r\n` +
    `\r\n`
  );
});

// Client->server frames must be masked (RFC 6455 §5.3).
function frame(opcode, payload = Buffer.alloc(0)) {
  const mask = crypto.randomBytes(4);
  const masked = Buffer.from(payload);
  for (let i = 0; i < masked.length; i++) masked[i] ^= mask[i % 4];
  const len = masked.length;
  if (len > 125) {
    return Buffer.concat([Buffer.from([0x80 | opcode, 0xfe, len >> 8, len & 0xff]), mask, masked]);
  }
  return Buffer.concat([Buffer.from([0x80 | opcode, 0x80 | len]), mask, masked]);
}
const sendText = (s) => sock.write(frame(0x1, Buffer.from(s, 'utf8')));
const sendPong = (payload) => { sock.write(frame(0xa, payload)); pongsSent++; };

const APP_FRAMES = {
  'nopong-app': () => JSON.stringify({ type: 'listen', inbox_addresses: [] }),
  'nopong-listen': () => JSON.stringify({ type: 'listen', inbox_addresses: [SAMPLE_INBOX] }),
  'nopong-unlisten': () => JSON.stringify({ type: 'unlisten', inbox_addresses: [SAMPLE_INBOX] }),
};

let handshakeDone = false;
let buf = Buffer.alloc(0);

sock.on('data', (chunk) => {
  buf = Buffer.concat([buf, chunk]);

  if (!handshakeDone) {
    const idx = buf.indexOf('\r\n\r\n');
    if (idx === -1) return;
    const head = buf.subarray(0, idx).toString();
    buf = buf.subarray(idx + 4);
    const status = head.split('\r\n')[0];
    if (!status.includes('101')) {
      log('HANDSHAKE FAILED:', status);
      process.exit(1);
    }
    handshakeDone = true;
    openAt = Date.now();
    log(`OPEN  mode=${mode} (${status})`);

    const make = APP_FRAMES[mode];
    if (make) {
      setInterval(() => {
        const f = make();
        sendText(f);
        appSent++;
        log(`APP-SENT #${appSent} ${f}`);
      }, APP_FRAME_MS);
    }
  }

  for (;;) {
    if (buf.length < 2) return;
    const b0 = buf[0], b1 = buf[1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let off = 2;
    if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
    if (masked) off += 4;
    if (buf.length < off + len) return;
    const payload = buf.subarray(off, off + len);
    buf = buf.subarray(off + len);

    if (opcode === 0x9) {
      pings++;
      if (mode === 'pong') { sendPong(payload); log(`PING #${pings} -> ponged`); }
      else if (mode === 'pong-slow') {
        setTimeout(() => sendPong(payload), PONG_DELAY_MS);
        log(`PING #${pings} -> pong scheduled in ${PONG_DELAY_MS}ms`);
      } else log(`PING #${pings} -> IGNORED (no pong)`);
    } else if (opcode === 0x8) {
      const code = len >= 2 ? payload.readUInt16BE(0) : null;
      const reason = len > 2 ? payload.subarray(2).toString() : '';
      log(`CLOSE code=${code} reason=${JSON.stringify(reason)}`);
      finish('CLOSE-FRAME');
    } else if (opcode === 0x1) {
      log(`TEXT ${payload.toString().slice(0, 200)}`);
    } else if (opcode === 0xa) {
      log('PONG from server');
    }
  }
});

function finish(how) {
  const lifetime = openAt ? ((Date.now() - openAt) / 1000).toFixed(2) : 'n/a';
  log(`RESULT mode=${mode} ${how} lifetime=${lifetime}s pings=${pings} pongs=${pongsSent} app=${appSent}`);
  sock.destroy();
  process.exit(0);
}

sock.on('error', (e) => log('SOCKET ERROR', e.message));
// No close frame on a deadline kill — the TCP connection is simply destroyed.
// That is what surfaces to a real client as 1006 / clean=false.
sock.on('close', () => finish('TCP-CLOSED'));
setTimeout(() => finish('SURVIVED cap'), maxMs);
