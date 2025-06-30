// In order to add a new language, you need to:
// 1. Add the language to the localeNames object in this file
// 2. Run yarn lingui:extract on the command line, which creates the messages file in the i18n/<new-locale>/messages.po file
// 3. Translate the messages in the messages.po file
// 5. Run yarn lingui:compile on the command line, which creates the messages.ts file in the i18n/<new-locale>/messages.ts file
// 3. Import the messages file here
// 4. Add the language to the locales object in this file
// 6. Commit the changes and push to the remote repository

import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';

export { I18nProvider, i18n };

// Supported locales
export const localeNames: Record<string, string> = {
  ar: 'العربية',
  cs: 'Čeština',
  da: 'Dansk',
  de: 'Deutsch',
  el: 'Ελληνικά',
  en: 'English',
  'en-PI': 'English (Pirate)',
  es: 'Español',
  fi: 'Suomi',
  fr: 'Français',
  he: 'עברית',
  id: 'Bahasa Indonesia',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  nl: 'Nederlands',
  no: 'Norsk',
  pl: 'Polski',
  pt: 'Português',
  ro: 'Română',
  ru: 'Русский',
  sk: 'Slovenčina',
  sl: 'Slovenščina',
  sr: 'Српски',
  sv: 'Svenska',
  th: 'ไทย',
  tr: 'Türkçe',
  uk: 'Українська',
  vi: 'Tiếng Việt',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
};

export const defaultLocale = 'en';

// Load .mjs translation files dynamically
export async function loadCatalog(locale: string) {
  try {
    const { messages } = await import(`./${locale}/messages.mjs`);
    return messages;
  } catch (err) {
    console.warn(
      `Failed to load catalog for "${locale}", falling back to "${defaultLocale}".`,
      err
    );
    const { messages } = await import(`./${defaultLocale}/messages.mjs`);
    return messages;
  }
}

// Initialize Lingui with selected locale
export async function initI18n(locale = defaultLocale) {
  const messages = await loadCatalog(locale);
  i18n.load(locale, messages);
  i18n.activate(locale);
}

// Export alias for legacy usage
export const dynamicActivate = initI18n;