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
    exclude: ['node_modules', 'dist', 'src/dev/tests/harness/**'],
    server: {
      deps: {
        inline: [
          '@quilibrium/quilibrium-js-sdk-channels',
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
