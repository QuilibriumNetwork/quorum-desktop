> **Transparency note:** this work — 30+ instrumented capture rounds, the client fixes in mobile PRs #178-#182 / desktop PRs #252-#256, and this write-up — was done with AI coding agents under my direction. The crypto internals are above my own skill level, so please treat the analysis as machine-generated and verify accordingly. Everything below is therefore backed by a script you can run, or explicitly marked as inferred.

We instrumented both clients with per-frame tracing across 30+ live capture rounds (mobile↔desktop, mobile↔mobile, desktop↔desktop, both endpoints traced at once) and fixed everything we found on our side. Three causes remain that **only you can act on** @CassOnMars — the client-side work is ours and is not described here.

| # | lives in | what | verify it in |
|---|---|---|---|
| **1** | relay / infra | the WebSocket pong deadline is ~6× too tight, so mobile connections die every ~16 s and silently swallow frames written into them | **~10 seconds, one script, any machine** |
| 2 | `channel` crate | skipped-key handling around a DH ratchet turn, two distinct failure modes | seconds, two deterministic scripts, no devices |
| 3 | node write path | a residue of inbox writes vanishes with no client-visible signal | node-side logs for a window we trigger on demand |

Ordered by how cheaply you can check them. **Section 1 is worth doing first**: it is one constant, and it accounts for a large share of section 3.

## 1. Relay: the WebSocket pong deadline is about six times too tight

Measured directly against the relay's protocol behaviour, not inferred from client logs. Reproduces in ~10 seconds from any machine — no phone, no app build, no captured state.

**Measured behaviour of `wss://api.quorummessenger.com/ws`:**

- sends a protocol-level **PING every 9.00 s** (±0.02 s)
- enforces a **read deadline of 10.0 s that only a PONG refreshes**
- **application traffic does not refresh it** — valid frames the relay accepted made no difference
- on expiry it **destroys the TCP connection with no close frame**, so clients see `1006`, `wasClean=false`, empty reason
- net effect: **a client has ~1.0 second to answer each ping, or it is killed**

| trial | pongs? | app frames? | outcome |
|---|---|---|---|
| control: silent, auto-pong | yes | none | **survived every cap tested** (90 / 39.5 / 24.5 / 21.6 s) |
| never pong, send nothing | no | none | **died at 9.71 / 9.98 / 9.99 / 10.02 / 10.03 s** |
| never pong, valid `listen` every 5 s | no | yes, accepted | **died at 10.02 s** |
| never pong, valid `unlisten` every 5 s | no | yes, accepted | **died at 10.01 s** |
| pong 500 ms late | late | none | **survived** (31.4 / 29.4 / 29.6 s) |
| pong 900 ms late | late | none | **died at 10.02 / 10.00 / 9.99 s** |

For scale: the Gorilla example that the `pingPeriod = pongWait * 9/10` ratio comes from uses **`pongWait = 60 s` / `pingPeriod = 54 s`**; OkHttp's guidance is a 30-60 s heartbeat. This is ~6× tighter than either.

**Why it hits mobile and spares desktop.** Browsers and React Native both answer pings automatically in native code (Chromium; OkHttp on RN Android), and JavaScript cannot see, send or delay a pong on any platform — so no client change can affect this. Chromium answers in milliseconds and holds a connection 20+ minutes. A phone must answer within 1.0 s through radio wake-up, doze exit and WiFi power-save. An **idle** handset — nothing sent, no interaction — lost its connection **81 times in 25.6 minutes**, median lifetime 16.3 s, **1006 every time**.

**Why it costs messages.** `1006` gives no close handshake, so `readyState` still reads `OPEN` for seconds afterwards. `ws.send()` accepts the bytes, returns no error, and the frame is never transmitted and never retried, with no warning logged anywhere. That is the mechanism behind section 3.

**Confidence.** Measured and reproducible: the 9 s ping, the 10 s pong-only deadline, the ~1 s budget, the bare TCP teardown. **Inferred, not confirmed:** that React Native specifically *misses* pongs — RN's JS `WebSocket` does not expose ping/pong, so confirming it needs a packet capture or your server-side logs. The model fits the variable mobile lifetimes (13.9 / 16.3 / 20.2 s) better than any fixed timer, but we have not observed a missed pong directly.

### The ask

