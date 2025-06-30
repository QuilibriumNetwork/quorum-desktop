import { i18n } from "@lingui/core";
import locales, { defaultLocale } from "./locales";

export function getUserLocale() {
  const storedLocale = localStorage.getItem('language');
  if (storedLocale && locales[storedLocale]) {
    return storedLocale;
  }

  return navigator.language.split('-')[0] || defaultLocale;
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

  const messagesPath = process.cwd() + 'src/i18n/' + locale + '/messages.po';
  // dynamically compile the messages file
  const { messages } = await import(/* @vite-ignore */`${messagesPath}`);
  i18n.load(locale, messages);
  i18n.activate(locale);
}