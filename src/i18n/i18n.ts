// All the existing translations (apart from English) have been created using an LLM,
// Communities are welcome to proofread and correct them.
// Proofreading completed for: English, Italian.

// To correct an exiisting language you need to:
// 1. Correct the file src/i18n/<locale>/messages.po
// 2. Run `yarn lingui:compile` on the command line, which updates the messages.js file in src/i18n/<locale>/messages.js
// 3. Commit the changes and push to the remote repository

// To add a new language, you need to:
// 1. Add the language to the locales.ts file in src/118/locales.ts
// 2. Run `yarn lingui:extract` on the command line, which creates the messages file in src/i18n/<new-locale>/messages.po
// 3. Translate the messages in the messages.po file
//    To translate via LLM, you can use https://github.com/lamat1111/po-files-translator
// 4. Run `yarn lingui:compile` on the command line, which creates the messages.js file in src/i18n/<new-locale>/messages.js
// 5. Commit the changes and push to the remote repository

import { i18n } from '@lingui/core';
import locales, { defaultLocale } from './locales';
import dayjs from '../utils/dayjs';

// Day.js locale loaders — dynamic import loads only the locale needed
const dayjsLocaleLoaders: Record<string, () => Promise<unknown>> = {
  ar: () => import('dayjs/locale/ar'),
  cs: () => import('dayjs/locale/cs'),
  da: () => import('dayjs/locale/da'),
  de: () => import('dayjs/locale/de'),
  el: () => import('dayjs/locale/el'),
  es: () => import('dayjs/locale/es'),
  fi: () => import('dayjs/locale/fi'),
  fr: () => import('dayjs/locale/fr'),
  he: () => import('dayjs/locale/he'),
  id: () => import('dayjs/locale/id'),
  it: () => import('dayjs/locale/it'),
  ja: () => import('dayjs/locale/ja'),
  ko: () => import('dayjs/locale/ko'),
  nb: () => import('dayjs/locale/nb'),
  nl: () => import('dayjs/locale/nl'),
  pl: () => import('dayjs/locale/pl'),
  pt: () => import('dayjs/locale/pt'),
  ro: () => import('dayjs/locale/ro'),
  ru: () => import('dayjs/locale/ru'),
  sk: () => import('dayjs/locale/sk'),
  sl: () => import('dayjs/locale/sl'),
  sr: () => import('dayjs/locale/sr'),
  sv: () => import('dayjs/locale/sv'),
  th: () => import('dayjs/locale/th'),
  tr: () => import('dayjs/locale/tr'),
  uk: () => import('dayjs/locale/uk'),
  vi: () => import('dayjs/locale/vi'),
  'zh-cn': () => import('dayjs/locale/zh-cn'),
  'zh-tw': () => import('dayjs/locale/zh-tw'),
};

/** Maps Lingui locale codes to Day.js locale codes */
function mapToDayjsLocale(linguiLocale: string): string {
  const map: Record<string, string> = {
    'en-PI': 'en',
    no: 'nb',
    'zh-CN': 'zh-cn',
    'zh-TW': 'zh-tw',
  };
  return map[linguiLocale] || linguiLocale.toLowerCase();
}

export function getUserLocale() {
  const storedLocale = localStorage.getItem('language');
  if (storedLocale && locales[storedLocale]) {
    return storedLocale;
  }

  // return navigator.language.split('-')[0] || defaultLocale;
  // changed: fallback to defaultLocale instead of browser language - keep until onboarding translations are proofread
  return defaultLocale;
}

export function saveUserLocale(locale: string) {
  localStorage.setItem('language', locale);
}

/**
 * We do a dynamic import of just the catalog that we need
 * @param locale any locale string
 */
export async function dynamicActivate(locale: string) {
  // if the locale is not supported, use the default locale
  if (!locales[locale]) {
    locale = defaultLocale;
  }

  // dynamically compile the messages file
  const { messages } = await import(`./${locale}/messages.ts`);
  i18n.load(locale, messages);
  i18n.activate(locale);

  // Sync Day.js locale for translated date/time strings
  const dayjsLocale = mapToDayjsLocale(locale);
  const loader = dayjsLocaleLoaders[dayjsLocale];
  if (loader) await loader();
  dayjs.locale(dayjsLocale);
}
