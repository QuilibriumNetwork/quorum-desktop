const { formatter } = require('@lingui/format-json')

/** @type {import('@lingui/cli').LinguiConfig} */
module.exports = {
  locales: ['en'],
  sourceLocale: 'en',
  format: formatter({ style: 'minimal' }),
  catalogs: [
    {
      path: 'src/i18n/locales/{locale}/messages',
      include: ['src'],
    },
  ],
}
