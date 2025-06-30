import { i18n } from "@lingui/core";
import locales, { defaultLocale } from "./locales";

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
  console.log(`Loading locale messages from path: ${messagesPath}`);
  // dynamically compile the messages file
  const { messages } = await import(`${messagesPath}`);
  i18n.load(locale, messages);
  i18n.activate(locale);
}