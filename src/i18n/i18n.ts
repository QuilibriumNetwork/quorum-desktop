import { i18n, Messages } from "@lingui/core";

// load language specific messages
import { messages as messagesEn } from "./en/messages";
import { messages as messagesEs } from "./es/messages";
import { messages as messagesFi } from "./fi/messages";
import { messages as messagesRu } from "./ru/messages";

export interface Languages {
  [key: string]: string;
}

export const localeNames: Languages = {
  en: "English",
  fi: "Suomi",
  es: "Español",
  ru: "Русский",
};

export const defaultLocale = "en";

export type LocaleMessages = {
  [key: string]: Messages;
}

export const locales: LocaleMessages = {
  'en': messagesEn,
  'es': messagesEs,
  'fi': messagesFi,
  'ru': messagesRu,
};

/**
 * We do a dynamic import of just the catalog that we need
 * @param locale any locale string
 */
export async function dynamicActivate(locale: string) {
  // if the locale is not supported, use the default locale
  if (!localeNames[locale]) {
    locale = defaultLocale;
  }

  i18n.load(locale, locales[locale]);
  i18n.activate(locale);
}

