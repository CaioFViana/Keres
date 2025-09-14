import { getLanguage } from '@/utils/storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import pt from './pt.json';

const resources = {
  en: {
    translation: en,
  },
  pt: {
    translation: pt,
  },
};

export const i18nReadyPromise = (async () => {
  const storedLanguage = await getLanguage();
  const language = storedLanguage || Localization.getLocales()[0]?.languageCode || 'en';

  await i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: language,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
      compatibilityJSON: 'v3'
    });
})();

export default i18n;
