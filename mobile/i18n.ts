import { i18n } from '@lingui/core';
// Import English messages statically for mobile
import { messages as enMessages } from '../src/i18n/en/messages';

// Simple mobile i18n setup - just use English
export const initializeMobileI18n = () => {
  i18n.load('en', enMessages);
  i18n.activate('en');
};

export { i18n };
