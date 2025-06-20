// In order to add a new language, you need to:
// 1. Add the language to the localeNames object in this file
// 2. Run yarn lingui:extract on the command line, which creates the messages file in the i18n/<new-locale>/messages.po file
// 3. Translate the messages in the messages.po file
// 5. Run yarn lingui:compile on the command line, which creates the messages.ts file in the i18n/<new-locale>/messages.ts file
// 3. Import the messages file here
// 4. Add the language to the locales object in this file
// 6. Commit the changes and push to the remote repository

import { i18n, Messages } from "@lingui/core";

// load language specific messages
import { messages as messagesEn } from "./en/messages";
import { messages as messagesEnPI } from "./en-PI/messages";
import { messages as messagesEs } from "./es/messages";
import { messages as messagesFi } from "./fi/messages";
import { messages as messagesRu } from "./ru/messages";
import { messages as messagesZhCN } from "./zh-CN/messages";
import { messages as messagesZhTW } from "./zh-TW/messages";
import { messages as messagesAr } from "./ar/messages";
import { messages as messagesTr } from "./tr/messages";
import { messages as messagesUk } from "./uk/messages";
import { messages as messagesVi } from "./vi/messages";
import { messages as messagesSv } from "./sv/messages";
import { messages as messagesSr } from "./sr/messages";
import { messages as messagesHe } from "./he/messages";
import { messages as messagesEl } from "./el/messages";
import { messages as messagesJa } from "./ja/messages";
import { messages as messagesKo } from "./ko/messages";
import { messages as messagesIt } from "./it/messages";
import { messages as messagesPl } from "./pl/messages";
import { messages as messagesPt } from "./pt/messages";
import { messages as messagesRo } from "./ro/messages";
import { messages as messagesSk } from "./sk/messages";
import { messages as messagesSl } from "./sl/messages";
import { messages as messagesTh } from "./th/messages";
import { messages as messagesFr } from "./fr/messages";
import { messages as messagesDe } from "./de/messages";
import { messages as messagesNl } from "./nl/messages";
import { messages as messagesNo } from "./no/messages";
import { messages as messagesDa } from "./da/messages";
import { messages as messagesCs } from "./cs/messages";
import { messages as messagesId } from "./id/messages";

export interface Languages {
  [key: string]: string;
}

export const localeNames: Languages = {
  en: "English",
  'en-PI': "English (Pirate)",
  fi: "Suomi",
  es: "Español",
  ru: "Русский",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  ar: "العربية",
  tr: "Türkçe",
  uk: "Українська",
  vi: "Tiếng Việt",
  sv: "Svenska",
  sr: "Српски",
  he: "עברית",
  el: "Ελληνικά",
  ja: "日本語",
  ko: "한국어",
  it: "Italiano",
  pl: "Polski",
  pt: "Português",
  ro: "Română",
  sk: "Slovenčina",
  sl: "Slovenščina",
  th: "ไทย",
  fr: "Français",
  de: "Deutsch",
  nl: "Nederlands",
  no: "Norsk",
  da: "Dansk",
  cs: "Čeština",
  id: "Bahasa Indonesia",
};

export const defaultLocale = "en";

export type LocaleMessages = {
  [key: string]: Messages;
}

export const locales: LocaleMessages = {
  'en': messagesEn,
  'en-PI': messagesEnPI,
  'es': messagesEs,
  'fi': messagesFi,
  'ru': messagesRu,
  'zh-CN': messagesZhCN,
  'zh-TW': messagesZhTW,
  'ar': messagesAr,
  'tr': messagesTr,
  'uk': messagesUk,
  'vi': messagesVi,
  'sv': messagesSv,
  'sr': messagesSr,
  'he': messagesHe,
  'el': messagesEl,
  'ja': messagesJa,
  'ko': messagesKo,
  'it': messagesIt,
  'pl': messagesPl,
  'pt': messagesPt,
  'ro': messagesRo,
  'sk': messagesSk,
  'sl': messagesSl,
  'th': messagesTh,
  'fr': messagesFr,
  'de': messagesDe,
  'nl': messagesNl,
  'no': messagesNo,
  'da': messagesDa,
  'cs': messagesCs,
  'id': messagesId,
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

