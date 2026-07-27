// ============================================================================
// DR SELF-ECHO — does a client receive its OWN outbound DM frames?
//
// The headless harness measured that it does, and that the app's subscription
// rule is the reason: MessageDB.tsx `setResubscribe` listens on
// `getAllEncryptionStates().map(c => c.inboxId)` + the device inbox, and at least
// one of those rows carries an inboxId the client also SENDS to. The relay then
// hands the client back its own ciphertext, which can never decrypt — a
// guaranteed AEAD failure with no bug in the crate involved.
//
// Harness measurement (fresh throwaway pair, prod relay, 2026-07-27):
//   41% and 48% of all arrivals at the two bots were the bot's OWN ciphertext.
//
// This checks the same thing in the CAPTURED BROWSER logs, where it matters for
// the headline number: §1 reports "~40% of frames fail AEAD". If a large share of
// a client's arrivals are its own frames, that percentage is measuring the
// subscription defect as much as the crate bug.
//
// A fingerprint appearing in BOTH `[DM-send wire]` and `[DM-recv wire]` on the
// SAME client's log is self-echo: this client sent that exact frame and then
// received it back.
//
// usage: node dr-self-echo.mjs <log> [...more logs]
// ============================================================================
import { readFileSync } from 'node:fs';

const SEND = /\[DM-send wire\]\s+fp=(\w+)\s+to=(\S+)/;
const RECV = /\[DM-recv wire\]\s+fp=(\w+)\s+inbox=(\S+)/;

let anyData = false;
const totals = { sent: 0, recv: 0, echo: 0 };

for (const path of process.argv.slice(2)) {
  const sent = new Map();   // fp -> target inbox
  const recv = new Map();   // fp -> arrival inbox
  let sendLines = 0;
  let recvLines = 0;

  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const s = line.match(SEND);
    if (s) { sendLines++; if (!sent.has(s[1])) sent.set(s[1], s[2]); continue; }
    const r = line.match(RECV);
    if (r) { recvLines++; if (!recv.has(r[1])) recv.set(r[1], r[2]); }
  }
  if (!sendLines && !recvLines) continue;
  anyData = true;

  const echo = [...recv.keys()].filter((fp) => sent.has(fp));
  const name = path.replace(/\\/g, '/').split('/').pop();
  const pct = recv.size ? ((echo.length / recv.size) * 100).toFixed(1) : '0.0';

  console.log(`\n${name}`);
  console.log(`  distinct frames SENT      ${sent.size}   (${sendLines} raw lines)`);
  console.log(`  distinct frames RECEIVED  ${recv.size}   (${recvLines} raw lines)`);
  console.log(`  received its OWN frames   ${echo.length}  = ${pct}% of arrivals` +
    (echo.length ? '   <<<<<< SELF-ECHO' : ''));

  if (echo.length) {
    // Where do they land, and is that the inbox they were addressed to?
    const byInbox = new Map();
    for (const fp of echo) {
      const key = `${recv.get(fp)}  <- addressed to ${sent.get(fp)}`;
      byInbox.set(key, (byInbox.get(key) ?? 0) + 1);
    }
    for (const [k, n] of [...byInbox.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
      console.log(`     ${String(n).padStart(4)}x  arrived on ${k}`);
    }
  }

  totals.sent += sent.size;
  totals.recv += recv.size;
  totals.echo += echo.length;
}

if (!anyData) {
  console.log('No [DM-send wire] / [DM-recv wire] probes found.');
  console.log('These come from the diag/dm-frame-join build only (bug doc §6).');
  process.exit(0);
}

console.log('\n' + '='.repeat(72));
console.log(`ACROSS ALL LOGS: ${totals.echo} of ${totals.recv} distinct arrivals were the ` +
  `client's own frames (${totals.recv ? ((totals.echo / totals.recv) * 100).toFixed(1) : '0'}%)`);
console.log('='.repeat(72));
console.log('Every self-echoed frame is an unavoidable AEAD failure: it is sealed to');
console.log('the PEER\'s session and this client has no key for it. Any failure rate');
console.log('computed over all arrivals therefore counts these as crate failures.');