```go
// current (inferred from measured behaviour)   // suggested
pongWait   = 10 * time.Second                   pongWait   = 60 * time.Second
pingPeriod = (pongWait * 9) / 10  // 9s         pingPeriod = (pongWait * 9) / 10  // 54s
```

One config change, fixes every client on every platform with no app release, and it is the only place this can be fixed. Self-verifying: after it, `nopong` below should survive ~60 s instead of dying at 10 s.

1. Is the 9 s ping / 10 s deadline the relay's own, or Cloudflare's in front of it? We only see the edge; you will know immediately.
2. If it is yours, is there a reason for `pongWait` to be this tight that we are not seeing?

<details>
<summary>Repro script for 1 (node, zero dependencies, ~10 seconds)</summary>

```js
// node relay-pong-probe.mjs <mode> [maxSeconds] [pongDelayMs]
//
//   pong             control — answers pings. Expect: survives.
//   nopong           never pongs, sends nothing. Expect: dies at ~10.0s.
//   nopong-listen    never pongs, but sends a VALID listen every 5s.
//   pong-slow        answers after [pongDelayMs]. 500 survives, 900 dies.
//
// Speaks the protocol directly over TLS because every JS WebSocket client pongs
// automatically and cannot be told not to — and NOT ponging is the condition
// under test.
import tls from 'node:tls';
import crypto from 'node:crypto';

const HOST = process.env.QUORUM_WS_HOST ?? 'api.quorummessenger.com';
const mode = process.argv[2] ?? 'pong';
const maxMs = (Number(process.argv[3]) || 90) * 1000;
const PONG_DELAY_MS = Number(process.argv[4]) || 4000;
const SAMPLE_INBOX = 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco';

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(2).padStart(6)}s]`, ...a);
let openAt = null, pings = 0, pongs = 0, app = 0;

const key = crypto.randomBytes(16).toString('base64');
const sock = tls.connect({ host: HOST, port: 443, servername: HOST }, () => {
  sock.write(`GET /ws HTTP/1.1\r\nHost: ${HOST}\r\nUpgrade: websocket\r\n`
    + `Connection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
});

// client -> server frames must be masked (RFC 6455 5.3)
function frame(opcode, payload = Buffer.alloc(0)) {
  const mask = crypto.randomBytes(4);
  const m = Buffer.from(payload);
  for (let i = 0; i < m.length; i++) m[i] ^= mask[i % 4];
  return Buffer.concat([Buffer.from([0x80 | opcode, 0x80 | m.length]), mask, m]);
}

let handshakeDone = false, buf = Buffer.alloc(0);
sock.on('data', (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  if (!handshakeDone) {
    const i = buf.indexOf('\r\n\r\n');
    if (i === -1) return;
    const status = buf.subarray(0, i).toString().split('\r\n')[0];
    buf = buf.subarray(i + 4);
    if (!status.includes('101')) { log('HANDSHAKE FAILED:', status); process.exit(1); }
    handshakeDone = true; openAt = Date.now();
    log(`OPEN mode=${mode}`);
    if (mode === 'nopong-listen') setInterval(() => {
      sock.write(frame(0x1, Buffer.from(
        JSON.stringify({ type: 'listen', inbox_addresses: [SAMPLE_INBOX] }))));
      log(`APP-SENT #${++app}`);
    }, 5000);
  }
  for (;;) {
    if (buf.length < 2) return;
    const opcode = buf[0] & 0x0f;
    let len = buf[1] & 0x7f, off = 2;
    if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
    if (buf[1] & 0x80) off += 4;
    if (buf.length < off + len) return;
    const payload = buf.subarray(off, off + len);
    buf = buf.subarray(off + len);
    if (opcode === 0x9) {
      pings++;
      if (mode === 'pong') { sock.write(frame(0xa, payload)); pongs++; log(`PING #${pings} -> ponged`); }
      else if (mode === 'pong-slow') {
        setTimeout(() => { sock.write(frame(0xa, payload)); pongs++; }, PONG_DELAY_MS);
        log(`PING #${pings} -> pong in ${PONG_DELAY_MS}ms`);
      } else log(`PING #${pings} -> IGNORED`);
    } else if (opcode === 0x1) log(`TEXT ${payload.toString().slice(0, 120)}`);
    else if (opcode === 0x8) log(`CLOSE frame code=${len >= 2 ? payload.readUInt16BE(0) : null}`);
  }
});

