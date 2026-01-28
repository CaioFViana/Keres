import i18n, { TFunction } from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import en from '../locales/en.json';
import pt from '../locales/pt.json';

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources: {
      en: {
        translation: en,
      },
      pt: {
        translation: pt,
      },
    },
    lng: 'en', // default language
    fallbackLng: 'en',

    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });


export const getLanguageOptions = (t: TFunction) => [
  { label: t('language_english'), value: 'en' },
  { label: t('language_portuguese'), value: 'pt' },
];

export default i18n;
