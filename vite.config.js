import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

import { nodePolyfills } from 'vite-plugin-node-polyfills';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { lingui } from '@lingui/vite-plugin';

// https://vite.dev/config/
export default defineConfig({
  build: {
    target: 'es2022', // Support top-level await or error on build for i18n
    rollupOptions: {
      external: (id) => {
        // Exclude dev folder from production builds
        if (process.env.NODE_ENV === 'production' && id.includes('/dev/')) {
          return true;
        }
        return false;
      },
    },
  },
  define: {
    // Define compile-time constants
  },
  plugins: [
    lingui(),
    nodePolyfills({
      target: 'esnext',
    }),
    react({
      babel: {
        plugins: ['@lingui/babel-plugin-lingui-macro'],
      },
    }),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/emoji-datasource-apple/img/apple/*',
          dest: 'apple',
        },
        {
          src: '../quilibrium-js-sdk-channels/src/wasm/channelwasm_bg.wasm',
          dest: './',
        },
      ],
    }),
  ],
  server: {
    headers: {
      'Permissions-Policy': 'publickey-credentials-get=*',
    },
  },
  resolve: {
    alias: {
      crypto: 'crypto-browserify',
 
      '@quilibrium/quilibrium-js-sdk-channels': resolve(
        __dirname,
        'node_modules/@quilibrium/quilibrium-js-sdk-channels/dist/index.js'
      ),
    },
  },
  optimizeDeps: {
    include: ['@quilibrium/quilibrium-js-sdk-channels'], // Force Vite to pre-bundle or app doesn't load (WSL)
  },
});