const done = (how) => {
  log(`RESULT mode=${mode} ${how} lifetime=${openAt ? ((Date.now() - openAt) / 1000).toFixed(2) : 'n/a'}s `
    + `pings=${pings} pongs=${pongs} app=${app}`);
  sock.destroy(); process.exit(0);
};
sock.on('error', (e) => log('SOCKET ERROR', e.message));
// No close frame on a deadline kill: the TCP connection is simply destroyed.
// That is what surfaces to a real client as 1006 / wasClean=false.
sock.on('close', () => done('TCP-CLOSED'));
setTimeout(() => done('SURVIVED cap'), maxMs);
```

Output today:

```
$ node relay-pong-probe.mjs nopong 30
[  0.55s] OPEN mode=nopong
[  9.55s] PING #1 -> IGNORED
[ 10.55s] RESULT mode=nopong TCP-CLOSED lifetime=10.00s pings=1 pongs=0 app=0

$ node relay-pong-probe.mjs pong 30
[  0.53s] OPEN mode=pong
[  9.54s] PING #1 -> ponged
[ 18.54s] PING #2 -> ponged
[ 27.54s] PING #3 -> ponged
[ 30.04s] RESULT mode=pong SURVIVED cap lifetime=29.50s pings=3 pongs=3 app=0
```

</details>

## 2. `channel` crate: skipped-key handling around the DH ratchet step

Two distinct, separately reproducible failure modes. Both sit in skipped-key handling around a DH turn, and we cannot tell from outside whether they are one bug or two. Each has a deterministic repro that builds the failing state from a fresh X3DH pair in seconds — no captured state, no devices. Neither is mobile-specific: 2a was measured desktop-to-desktop.

### 2a. The skipped-key lookup matches by index without checking that the bucket belongs to the frame's chain

**Behaviour.** A receiver files the message keys of frames it had to skip into `skipped_keys_map`, keyed by the header key of the sending chain they belong to. When the sender later opens a NEW sending chain the receiver takes a DH step, and the lookup then matches a skipped key **by index** in the bucket filed under the *pre-step* `current_receiving_header_key`, without checking that the bucket belongs to the incoming frame's chain. A frame of the new chain whose index collides with an index present in that stale bucket is handed an old-chain message key and fails AEAD. Frames at non-colliding indices decrypt normally.

Three conditions are jointly necessary: a bucket exists under the receiver's `current_receiving_header_key`; the incoming frame opens a new sending chain, so the receiver DH-steps; and that frame's index within the new chain is present in the stale bucket.

**The failing index set equals the stale bucket's index set, exactly** — straight from the repro, varying only how many frames were withheld:

| stale bucket | new-chain indices that FAIL | indices that decrypt |
|---|---|---|
| `[0]` | 0 | 1, 2, 3, 4, 5 |
| `[0,1]` | 0, 1 | 2, 3, 4, 5 |
| `[0,1,2]` | 0, 1, 2 | 3, 4, 5 |
| `[0,1,2,3]` | 0, 1, 2, 3 | 4, 5 |

**Live evidence.** The same ablation over our whole corpus (54 capture logs, de-duplicated by envelope fingerprint, since a failed frame is redelivered and re-captured):

| variant | decrypts |
|---|---|
| baseline, exactly as captured | 0 / 159 |
| **drop only `skipped_keys_map[current_receiving_header_key]`** | **139 / 159** |
| `skipped_keys_map = {}` (clears that bucket too) | 139 / 159 |
| keep only the current-recv-header bucket | 0 / 159 |
| drop only the *next*-recv-header bucket (control) | 0 / 159 |
| `previous_sending_chain_length = 0` | 0 / 159 |
| `current_receiving_chain_length = 0` | 0 / 159 |
| swap current and next receiving header key | 0 / 159 |

All 139 recovered failures satisfy the three conditions. The 20 that do not recover sit on near-empty maps and look like genuine replays. This is not a "fewer keys is better" effect: in a representative case the map held 62 keys across 20 buckets and the poisoning bucket held 3 — deleting those 3 decrypts the frame, deleting the other 59 changes nothing.

**It is the lookup at fault, not the bucket contents.** The bucket's keys are valid: the withheld frames they were filed for decrypt correctly from that same bucket, in the same run, both before and after the colliding frames fail. They are simply being applied to a chain they do not belong to.

It also explains a cluster of things we had reported separately: fresh sessions work and aged ones fail (a fresh session has no such bucket); a session reset fixes it (the reset discards the map); failures cluster at chain positions 0-2 and never 3+ (the skipped indices in practice are the low ones, so position was never causal, it is where the collision lands); it worsens over days (every undecryptable frame leaves another skipped key behind); and redelivery usually recovers (by then the receiver has moved past that chain).

**What supplies the trigger.** Forming the bucket needs a later frame of a sending chain processed before an earlier one. Your relay delivers in order, so on a bench it takes deliberate withholding, which is what the script does. In the field, sections 1 and 3 both supply that reordering — a dropped write followed by redelivery is exactly this shape. If that link holds, they are not merely parallel bugs, they are what keeps arming 2a.

⚠️ **One wrong fix to avoid:** simply dropping the bucket and keeping the pruned state destroys the withheld frames it was filed for (3 of 3 measured) — the very frames redelivery would otherwise recover. That trades recoverable latency for permanent loss.

<details>
<summary>Repro script for 2a (node, needs the SDK checkout; set SDK_DIR or place it as a sibling)</summary>

```js
// node repro-2a.mjs   (SDK_DIR=/path/to/quilibrium-js-sdk-channels if not a sibling)
//
// Reproduces 2a from a pristine X3DH pair: no captured state, no devices.
//
// Build: deliver a LATER frame of a sending chain before the earlier ones, so the
// earlier indices are filed as skipped keys under the header key that thereby
// becomes the receiver's current_receiving_header_key. Then have the sender open a
// NEW sending chain and deliver its frames.
//
// Observed: the new chain's frames fail AEAD at exactly the indices present in that
// stale bucket, and decrypt at every other index.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SDK = process.env.SDK_DIR ?? '../quilibrium-js-sdk-channels';
const ch = await import(pathToFileURL(SDK + '/src/channel/channelwasm.js').href);
ch.initSync(readFileSync(SDK + '/src/wasm/channelwasm_bg.wasm'));

