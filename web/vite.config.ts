import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { lingui } from '@lingui/vite-plugin';

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  root: resolve(__dirname, '..'), // Project root for dependency resolution
  publicDir: 'public', // Use shared public directory from project root
  base: '/', // Use absolute paths for SPA routing compatibility
  build: {
    target: 'es2022', // Support top-level await or error on build for i18n
    outDir: 'dist/web', // Output to dist/web folder from project root
    emptyOutDir: true,
    rollupOptions: {
      external: (id) => {
        // Exclude dev folder from production builds
        if (process.env.NODE_ENV === 'production' && id.includes('/dev/')) {
          return true;
        }
        // Always exclude React Native and .native files from web builds (dev + prod)
        if (id.includes('react-native') || 
            id.includes('.native.') || 
            id.includes('@react-native') ||
            id.endsWith('.native.tsx') ||
            id.endsWith('.native.ts') ||
            id.endsWith('.native.jsx') ||
            id.endsWith('.native.js') ||
            id.includes('/dev/playground/mobile/') ||
            id.includes('/mobile/') ||
            id.includes('react-native.d.ts')) {
          return true;
        }
        return false;
      },
      input: command === 'build' 
        ? resolve(__dirname, '..', 'index.html') // Build: use root index.html to avoid nesting
        : resolve(__dirname, 'index.html'), // Dev: use web/index.html
    },
  },
  define: {
    // Define compile-time constants
  },
  plugins: [
    lingui(),
    nodePolyfills({
      target: 'esnext',
    } as any),
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
        '../node_modules/@quilibrium/quilibrium-js-sdk-channels/dist/index.js'
      ),
    },
    // Platform-specific resolution - prioritize .web files, exclude .native
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js'],
    conditions: ['web', 'import', 'module', 'browser', 'default'],
    // Deduplicate React instances (critical for monorepo)
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['@quilibrium/quilibrium-js-sdk-channels'], // Force Vite to pre-bundle or app doesn't load (WSL)
    exclude: [
      'react-native',
      '@react-native-async-storage/async-storage'
    ], // Exclude React Native packages from web builds
    // Exclude patterns from dependency scanning
    entries: [
      'web/index.html',
      'src/**/*.web.{ts,tsx,js,jsx}',
      '!src/dev/playground/mobile/**',
      '!src/**/*.native.{ts,tsx,js,jsx}',
      '!mobile/**'
    ],
  },
}));