#!/usr/bin/env node
// ROUND Q analyser — joins each burst message to the nearest socket CLOSE, and
// compares burst-time connection lifetimes against the idle baseline.
//
// This exists so the round's central question is answered by a command rather
// than by a hand-built table at the end of a long session. Round P's join was
// done by hand; this reproduces it mechanically and adds the lifetime test.
//
// WHAT IT ANSWERS
//   1. Does every LOST message sit shortly before a `[WS-life] CLOSE`?
//      -> confirms the relay-pong diagnosis end to end.
//   2. Is any lost message far from every CLOSE?
//      -> ⛔ REFUTES it. A second loss mechanism exists. This is the outcome
//         that matters most, so it is reported loudly rather than averaged away.
//   3. Are burst-time connection lifetimes longer than the 19.0s idle baseline?
//      -> indirect test of the one load-bearing inference (that RN misses pongs
//         because the radio sleeps). Longer under load supports it; the same
//         as idle undercuts it.
//
// USAGE
//   node join-losses-to-closes.mjs <capture.log> --lost 5,11,17
//   node join-losses-to-closes.mjs <capture.log>            # no landed/lost split
//
// Run validate-capture.mjs FIRST — this script assumes the rig was armed and
// says nothing about whether the capture is valid.

import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flagVal = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const burstFile = flagVal('--burst');
const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--lost' && args[i - 1] !== '--burst');
const lostArg = flagVal('--lost') ?? '';
const LOST = new Set(
  lostArg.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
);

if (!file) {
  console.error('usage: node join-losses-to-closes.mjs <capture.log> [--lost 5,11,17]');
  process.exit(1);
}

// The idle baseline this round is measured against: 81 drops in 25.6 min.
const IDLE_BASELINE_S = 19.0;

const src = readFileSync(file, 'utf-8').split('\n');