const b64 = (s) => Buffer.from(s, 'base64');
const bytes = (b) => [...new Uint8Array(b)];
const sk = (v) => (typeof v === 'string' ? bytes(b64(v)) : v);

function newPair() {
  const aIdent = JSON.parse(ch.js_generate_x448());
  const aEph = JSON.parse(ch.js_generate_x448());
  const bIdent = JSON.parse(ch.js_generate_x448());
  const bPre = JSON.parse(ch.js_generate_x448());
  const A = sk(JSON.parse(ch.js_sender_x3dh(JSON.stringify({
    sending_identity_private_key: aIdent.private_key,
    sending_ephemeral_private_key: aEph.private_key,
    receiving_identity_key: bIdent.public_key,
    receiving_signed_pre_key: bPre.public_key,
    session_key_length: 96,
  }))));
  const B = sk(JSON.parse(ch.js_receiver_x3dh(JSON.stringify({
    sending_identity_private_key: bIdent.private_key,
    sending_signed_private_key: bPre.private_key,
    receiving_identity_key: aIdent.public_key,
    receiving_ephemeral_key: aEph.public_key,
    session_key_length: 96,
  }))));
  return {
    alice: ch.js_new_double_ratchet(JSON.stringify({
      session_key: A.slice(0, 32), sending_header_key: A.slice(32, 64),
      next_receiving_header_key: A.slice(64, 96), is_sender: true,
      sending_ephemeral_private_key: aEph.private_key, receiving_ephemeral_key: bPre.public_key,
    })),
    bob: ch.js_new_double_ratchet(JSON.stringify({
      session_key: B.slice(0, 32), sending_header_key: B.slice(32, 64),
      next_receiving_header_key: B.slice(64, 96), is_sender: false,
      sending_ephemeral_private_key: bPre.private_key, receiving_ephemeral_key: aEph.public_key,
    })),
  };
}

const enc = (state, text) => {
  const r = JSON.parse(ch.js_double_ratchet_encrypt(JSON.stringify({
    ratchet_state: state, message: bytes(Buffer.from(text, 'utf-8')),
  })));
  return [r.ratchet_state, r.envelope];
};
const dec = (state, envelope) => {
  try {
    const r = JSON.parse(ch.js_double_ratchet_decrypt(JSON.stringify({
      ratchet_state: state, envelope,
    })));
    const msg = Buffer.from(new Uint8Array(r.message)).toString('utf-8');
    if (msg.startsWith('Decryption failed') || msg.includes('aead')) return [state, false, msg];
    return [r.ratchet_state, true, msg];
  } catch (e) { return [state, false, String(e).slice(0, 60)]; }
};
const withoutStaleBucket = (state) => {
  const rs = JSON.parse(state);
  const m = { ...(rs.skipped_keys_map ?? {}) };
  delete m[rs.current_receiving_header_key];
  return JSON.stringify({ ...rs, skipped_keys_map: m });
};

