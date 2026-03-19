import { defineConfig, Plugin, UserConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { lingui } from '@lingui/vite-plugin';

/**
 * Plugin to resolve vite-plugin-node-polyfills shims for linked packages outside node_modules.
 * The nodePolyfills plugin injects bare specifiers like 'vite-plugin-node-polyfills/shims/global'
 * which Rollup can't resolve when the importer is outside the project's node_modules tree.
 */
function resolvePolyfillShims(): Plugin {
  const shimMap: Record<string, string> = {
    'vite-plugin-node-polyfills/shims/buffer': resolve(
      __dirname,
      '../node_modules/vite-plugin-node-polyfills/shims/buffer/dist/index.js'
    ),
    'vite-plugin-node-polyfills/shims/global': resolve(
      __dirname,
      '../node_modules/vite-plugin-node-polyfills/shims/global/dist/index.js'
    ),
    'vite-plugin-node-polyfills/shims/process': resolve(
      __dirname,
      '../node_modules/vite-plugin-node-polyfills/shims/process/dist/index.js'
    ),
  };

  return {
    name: 'resolve-polyfill-shims',
    enforce: 'pre',
    resolveId(id) {
      if (id in shimMap) {
        return shimMap[id];
      }
      return null;
    },
  };
}


// https://vite.dev/config/
export default defineConfig(({ command }): UserConfig => ({
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
        // Only match src/dev/ or relative imports containing /dev/, not absolute system paths
        if (process.env.NODE_ENV === 'production') {
          if (id.includes('/src/dev/') || (id.startsWith('.') && id.includes('/dev/'))) {
            return true;
          }
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
    resolvePolyfillShims(),
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
          src: 'node_modules/emoji-datasource-twitter/img/twitter/*',
          dest: 'twitter',
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
      // Allow serving .agents folder in development (entire dev folder already excluded from prod)
      allow: ['..', '.agents'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
      crypto: 'crypto-browserify',
      // Force single React instance — excluded packages (quorum-shared) resolve
      // bare 'react' imports outside Vite's pre-bundle graph, so aliases ensure
      // they hit the same instance as the rest of the app
      react: resolve(__dirname, '../node_modules/react'),
      'react-dom': resolve(__dirname, '../node_modules/react-dom'),
      'react/jsx-runtime': resolve(__dirname, '../node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': resolve(__dirname, '../node_modules/react/jsx-dev-runtime'),
      '@quilibrium/quilibrium-js-sdk-channels': resolve(
        __dirname,
        '../node_modules/@quilibrium/quilibrium-js-sdk-channels/dist/index.esm.js'
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
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['@quilibrium/quilibrium-js-sdk-channels'], // Force Vite to pre-bundle or app doesn't load (WSL)
    exclude: ['@quilibrium/quorum-shared'], // Don't pre-bundle — source files need .web.tsx resolution
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Tell SCSS to resolve @ alias (pointing to src/) - same as JS imports
        includePaths: [resolve(__dirname, '../src')],
      } as any,
    },
  },
}));
