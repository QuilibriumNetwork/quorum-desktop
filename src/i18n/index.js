import { i18n } from '@lingui/core';

// loads the default locale to i18n
const { messages } = await import('./en/messages.ts');
i18n.load('en', messages);
i18n.activate('en');

export { i18n };