/** Withhold chain-1 frames 0..skip-1, deliver frame `skip`, then open chain 2. */
function build(skip) {
  let { alice, bob } = newPair();
  let e, reply;
  const c1 = [];
  for (let i = 0; i < skip + 1; i++) { [alice, e] = enc(alice, `c1-${i}`); c1.push(e); }
  [bob] = dec(bob, c1[skip]);                       // out-of-order: files 0..skip-1
  [bob, reply] = enc(bob, 'reply'); [alice] = dec(alice, reply);   // alice DH-steps
  const c2 = [];
  for (let i = 0; i < 6; i++) { [alice, e] = enc(alice, `c2-${i}`); c2.push(e); }
  return { bob, c1, c2 };
}

console.log('Frames of a NEW sending chain, against a state holding a skipped-keys');
console.log('bucket under current_receiving_header_key.\n');
console.log('  stale bucket | new-chain index | in bucket | decrypt | after dropping the bucket');
for (const skip of [1, 2, 3, 4]) {
  const { bob, c2 } = build(skip);
  const rs = JSON.parse(bob);
  const bucket = Object.keys((rs.skipped_keys_map ?? {})[rs.current_receiving_header_key] ?? {})
    .map(Number).sort((a, b) => a - b);
  const pruned = withoutStaleBucket(bob);
  for (let i = 0; i < 6; i++) {
    const [, ok] = dec(bob, c2[i]);
    const [, okPruned] = dec(pruned, c2[i]);
    console.log(
      `  ${('[' + bucket.join(',') + ']').padEnd(12)} | ${String(i).padStart(15)} | ` +
      `${(bucket.includes(i) ? 'yes' : 'no').padStart(9)} | ${(ok ? 'OK' : 'FAIL').padStart(7)} | ` +
      `${okPruned ? 'OK' : 'FAIL'}`
    );
  }
  console.log();
}

console.log('And what the bucket costs if you drop it: the withheld chain-1 frames it');
console.log('exists to serve.\n');
{
  const { bob, c1 } = build(3);
  const pruned = withoutStaleBucket(bob);
  for (const i of [0, 1, 2]) {
    const [, ok] = dec(bob, c1[i]);
    const [, okPruned] = dec(pruned, c1[i]);
    console.log(`  withheld chain-1 frame ${i}: with bucket ${ok ? 'OK' : 'FAIL'}, without ${okPruned ? 'OK' : 'FAIL'}`);
  }
}
```

Output:

```
  stale bucket | new-chain index | in bucket | decrypt | after dropping the bucket
  [0]          |               0 |       yes |    FAIL | OK
  [0]          |               1 |        no |      OK | OK
  ...
  [0,1,2]      |               0 |       yes |    FAIL | OK
  [0,1,2]      |               1 |       yes |    FAIL | OK
  [0,1,2]      |               2 |       yes |    FAIL | OK
  [0,1,2]      |               3 |        no |      OK | OK

  withheld chain-1 frame 0: with bucket OK, without FAIL
  withheld chain-1 frame 1: with bucket OK, without FAIL
  withheld chain-1 frame 2: with bucket OK, without FAIL
```

</details>

### 2b. A receiver whose FIRST processed frame is at chain position > 0 forks permanently at the next DH turn

Deterministic repro against the SDK wasm build, no devices, runs in seconds (script below).

| Receiver's history on a fresh session | First frame | Alternation afterwards |
|---|---|---|
| Frames 0,1,2 in order | pos 0 | clean |
| Frame 0, then 2 (1 lost mid-chain) | pos 0 | clean (skipped keys work) |
| First frame ever = pos 1 (0 lost) | decrypts OK | first post-turn frame lost, then re-syncs |
| First frame ever = pos 2 (0,1 lost) | decrypts OK | **sender's direction permanently undecryptable from the first DH turn on; receiver's own direction keeps working; retries never recover it** |

Mid-chain gaps are handled, but a missed chain START poisons the first DH ratchet turn, silently and one-directionally. It needs establishment-phase frame loss as a trigger, which sections 1 and 3 supply constantly.

**We cannot currently show this one firing in production.** The desktop-to-desktop failure we might attribute to it is better explained by 2a, which reproduces those exact frames from captured state and is transient where this is permanent. So 2b is a proven crate behaviour with an unquantified live impact — we think the repro justifies a fix on its own.

<details>
<summary>Repro script for 2b (node, needs the SDK checkout; set SDK_DIR or place it as a sibling)</summary>

```js
// node repro.mjs   (SDK_DIR=/path/to/quilibrium-js-sdk-channels if not a sibling)
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SDK = process.env.SDK_DIR ?? '../quilibrium-js-sdk-channels';
const ch = await import(pathToFileURL(SDK + '/src/channel/channelwasm.js').href);
ch.initSync(readFileSync(SDK + '/src/wasm/channelwasm_bg.wasm'));

