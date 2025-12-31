import { logger } from '@quilibrium/quorum-shared';
import { useState, useEffect, useCallback } from 'react';
import {
  dynamicActivate,
  getUserLocale,
  saveUserLocale,
} from '../../../i18n/i18n';
import locales from '../../../i18n/locales';
import useForceUpdate from '../../utils/forceUpdate';

export interface UseLocaleSettingsReturn {
  language: string;
  setLanguage: (lang: string) => void;
  languageChanged: boolean;
  localeOptions: Array<{ value: string; label: string }>;
  forceUpdate: () => void;
}

export const useLocaleSettings = (): UseLocaleSettingsReturn => {
  const [language, setLanguage] = useState(getUserLocale());
  const [languageChanged, setLanguageChanged] = useState(false);
  const forceUpdate = useForceUpdate();

  const stableForceUpdate = useCallback(() => {
    forceUpdate();
  }, [forceUpdate]);

  useEffect(() => {
    logger.log('Language changed to:', language);
    dynamicActivate(language);
    setLanguageChanged(true);
    saveUserLocale(language);
    // Don't call forceUpdate here - it causes infinite re-renders
    // forceUpdate should only be called by user action (refresh button)
  }, [language]);

  const localeOptions = Object.entries(locales).map(([code, label]) => ({
    value: code,
    label: label,
  }));

  return {
    language,
    setLanguage,
    languageChanged,
    localeOptions,
    forceUpdate: stableForceUpdate,
  };
};
