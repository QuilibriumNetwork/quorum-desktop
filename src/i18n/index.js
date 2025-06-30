import { i18n } from '@lingui/core'

// loads the default locale to i18n
const messagesPath = process.cwd() + 'src/i18n/en/messages.po';
const { messages } = await import(/* @vite-ignore */`${messagesPath}`);
i18n.load('en', messages)
i18n.activate('en')

export { i18n }
