// In order to add a new language, you need to:
// 1. Add the language to the localeNames object in this file
// 2. Run yarn lingui:extract on the command line, which creates the messages file in the i18n/<new-locale>/messages.po file
// 3. Import the messages file here
// 4. Add the language to the locales object in this file
// 5. Run yarn lingui:compile on the command line, which creates the messages.js file in the i18n/<new-locale>/messages.ts file
// 6. Commit the changes and push to the remote repository

import { i18n, Messages } from "@lingui/core";

// load language specific messages
import { messages as messagesEn } from "./en/messages";
import { messages as messagesEs } from "./es/messages";
import { messages as messagesFi } from "./fi/messages";
import { messages as messagesRu } from "./ru/messages";
import { messages as messagesZhCN } from "./zh-CN/messages";
import { messages as messagesZhTW } from "./zh-TW/messages";

export interface Languages {
  [key: string]: string;
}

export const localeNames: Languages = {
  en: "English",
  fi: "Suomi",
  es: "Español",
  ru: "Русский",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
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
  'zh-CN': messagesZhCN,
  'zh-TW': messagesZhTW,
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

