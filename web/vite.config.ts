import { defineConfig, Plugin } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { lingui } from '@lingui/vite-plugin';
import vitePluginFaviconsInject from 'vite-plugin-favicons-inject';
import { readFileSync, writeFileSync, existsSync } from 'fs';

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

/**
 * Plugin to inject favicons into 404.html after favicon plugin processes main HTML
 */
function injectFaviconsInto404(): Plugin {
  let faviconHtml = '';

  return {
    name: 'inject-favicons-into-404',
    enforce: 'post', // Run after other plugins
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // Extract favicon HTML from the processed main HTML
        // The favicon plugin injects HTML right after <!-- FAVICONS -->
        const faviconStart = html.indexOf('<!-- FAVICONS -->');
        if (faviconStart !== -1) {
          const afterComment = html.substring(faviconStart + '<!-- FAVICONS -->'.length);
          // Extract everything until the next HTML comment, script tag, or closing head tag
          const endMatch = afterComment.match(/^([\s\S]*?)(?=<!--|<\/head>|<\/script>)/i);
          if (endMatch) {
            faviconHtml = endMatch[1].trim();
          }
        }
        return html;
      },
    },
    closeBundle() {
      // After bundle is complete, inject favicons into 404.html
      if (!faviconHtml) return;

      const output404Path = resolve(__dirname, '..', 'dist/web/404.html');
      if (!existsSync(output404Path)) return;

      try {
        let content = readFileSync(output404Path, 'utf-8');
        if (content.includes('<!-- FAVICONS -->')) {
          content = content.replace('<!-- FAVICONS -->', `<!-- FAVICONS -->\n${faviconHtml}`);
          writeFileSync(output404Path, content, 'utf-8');
        }
      } catch (error) {
        console.warn('Failed to inject favicons into 404.html:', error);
      }
    },
  };
}

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
    vitePluginFaviconsInject('public/quorumicon-blue.svg', {
      appName: 'Quorum',
      appDescription: 'Quorum is a decentralized social media platform.',
    }),
    injectFaviconsInto404(),
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
    // Deduplicate React instances (critical for monorepo)
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['@quilibrium/quilibrium-js-sdk-channels'], // Force Vite to pre-bundle or app doesn't load (WSL)
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Tell SCSS to resolve @ alias (pointing to src/) - same as JS imports
        includePaths: [resolve(__dirname, '../src')],
      },
    },
  },
}));
