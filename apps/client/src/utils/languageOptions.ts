import { TFunction } from 'i18next';

export const getLanguageOptions = (t: TFunction) => [
  { label: t('language_english'), value: 'en' },
  { label: t('language_portuguese'), value: 'pt' },
];
