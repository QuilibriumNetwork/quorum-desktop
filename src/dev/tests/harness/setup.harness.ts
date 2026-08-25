// Harness setup — shims + wasm init. NO mocks (that is the unit-test setup.ts,
// which mocks WebSocket/crypto and is exactly what the harness must avoid).
//
// Order matters: the shim must apply before the SDK bundle evaluates, so it is a
// separate side-effect module imported first.
import './shim';
import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { i18n } from '@lingui/core';
import { channel_raw } from '@quilibrium/quilibrium-js-sdk-channels';

// HARNESS_CONSOLE_FILE=1 mirrors every console call to a file.
//
// Vitest SWALLOWS this side's console output entirely when its stdout is piped,
// which is exactly how the cross-client orchestrator runs it (run-cross.mjs
// spawns it and tags each line). MEASURED 2026-08-24: a run in which the
// scenario's own `console.log('[dm-cross b] …')` produced ZERO lines in the
// piped output while the identical strings appeared in the RunLog jsonl.
//
// The practical cost was that the desktop half of the cross-client arm could
// only ever be observed through whatever the scenario deliberately wrote to its
// RunLog — every `logger.warn` from the service layer, including the one that
// announces a session being REPLACED, was invisible. A blind side of an
// instrument reads as "nothing happened", which is worse than no instrument.
//
// A file append bypasses the capture; stderr does not, because vitest hooks
// that too. Off by default: it is a diagnostic, not a normal cost.
if (process.env.HARNESS_CONSOLE_FILE === '1') {
  const dir = resolve(process.cwd(), 'src/dev/tests/harness/logs');
  mkdirSync(dir, { recursive: true });
  const role = process.env.HARNESS_ROLE ?? 'x';
  const runId = process.env.HARNESS_RUN_ID ?? 'local';
  const file = resolve(dir, `${runId}-${role}-console.log`);
  for (const level of ['debug', 'log', 'info', 'warn', 'error'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      try {
        const line = args
          .map((a) => {
            if (typeof a === 'string') return a;
            try {
              return JSON.stringify(a);
            } catch {
              return String(a);
            }
          })
          .join(' ');
        appendFileSync(file, `[${level}] ${line}\n`);
      } catch {
        // Never let the diagnostic break the run it is observing.
      }
      original(...args);
    };
  }
}

// The service layer calls lingui `t` macros; without an active locale they throw
// ("Attempted to call a translation function without setting a locale"). The
// harness doesn't need real translations — an empty 'en' catalog makes `t`
// return the source string.
i18n.load('en', {});
i18n.activate('en');

// NOTE on WebSocket: the harness environment is jsdom (needed for the DOM the
// shared UI barrel touches at import). jsdom's built-in WebSocket does not
// connect to a real relay, and node's undici WebSocket hangs under jsdom, so the
// transport imports the `ws` package explicitly rather than using a global.

// The published npm package ships no .wasm (it ships only dist/), so the binary
// has to come from somewhere else. Mirrors web/vite.config.ts: prefer a local
// SDK checkout when one exists, otherwise fall back to the copy committed in
// public/, which is what the app itself ships and is always present.
//
// The sibling-checkout path is listed last because it only resolves from the
// main checkout — from a git worktree it points at `.worktrees/quilibrium-js-
// sdk-channels`, which does not exist. Relying on it alone broke `yarn harness`
// in worktrees. Override with SDK_WASM to point anywhere else.
const wasmCandidates = [
  'node_modules/@quilibrium/quilibrium-js-sdk-channels/src/wasm/channelwasm_bg.wasm',
  '../quilibrium-js-sdk-channels/src/wasm/channelwasm_bg.wasm',
  'public/channelwasm_bg.wasm',
];
const wasmPath =
  process.env.SDK_WASM ??
  wasmCandidates
    .map((c) => resolve(process.cwd(), c))
    .find((p) => existsSync(p));

if (!wasmPath) {
  throw new Error(
    `Harness could not locate channelwasm_bg.wasm. Tried: ${wasmCandidates.join(', ')}. ` +
      `Set SDK_WASM to an explicit path.`
  );
}

// Initialise the PACKAGE's wasm binding. channel_raw and the high-level `channel`
// API are one bundle sharing a single `wasm` var, so this inits both.
channel_raw.initSync(readFileSync(wasmPath));