const b64 = (s) => Buffer.from(s, 'base64');
const bytes = (b) => [...new Uint8Array(b)];
const sk = (v) => (typeof v === 'string' ? bytes(b64(v)) : v);

function newPair() {
  const aIdent = JSON.parse(ch.js_generate_x448());
  const aEph = JSON.parse(ch.js_generate_x448());
  const bIdent = JSON.parse(ch.js_generate_x448());
  const bPre = JSON.parse(ch.js_generate_x448());
  const A = sk(JSON.parse(ch.js_sender_x3dh(JSON.stringify({
    sending_identity_private_key: aIdent.private_key,
    sending_ephemeral_private_key: aEph.private_key,
    receiving_identity_key: bIdent.public_key,
    receiving_signed_pre_key: bPre.public_key,
    session_key_length: 96,
  }))));
  const B = sk(JSON.parse(ch.js_receiver_x3dh(JSON.stringify({
    sending_identity_private_key: bIdent.private_key,
    sending_signed_private_key: bPre.private_key,
    receiving_identity_key: aIdent.public_key,
    receiving_ephemeral_key: aEph.public_key,
    session_key_length: 96,
  }))));
  const alice = ch.js_new_double_ratchet(JSON.stringify({
    session_key: A.slice(0, 32), sending_header_key: A.slice(32, 64),
    next_receiving_header_key: A.slice(64, 96), is_sender: true,
    sending_ephemeral_private_key: aEph.private_key, receiving_ephemeral_key: bPre.public_key,
  }));
  const bob = ch.js_new_double_ratchet(JSON.stringify({
    session_key: B.slice(0, 32), sending_header_key: B.slice(32, 64),
    next_receiving_header_key: B.slice(64, 96), is_sender: false,
    sending_ephemeral_private_key: bPre.private_key, receiving_ephemeral_key: aEph.public_key,
  }));
  return { alice, bob };
}

const enc = (state, text) => {
  const r = JSON.parse(ch.js_double_ratchet_encrypt(JSON.stringify({
    ratchet_state: state, message: bytes(Buffer.from(text, 'utf-8')),
  })));
  return [r.ratchet_state, r.envelope];
};
const dec = (state, envelope, label) => {
  const r = JSON.parse(ch.js_double_ratchet_decrypt(JSON.stringify({
    ratchet_state: state, envelope,
  })));
  const msg = Buffer.from(new Uint8Array(r.message)).toString('utf-8');
  const ok = !(msg.startsWith('Decryption failed') || msg.includes('aead'));
  console.log(`  ${label}: ${ok ? 'OK' : 'FAIL'}`);
  return [ok ? r.ratchet_state : state, ok];
};

function alternate(alice, bob, tag) {
  let e, ok;
  [bob, e] = enc(bob, 'd1');
  [alice, ok] = dec(alice, e, `${tag} alice<-d1`);
  [alice, e] = enc(alice, 'next-m');
  [bob, ok] = dec(bob, e, `${tag} bob<-next-m`);
  [bob, e] = enc(bob, 'd2');
  [alice, ok] = dec(alice, e, `${tag} alice<-d2`);
  [alice, e] = enc(alice, 'next-m2');
  [bob, ok] = dec(bob, e, `${tag} bob<-next-m2`);
}

