import type { TFunction } from 'i18next';
import i18n from 'i18next';
import { Platform } from 'react-native';
import { initReactI18next } from 'react-i18next';

import en from '@/src/locales/en.json';
import pt from '@/src/locales/pt.json';
import { fireAndLog } from '@/src/utils/logging/fireAndLog';

// `i18next` exports `use` as a named binding too, but importing it directly trips
// react-hooks/rules-of-hooks (any `use*` identifier is treated as a hook call at module
// scope, which this genuinely isn't) - so we call it as `i18n.use(...)` instead.
fireAndLog(
  // eslint-disable-next-line import/no-named-as-default-member
  i18n.use(initReactI18next).init({
    resources: {
      en: {
        translation: en,
      },
      pt: {
        translation: pt,
      },
    },
    lng: 'en',
    fallbackLng: 'en',

    interpolation: {
      escapeValue: false, // react already guards against xss
    },
  }),
  'Starting the translations',
);

/**
 * Tells the browser which language the page is written in. Without it the page stays `en` while the interface is
 * Portuguese, and the browser (screen readers, hyphenation, spell-check) reads the wrong language. Web only: native
 * has no document, and what it reads is the OS's own setting.
 */
export function syncDocumentLanguage(language: string | undefined): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || !language) return;
  document.documentElement.lang = language;
}

// At start, then on every change: the language is set from the stored settings after this module has loaded.
syncDocumentLanguage(i18n.language);
i18n.on('languageChanged', syncDocumentLanguage);

export const getLanguageOptions = (t: TFunction) => [
  { label: t('language_english'), value: 'en' },
  { label: t('language_portuguese'), value: 'pt' },
];

export default i18n;
