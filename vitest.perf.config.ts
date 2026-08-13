// Vitest config for performance instruments (src/dev/tests/perf/).
//
// DELIBERATELY separate from vitest.config.ts, for one measured reason: these
// files generate load, and extra CPU contention raises the failure rate of the
// unit suite's timing-sensitive tests.
//
// Measured 2026-08-13, stated carefully because the two effects are easy to
// conflate. `websocketInboundPickup` and `fetchSpaceReplies` are ALREADY
// intermittently load-sensitive: the unit suite failed once in 8 runs with no
// bench present at all, and both pass consistently in isolation. Adding a single
// bench file took that to 3 failures in 6 runs. The benches therefore AMPLIFY a
// pre-existing flake rather than causing it. Both problems are worth fixing;
// separating them means a benchmark is never blamed for a pre-existing flake,
// and a pre-existing flake never discredits a benchmark.
//
// Everything else mirrors vitest.config.ts, so a bench sees exactly the same
// module resolution and React instance as the unit tests it measures.
//
// Run:  yarn bench                    (all instruments)
//       yarn bench spaceMentionCounts (files matching)
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
    include: ['src/dev/tests/perf/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: ['node_modules', 'dist'],
    // One file at a time. A benchmark measured while competing with another
    // benchmark is measuring the scheduler, not the code.
    fileParallelism: false,
    server: {
      deps: {
        inline: ['@quilibrium/quilibrium-js-sdk-channels', 'react-tooltip'],
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
      'react/jsx-dev-runtime': resolve(
        __dirname,
        'node_modules/react/jsx-dev-runtime'
      ),
    },
    extensions: [
      '.web.tsx',
      '.web.ts',
      '.web.jsx',
      '.web.js',
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
    ],
    dedupe: ['react', 'react-dom'],
  },
});
