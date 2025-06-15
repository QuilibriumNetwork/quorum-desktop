import { i18n } from '@lingui/core'
import { en } from 'make-plural/plurals'
import catalogEn from './locales/en/messages.js'

i18n.load('en', catalogEn)
i18n.activate('en')

export { i18n }
