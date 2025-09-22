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
        return false;
      },
      input:
        command === 'build'
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
    allowedHosts: [
      '.serveo.net',
      '.loca.lt',
      '.localhost.run',
      '.pinggy.io',
      '.ngrok-free.app',
      '.quilibrium.one',
    ],
    headers: {
      'Permissions-Policy': 'publickey-credentials-get=*',
    },
    fs: {
      // Allow serving .readme folder in development (entire dev folder already excluded from prod)
      allow: ['..', '.readme'],
    },
    proxy: {
      '/api': {
        target: 'https://api.quorummessenger.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/ws': {
        target: 'wss://api.quorummessenger.com',
        ws: true,
        changeOrigin: true,
        secure: true
      }
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
      crypto: 'crypto-browserify',
      '@quilibrium/quilibrium-js-sdk-channels': resolve(
        __dirname,
        '../node_modules/@quilibrium/quilibrium-js-sdk-channels/dist/index.js'
      ),
    },
    // Platform-specific resolution - prioritize .web files over .native files
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
    // Deduplicate React instances (critical for monorepo)
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['@quilibrium/quilibrium-js-sdk-channels'], // Force Vite to pre-bundle or app doesn't load (WSL)
  },
}));
