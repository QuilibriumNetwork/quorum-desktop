#!/usr/bin/env node
// Fail-closed gate for DM capture logs. Run it BEFORE trusting any number a
// capture produced — and ideally 20 seconds after starting a capture, so an
// unusable round is caught before it is run rather than after.
//
// WHY THIS EXISTS
// ---------------
// The rig has always been self-attesting: a valid capture contains
// `[DM-diag] armed` (the build is the diag branch) and `[WS-diag] transport
// patch armed` (the node_modules transport patch survived the last install).
// The problem was never the evidence, it was the enforcement — the capture
// script printed "confirm BOTH these lines appear" and left it to a human.
// Round 25 was captured, analysed and thrown away because nobody looked.
//
// The failure class is time-of-check/time-of-use: `git debug` verifies the rig,
// then any `yarn install` or `quorum-shared` rebuild silently disarms it, and
// the capture that follows looks normal — just quieter. Absence of evidence
// reads exactly like a quiet network.
//
// So the rule this enforces: a capture missing its armed markers cannot yield a
// number. It exits non-zero, and no analysis step should proceed past it.
//
// USAGE
//   node validate-capture.mjs <capture.log>
//   node validate-capture.mjs                  # newest log in $XPTRACE_DIR
//   XPTRACE_DIR=/path/to/logs node validate-capture.mjs
//
// Exit codes: 0 = usable, 1 = REJECTED, 2 = usable but degraded (see --strict).
// --strict turns degraded into a rejection.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2).filter((a) => a !== '--strict');
const STRICT = process.argv.includes('--strict');

// --- locate the capture -----------------------------------------------------
// No hardcoded capture directory: it is machine-specific and does not belong in
// a tracked repo. Pass a path, or set XPTRACE_DIR.
let file = args[0];
if (!file) {
  const dir = process.env.XPTRACE_DIR;
  if (!dir) {
    console.error('usage: node validate-capture.mjs <capture.log>');
    console.error('   or: set XPTRACE_DIR to the capture directory and pass no argument');
    process.exit(1);
  }
  const logs = readdirSync(dir)
    .filter((f) => f.startsWith('xptrace-') && f.endsWith('.log'))
    .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!logs.length) {
    console.error(`REJECTED: no xptrace-*.log found in ${dir}`);
    process.exit(1);
  }
  file = join(dir, logs[0].f);
  console.log(`(newest capture in XPTRACE_DIR: ${logs[0].f})`);
}

let src;
try {
  src = readFileSync(file, 'utf-8');
} catch (e) {
  console.error(`REJECTED: cannot read ${file} — ${e.message}`);
  process.exit(1);
}

const count = (needle) => src.split(needle).length - 1;
const lines = src.split('\n').length;

// --- the two markers that decide validity -----------------------------------
// Both are emitted once per app start. Missing either means the running build
// was not the rig, and every count derived from it is meaningless.
const REQUIRED = [
  {
    marker: '[DM-diag] armed',
    what: 'JS probes (build is the diag branch)',
    remedy: 'git debug   # rebases diag/dm-frame-trace onto master and checks it out',
  },
  {
    marker: '[WS-diag] transport patch armed',
    what: 'transport patch inside node_modules (wiped by every yarn install and by any quorum-shared rebuild)',
    remedy: 'node .agents/scripts/patch-rn-ws-diag.mjs   # then RESTART Metro with -ResetCache',
  },
];

// --- probes that should produce lines, but legitimately may not -------------
const PROBES = [
  ['[DM-send row]', 'per send: which session + shape was chosen'],
  ['[DM-send wire]', 'per drain batch: target inboxes + fingerprints'],
  ['[WS-frame]', 'per frame AT the ws.send call'],
  ['[DM-recv wire]', 'per arriving DM frame'],
  ['[WS-life]', 'socket lifecycle OPEN/CLOSE/ERROR'],
];

console.log(`\n=== capture: ${file}`);
console.log(`    ${lines.toLocaleString()} lines, ${(src.length / 1024).toFixed(0)} KB\n`);

let rejected = false;
let degraded = false;

if (src.trim().length === 0) {
  console.error('REJECTED: capture is empty.');
  process.exit(1);
}

console.log('--- REQUIRED markers ---');
for (const { marker, what, remedy } of REQUIRED) {
  const n = count(marker);
  if (n === 0) {
    rejected = true;
    console.error(`  MISSING  ${marker}`);
    console.error(`           ${what}`);
    console.error(`           fix: ${remedy}`);
  } else {
    console.log(`  ok (${n})  ${marker}`);
  }
}

console.log('\n--- probe output ---');
for (const [marker, what] of PROBES) {
  const n = count(marker);
  if (n === 0) {
    degraded = true;
    console.log(`  none     ${marker.padEnd(16)} ${what}`);
  } else {
    console.log(`  ${String(n).padStart(6)}   ${marker.padEnd(16)} ${what}`);
  }
}

// --- logcat throttling ------------------------------------------------------
// Round P lost ~12 of ~120 expected frame lines to logcat's own rate limiter,
// which drops lines silently and reports it only as "chatty" bookkeeping. A
// capture that was throttled can undercount frames, which reads as loss.
console.log('\n--- logcat throttling ---');
const chatty = count('chatty') + count('identical ') ;
if (chatty > 0) {
  degraded = true;
  console.log(`  WARNING  ${chatty} throttle indicator(s) — logcat dropped lines silently.`);
  console.log('           Frame counts may UNDERCOUNT, which reads as loss.');
  console.log('           Re-run with a larger buffer: adb logcat -G 16M');
} else {
  console.log('  ok       no throttling detected');
}

// --- verdict ----------------------------------------------------------------
console.log('');
if (rejected) {
  console.error('REJECTED — this capture cannot support a measurement.');
  console.error('Re-arm the rig and capture again. Do not analyse this file.');
  process.exit(1);
}
if (degraded && STRICT) {
  console.error('REJECTED (--strict) — usable markers present, but degraded above.');
  process.exit(1);
}
if (degraded) {
  console.log('USABLE, DEGRADED — armed correctly, but read the warnings above');
  console.log('before quoting any count from it.');
  process.exit(2);
}
console.log('USABLE — rig armed, all probes reporting, no throttling.');
process.exit(0);
