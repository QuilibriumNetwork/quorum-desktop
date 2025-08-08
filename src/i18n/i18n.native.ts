// React Native version - uses static imports instead of dynamic imports
// All the existing translations (apart from English) have been created using an LLM,
// Communities are welcome to proofread and correct them.
// Proofreading completed for: English, Italian.

import { i18n } from '@lingui/core';
import locales, { defaultLocale } from './locales';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Static imports for React Native compatibility
import { messages as enMessages } from './en/messages';
import { messages as arMessages } from './ar/messages';
import { messages as csMessages } from './cs/messages';
import { messages as daMessages } from './da/messages';
import { messages as deMessages } from './de/messages';
import { messages as elMessages } from './el/messages';
import { messages as enPIMessages } from './en-PI/messages';
import { messages as esMessages } from './es/messages';
import { messages as fiMessages } from './fi/messages';
import { messages as frMessages } from './fr/messages';
import { messages as heMessages } from './he/messages';
import { messages as idMessages } from './id/messages';
import { messages as itMessages } from './it/messages';
import { messages as jaMessages } from './ja/messages';
import { messages as koMessages } from './ko/messages';
import { messages as nlMessages } from './nl/messages';
import { messages as noMessages } from './no/messages';
import { messages as plMessages } from './pl/messages';
import { messages as ptMessages } from './pt/messages';
import { messages as roMessages } from './ro/messages';
import { messages as ruMessages } from './ru/messages';
import { messages as skMessages } from './sk/messages';
import { messages as slMessages } from './sl/messages';
import { messages as srMessages } from './sr/messages';
import { messages as svMessages } from './sv/messages';
import { messages as thMessages } from './th/messages';
import { messages as trMessages } from './tr/messages';
import { messages as ukMessages } from './uk/messages';
import { messages as viMessages } from './vi/messages';
import { messages as zhCNMessages } from './zh-CN/messages';
import { messages as zhTWMessages } from './zh-TW/messages';

// Static message map for React Native
const messageMap: Record<string, any> = {
  ar: arMessages,
  cs: csMessages,
  da: daMessages,
  de: deMessages,
  el: elMessages,
  en: enMessages,
  'en-PI': enPIMessages,
  es: esMessages,
  fi: fiMessages,
  fr: frMessages,
  he: heMessages,
  id: idMessages,
  it: itMessages,
  ja: jaMessages,
  ko: koMessages,
  nl: nlMessages,
  no: noMessages,
  pl: plMessages,
  pt: ptMessages,
  ro: roMessages,
  ru: ruMessages,
  sk: skMessages,
  sl: slMessages,
  sr: srMessages,
  sv: svMessages,
  th: thMessages,
  tr: trMessages,
  uk: ukMessages,
  vi: viMessages,
  'zh-CN': zhCNMessages,
  'zh-TW': zhTWMessages,
};

// Synchronous version for compatibility with web API
export function getUserLocale() {
  // For React Native, we'll need to handle async loading differently
  // Return default locale synchronously, actual loading happens in dynamicActivate
  return defaultLocale;
}

export function saveUserLocale(locale: string) {
  // Fire and forget for API compatibility
  AsyncStorage.setItem('language', locale).catch(error => {
    console.warn('Failed to save locale:', error);
  });
}

// Async versions for proper mobile usage
export async function getMobileUserLocale() {
  try {
    const storedLocale = await AsyncStorage.getItem('language');
    if (storedLocale && locales[storedLocale]) {
      return storedLocale;
    }
  } catch (error) {
    console.warn('Failed to get stored locale:', error);
  }

  // TODO: Use react-native-localize for device locale detection
  return defaultLocale;
}

export async function saveMobileUserLocale(locale: string) {
  try {
    await AsyncStorage.setItem('language', locale);
  } catch (error) {
    console.warn('Failed to save locale:', error);
  }
}

/**
 * React Native version using static imports
 * @param locale any locale string
 */
export async function dynamicActivate(locale: string) {
  // if the locale is not supported, use the default locale
  if (!locales[locale] || !messageMap[locale]) {
    locale = defaultLocale;
  }

  // Get messages from static import map
  const messages = messageMap[locale];
  i18n.load(locale, messages);
  i18n.activate(locale);
}