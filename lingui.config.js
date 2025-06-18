import { defineConfig } from "@lingui/cli";

import { localeNames, defaultLocale } from "./src/i18n/i18n";

export default defineConfig({
  fallbackLocales: {
    default: defaultLocale,
  },
  sourceLocale: defaultLocale,
  locales: Object.keys(localeNames),
  catalogs: [
    {
      path: "<rootDir>/src/i18n/{locale}/messages",
      include: ["src"],
      exclude: ["**/node_modules/*", "/dist", "/build", "/public", "/src/wasm", "/src/locales"]
    },
  ],
});