{ // A: control, in order
  let { alice, bob } = newPair(); let e0, e1, e2, ok;
  [alice, e0] = enc(alice, 'm0'); [alice, e1] = enc(alice, 'm1'); [alice, e2] = enc(alice, 'm2');
  console.log('A: in-order 0,1,2 then alternate');
  [bob, ok] = dec(bob, e0, 'A bob<-e0'); [bob, ok] = dec(bob, e1, 'A bob<-e1'); [bob, ok] = dec(bob, e2, 'A bob<-e2');
  alternate(alice, bob, 'A');
}
{ // B: mid-chain gap
  let { alice, bob } = newPair(); let e0, e1, e2, ok;
  [alice, e0] = enc(alice, 'm0'); [alice, e1] = enc(alice, 'm1'); [alice, e2] = enc(alice, 'm2');
  console.log('B: 0 then 2 (1 lost mid-chain), then alternate');
  [bob, ok] = dec(bob, e0, 'B bob<-e0'); [bob, ok] = dec(bob, e2, 'B bob<-e2');
  alternate(alice, bob, 'B');
}
{ // C: first frame at pos 2
  let { alice, bob } = newPair(); let e0, e1, e2, ok;
  [alice, e0] = enc(alice, 'm0'); [alice, e1] = enc(alice, 'm1'); [alice, e2] = enc(alice, 'm2');
  console.log('C: first frame = e2 (0,1 never seen), then alternate  << the fork');
  [bob, ok] = dec(bob, e2, 'C bob<-e2');
  alternate(alice, bob, 'C');
}
{ // D: first frame at pos 1
  let { alice, bob } = newPair(); let e0, e1, ok;
  [alice, e0] = enc(alice, 'm0'); [alice, e1] = enc(alice, 'm1');
  console.log('D: first frame = e1 (0 lost), then alternate');
  [bob, ok] = dec(bob, e1, 'D bob<-e1');
  alternate(alice, bob, 'D');
}
```

Expected output: A and B fully OK; C fails `bob<-next-m` and `bob<-next-m2` (and every later alice frame, retries included); D fails the first post-turn frame, then recovers.

</details>

## 3. Node write path: a residue of inbox writes vanishes with no client-visible signal

Section 1 accounts for a large share of what we see here, so this is the remainder — plus one observation that does not fit it at all.

With per-frame instrumentation at the `ws.send` call (socket readyState and signature fields logged per write), frames go missing that were handed to the socket with the connection OPEN and `inbox_signature`/`inbox_public_key` populated. They never arrive and are never redelivered. Representative rounds: 4 of 34 to one inbox; 8 of 25 phone-to-phone while the reverse direction lost 0 of 18 in the same minutes; and our mobile app delivering 16/20 and 17/20 where a headless bot **on the same account, same relay, same receiver** delivered 20/20. On the receiver during the loss: no decrypt failures, no missing-state drops. The frames were never received at all, not received and discarded.

Against the 8 lost frames of the phone-to-phone round, four discriminators came back negative: losses spread proportionally across every wire size (2/4 at 1810 B, 2/6 at 1858 B, 4/11 at 3106 B), all were ordinary post-handshake frames, the session was fully confirmed with no re-keying, and 8 of 8 were logged at `ws.send` with the socket open.

**What section 1 explains.** The bot-versus-app gap (its transport answers pings instantly over a wire; the phone's does not), the directionality (loss follows whichever *sender's* socket is dying, so it needs no per-inbox state on your side at all), and the scattered, error-free, session-varying rate.

**What it does not.** In one 5-minute window, read-acks were lost 10 of 10 while chat posts went 11 of 11 on the same socket in the same minutes. A connection dying at arbitrary moments should not sort cleanly by frame type. We have not identified what does that, and we cannot yet tie individual lost frames to individual close events. So: probably mostly section 1, with at least one residue that is not.

Questions:

1. Does the node's write path drop `direct` writes silently in any case — signature verification failure, rate limiting, size, timestamp collision on `(inbox, timestamp)`, anything else? Node-side logs for a test window would settle it; we can trigger a capture round on demand and hand you exact timestamps and byte sizes of the vanished frames.
2. Is there anything that would make one *frame type* (read-acks) fail while ordinary posts on the same socket in the same minutes succeed?
3. Would a write-ack (or error frame) in the protocol be feasible? It would turn every silent loss into a retryable client-side event. Section 1 makes this more valuable rather than less: connections will always break sometimes, and without an ack a client cannot distinguish a delivered write from a discarded one.

---

Deep background, the full evidence trail and every shipped client fix are documented in `quorum-desktop/.agents/docs/`, but this issue is self-contained.
