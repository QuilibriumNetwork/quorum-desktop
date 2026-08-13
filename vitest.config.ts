// @ts-ignore - Will be available after installing vitest
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['@lingui/babel-plugin-lingui-macro'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/dev/tests/setup.ts'],
    globals: true,
    css: false,
    include: ['src/dev/tests/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    // The headless harness scenarios belong to vitest.harness.config.ts and CANNOT
    // run here: this config's setup.ts mocks WebSocket and crypto, and the wasm core
    // is never initialised, so every scenario fails on `js_generate_ed448` or on a
    // missing lingui locale. They were failing this suite (8 files) purely for that
    // reason. Run them with `yarn harness`.
    // `security/**` belongs to vitest.security.config.ts and CANNOT run here.
    // Those tests must execute against the PRODUCTION build of react-dom, which
    // is the only build whose behaviour is worth asserting; this config runs the
    // development build, where they self-detect and fail on purpose. Run them
    // with `yarn test:security`.
    // `perf/**` belongs to vitest.perf.config.ts and MUST NOT run here. Those are
    // load-generating benchmarks, and extra CPU contention raises the failure rate
    // of the suite's timing-sensitive tests.
    // Measured 2026-08-13, and stated carefully because the two effects are easy to
    // conflate: `websocketInboundPickup` and `fetchSpaceReplies` are ALREADY
    // intermittently load-sensitive — the suite failed once in 8 runs with no bench
    // present at all. Adding one bench file took that to 3 failures in 6 runs. So
    // the benches do not create the flakiness, they amplify it; both are worth
    // fixing, and keeping them apart stops a benchmark from being blamed for a
    // pre-existing flake (or vice versa). Run them with `yarn bench`.
    exclude: [
      'node_modules',
      'dist',
      'src/dev/tests/harness/**',
      'src/dev/tests/security/**',
      'src/dev/tests/perf/**',
    ],
    server: {
      deps: {
        inline: [
          '@quilibrium/quilibrium-js-sdk-channels',
          // react-tooltip is installed under quorum-shared/node_modules, so when
          // it is left external Node resolves its bare `react` import to the copy
          // beside it — a SECOND React instance, whose hooks throw
          // "Cannot read properties of null (reading 'useState')" the moment any
          // component renders a Tooltip. Inlining routes it through Vite, where
          // the `react`/`react-dom` aliases below collapse it back to one
          // instance. `web/vite.config.ts` solves the same problem for the app
          // with the same aliases plus `dedupe`.
          'react-tooltip',
        ],
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      crypto: resolve(__dirname, 'node_modules/crypto-browserify/index.js'),
      react: resolve(__dirname, 'node_modules/react'),
      'react-dom': resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': resolve(__dirname, 'node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': resolve(__dirname, 'node_modules/react/jsx-dev-runtime'),
    },
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js'],
    dedupe: ['react', 'react-dom'],
  },
});