// logcat -v time: "07-30 17:28:29.123 W/ReactNativeJS( 1234): <msg>"
const TS = /^(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s/;
function tsOf(line) {
  const m = TS.exec(line);
  if (!m) return null;
  const [, mo, d, h, mi, s, ms] = m.map(Number);
  // Month-of-year offset is fine: all deltas are within one round.
  return ((((mo * 31 + d) * 24 + h) * 60 + mi) * 60 + s) * 1000 + ms;
}

const sends = [];   // one per [DM-send wire] = one message's fan-out batch
const frames = [];  // [WS-frame] sent
const life = [];    // [WS-life] OPEN / CLOSE / ERROR

// `[WS-life]` carries its own `t=<epoch ms>` from the device's Date.now(). Prefer
// it over the logcat wall-clock: it is absolute, needs no timezone guessing, and
// it is the SAME clock the burst record's tsQueuedIso uses — which is what makes
// the burst-record join below exact rather than approximate.
for (const line of src) {
  const logT = tsOf(line);
  if (line.includes('[WS-life]')) {
    const kind = /\[WS-life\]\s+(OPEN|CLOSE|ERROR)/.exec(line)?.[1];
    if (!kind) continue;
    const epoch = /\[WS-life\]\s+\w+\s+t=(\d+)/.exec(line)?.[1];
    const code = /code=(\d+)/.exec(line)?.[1] ?? null;
    life.push({ t: epoch ? Number(epoch) : logT, kind, code, epoch: !!epoch });
    continue;
  }
  if (logT === null) continue;
  if (line.includes('[DM-send wire]')) sends.push({ t: logT, line: line.trim() });
  else if (line.includes('[WS-frame] sent')) frames.push({ t: logT });
}

// Fallback message source: the burst button's own JSONL record, which lives on
// `master` and so survives a round captured without the diag branch's
// `[DM-send wire]` probe. Its tsQueuedIso shares the device clock with the
// `[WS-life]` t= values, so the join stays exact.
let sendSource = '[DM-send wire]';
if (burstFile) {
  const recs = readFileSync(burstFile, 'utf-8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .filter((r) => r.type === 'message' && r.tsQueuedIso);
  sends.length = 0;
  for (const r of recs.sort((a, b) => a.seq - b.seq)) {
    sends.push({ t: Date.parse(r.tsQueuedIso), text: r.text, seq: r.seq });
  }
  sendSource = `burst record (${burstFile})`;
  // The life events must be on the same absolute clock for this to be valid.
  if (life.length && !life[0].epoch) {
    console.error('REFUSING: burst mode needs [WS-life] t=<epoch>, which this capture lacks.');
    process.exit(1);
  }
}

const closes = life.filter((e) => e.kind === 'CLOSE');
const opens = life.filter((e) => e.kind === 'OPEN');

console.log(`\n=== ${file}`);
console.log(`    messages from: ${sendSource}`);
console.log(`    ${sends.length} messages, ${frames.length} frames at ws.send, `
  + `${opens.length} OPEN, ${closes.length} CLOSE\n`);

if (!sends.length) {
  console.error('No message timestamps. Either the rig was armed (use [DM-send wire])');
  console.error('or pass the burst record: --burst <run-*.jsonl>');
  process.exit(1);
}
if (!life.length) {
  console.error('No [WS-life] lines — the LIFECYCLE probe is not in this build.');
  console.error('That is the whole point of this round. Re-arm and re-capture:');
  console.error('  git debug   (then restart Metro with -ResetCache)');
  process.exit(1);
}

// ---- 1. the join --------------------------------------------------------
console.log('--- message -> nearest following CLOSE ---');
console.log('  #   t(rel s)   next CLOSE   Δ to CLOSE   outcome');
const rows = [];
const t0 = sends[0].t;
for (let i = 0; i < sends.length; i++) {
  const n = i + 1;
  const s = sends[i];
  const next = closes.find((c) => c.t >= s.t);
  const delta = next ? (next.t - s.t) / 1000 : null;
  const lost = LOST.has(n);
  rows.push({ n, delta, lost });
  const outcome = LOST.size === 0 ? '' : lost ? 'LOST' : 'landed';
  console.log(
    `  ${String(n).padStart(2)}   ${((s.t - t0) / 1000).toFixed(1).padStart(7)}   `
    + `${(next ? 'yes' : 'none').padStart(9)}   ${(delta === null ? '-' : delta.toFixed(2) + 's').padStart(10)}   ${outcome}`
  );
}

// ---- 2. the verdict -----------------------------------------------------
if (LOST.size > 0) {
  const lostRows = rows.filter((r) => r.lost);
  const landedRows = rows.filter((r) => !r.lost);
  const withClose = lostRows.filter((r) => r.delta !== null);
  const orphans = lostRows.filter((r) => r.delta === null);

  console.log('\n--- verdict ---');
  const fmt = (xs) => xs.length ? xs.map((r) => r.delta.toFixed(2) + 's').join(', ') : '(none)';
  console.log(`  lost   Δ: ${fmt(withClose)}`);
  console.log(`  landed Δ: ${fmt(landedRows.filter((r) => r.delta !== null))}`);

  // The discriminator is a clean SEPARATION, as in Round P: every loss closer to
  // the next CLOSE than every survivor (lost 2.0/2.5/4.6s, nearest survivor
  // 5.1s). "Some landed message is nearer than some loss" is not interesting on
  // its own — what matters is whether the two groups overlap at all.
  const landedWithClose = landedRows.filter((r) => r.delta !== null);
  const maxLost = withClose.length ? Math.max(...withClose.map((r) => r.delta)) : null;
  const minLanded = landedWithClose.length
    ? Math.min(...landedWithClose.map((r) => r.delta)) : null;

  if (orphans.length) {
    console.log(`\n  ⛔ REFUTED (candidate): message(s) ${orphans.map((r) => r.n).join(', ')} `
      + `were LOST with NO CLOSE after them at all.`);
    console.log('     The socket model does not cover these. Do not average this away —');
    console.log('     it is the finding this round exists to surface.');
  } else if (maxLost === null || minLanded === null) {
    console.log('\n  (need both a loss and a survivor with a following CLOSE to compare)');
  } else if (maxLost < minLanded) {
    console.log(`\n  ✅ CLEAN SEPARATION: every loss is within ${maxLost.toFixed(2)}s of the next`);
    console.log(`     CLOSE; the nearest survivor is ${minLanded.toFixed(2)}s away. The blind`);
    console.log(`     window sits between them. Round P's boundary was ~5s.`);
  } else if (
    // Two-sided band: losses occupy a middle window, and survivors sit BOTH
    // further out (connection still alive) and nearer (caught mid-batch by the
    // pendingEnvelopes requeue and flushed on reconnect). Round Q showed exactly
    // this, and a one-sided test misreports it as OVERLAP.
    Math.min(...withClose.map((r) => r.delta))
      > Math.min(...landedWithClose.map((r) => r.delta))
    && landedWithClose.every((r) => r.delta < Math.min(...withClose.map((x) => x.delta))
      || r.delta > maxLost)
  ) {
    const lo = Math.min(...withClose.map((r) => r.delta));
    const rescued = landedWithClose.filter((r) => r.delta < lo);
    const alive = landedWithClose.filter((r) => r.delta > maxLost);
    console.log(`\n  ✅ CLEAN BAND: every loss falls in [${lo.toFixed(2)}s, ${maxLost.toFixed(2)}s]`);
    console.log(`     before a CLOSE, and NO survivor falls inside it.`);
    console.log(`     ${alive.length} survivor(s) >${maxLost.toFixed(2)}s out — connection still alive.`);
    console.log(`     ${rescued.length} survivor(s) <${lo.toFixed(2)}s out — consistent with the`);
    console.log(`     pendingEnvelopes requeue: a frame caught mid-batch when the failure`);
    console.log(`     finally surfaces is requeued and flushed on reconnect, so the LAST`);
    console.log(`     writes before detection are rescued while earlier ones are not.`);
    console.log(`     ⚠️  The requeue reading is POST-HOC for this round. It needs its own`);
    console.log(`     pre-registered prediction before it is treated as established.`);
  } else {
    const overlapLost = withClose.filter((r) => r.delta >= minLanded).length;
    const overlapLanded = landedWithClose.filter((r) => r.delta <= maxLost).length;
    console.log(`\n  ⚠️  OVERLAP — no clean threshold. Losses span up to ${maxLost.toFixed(2)}s`);
    console.log(`     while the nearest survivor is ${minLanded.toFixed(2)}s: ${overlapLost} loss(es)`);
    console.log(`     sit beyond a survivor, and ${overlapLanded} survivor(s) sit inside the loss range.`);
    console.log('     Proximity to a CLOSE does not by itself decide the outcome here.');
    console.log('     Report the overlap; do not present this as confirmation.');
  }
}

// ---- 3. lifetimes vs the idle baseline ----------------------------------
console.log('\n--- connection lifetimes during the burst vs idle baseline ---');
const lifetimes = [];
for (const o of opens) {
  const c = closes.find((x) => x.t > o.t);
  if (c) lifetimes.push((c.t - o.t) / 1000);
}
if (!lifetimes.length) {
  console.log(`  No OPEN->CLOSE pair completed during the capture.`);
  console.log(`  If the burst ran its full ~50s with no CLOSE at all, that ALONE is the`);
  console.log(`  radio-warmth result: idle drops every ${IDLE_BASELINE_S}s, active does not.`);
} else {
  const sorted = [...lifetimes].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  console.log(`  n=${lifetimes.length}  min=${sorted[0].toFixed(1)}s  `
    + `median=${median.toFixed(1)}s  max=${sorted[sorted.length - 1].toFixed(1)}s`);
  console.log(`  idle baseline: one drop every ${IDLE_BASELINE_S}s`);
  if (median > IDLE_BASELINE_S * 1.5) {
    console.log(`  -> Lifetimes are markedly LONGER under load. Supports radio sleep as`);
    console.log(`     the pong-delay mechanism (the unproven load-bearing inference).`);
  } else if (median < IDLE_BASELINE_S * 0.8) {
    console.log(`  -> SHORTER under load than idle. Unexpected: the burst itself may be`);
    console.log(`     implicated, which the idle capture was taken to rule out. Investigate.`);
  } else {
    console.log(`  -> Comparable to idle. Radio state is NOT the differentiator, so the`);
    console.log(`     "RN misses pongs because the radio sleeps" story needs another`);
    console.log(`     explanation. Record this even though it undercuts the model.`);
  }
}

const codes = [...new Set(closes.map((c) => c.code).filter(Boolean))];
if (codes.length) console.log(`\n  close codes seen: ${codes.join(', ')} (expect 1006)`);
console.log('');
