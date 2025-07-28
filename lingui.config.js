import { defineConfig } from '@lingui/cli';
import locales, { defaultLocale } from './src/i18n/locales.ts';

export default defineConfig({
  fallbackLocales: {
    default: defaultLocale,
  },
  sourceLocale: defaultLocale,
  locales: Object.keys(locales),
  format: 'po',
  compileNamespace: 'ts',
  catalogs: [
    {
      path: '<rootDir>/src/i18n/{locale}/messages',
      include: ['src'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/public/**',
        '**/src/wasm/**',
        '**/src/locales/**',
        '**/src/playground/**',
        '**/*.flow.js',
      ],
    },
  ],
});
