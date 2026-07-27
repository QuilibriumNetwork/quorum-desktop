// Harness setup — shims + wasm init. NO mocks (that is the unit-test setup.ts,
// which mocks WebSocket/crypto and is exactly what the harness must avoid).
//
// Order matters: the shim must apply before the SDK bundle evaluates, so it is a
// separate side-effect module imported first.
import './shim';
import { readFileSync } from 'node:fs';
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

// The published npm package ships no .wasm; the app resolves it from the sibling
// SDK source repo via viteStaticCopy (web/vite.config.ts). Mirror that convention.
// Override with SDK_WASM if the sibling repo lives elsewhere.
const wasmPath =
  process.env.SDK_WASM ??
  resolve(
    process.cwd(),
    '../quilibrium-js-sdk-channels/src/wasm/channelwasm_bg.wasm'
  );

// Initialise the PACKAGE's wasm binding. channel_raw and the high-level `channel`
// API are one bundle sharing a single `wasm` var, so this inits both.
channel_raw.initSync(readFileSync(wasmPath));
