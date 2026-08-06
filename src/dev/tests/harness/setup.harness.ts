// Harness setup — shims + wasm init. NO mocks (that is the unit-test setup.ts,
// which mocks WebSocket/crypto and is exactly what the harness must avoid).
//
// Order matters: the shim must apply before the SDK bundle evaluates, so it is a
// separate side-effect module imported first.
import './shim';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { i18n } from '@lingui/core';
import { channel_raw } from '@quilibrium/quilibrium-js-sdk-channels';

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
