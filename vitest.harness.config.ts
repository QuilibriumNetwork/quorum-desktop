// Vitest config for the headless DM harness (src/dev/tests/harness/).
//
// This is DELIBERATELY separate from vitest.config.ts. The unit-test setup
// (src/dev/tests/setup.ts) MOCKS WebSocket and crypto — the exact opposite of
// what the harness needs. Here we want the REAL socket, REAL webcrypto, a node
// environment, fake-indexeddb for storage, and multi-hour timeouts so a volume
// run can execute unattended.
//
// It reuses the Vite transform pipeline (via defineConfig) so that when a later
// slice imports the real src/services/MessageService.ts, the lingui macro and
// the .web.ts / .native.ts extension resolution both work — plain `node` cannot
// do that, which is why the existing .agents/tools/dm-debug/*.mjs scripts only
// ever import the SDK, never a service.
//
// Run:  yarn harness            (all scenarios)
//       yarn harness ping       (files matching "ping")
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  // Same transform pipeline as vitest.config.ts: the React plugin carries the
  // lingui macro babel plugin, which MessageService (and the shared barrel) need
  // to compile their `@lingui/*/macro` imports.
  plugins: [
    react({
      babel: {
        plugins: ['@lingui/babel-plugin-lingui-macro'],
      },
    }),
  ],
  test: {
    // jsdom for the browser DOM surface (window/document/addEventListener) that
    // the quorum-shared barrel touches at import time (react-tooltip etc.). We do
    // NOT load the unit-test setup that mocks WebSocket/crypto, so node's REAL
    // global WebSocket and webcrypto survive — jsdom provides neither, so it
    // can't shadow them. Confirmed: the ping scenario's live WS still connects.
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost' } },
    globals: true,
    // Shim-only setup (window/Buffer) — NOT the unit-test setup, which mocks
    // WebSocket and crypto. The harness needs those real.
    setupFiles: ['src/dev/tests/harness/setup.harness.ts'],
    include: ['src/dev/tests/harness/**/*.scenario.test.ts'],
    exclude: ['node_modules', 'dist'],
    // A volume/aging run can take a long time; never time it out by default.
    testTimeout: 60 * 60 * 1000, // 1 hour
    hookTimeout: 5 * 60 * 1000,
    // Scenarios hit a shared live relay and share throwaway accounts — run them
    // one at a time so two scenarios can't stomp each other's session state.
    fileParallelism: false,
    server: {
      deps: {
        // The SDK ships an ESM bundle with the wasm inlined; inline it so the
        // wasm auto-initialises on import (same as the browser app).
        inline: ['@quilibrium/quilibrium-js-sdk-channels'],
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      crypto: resolve(__dirname, 'node_modules/crypto-browserify/index.js'),
    },
    // Prefer .web.ts so crypto.ts / platform.ts resolve to their web variants,
    // never the .native ones (React Native).
    extensions: ['.web.ts', '.web.js', '.ts', '.js', '.tsx', '.jsx'],
  },
});
