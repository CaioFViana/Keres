import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import siteEn from './locales/site.en.json';
import sitePt from './locales/site.pt.json';

export const SUPPORTED_LANGUAGES = ['en', 'pt'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const SITE_LANGUAGE_KEY = 'keres_site_language';

function isSupported(value: string | null | undefined): value is SupportedLanguage {
  return !!value && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * O idioma inicial: o que a pessoa escolheu antes; senão, o do navegador; senão, inglês.
 *
 * `navigator.language` vem como `pt-BR`/`en-US`, então só a primeira parte interessa.
 */
export function detectLanguage(storageKey: string): SupportedLanguage {
  const stored = typeof localStorage === 'undefined' ? null : localStorage.getItem(storageKey);
  if (isSupported(stored)) {
    return stored;
  }
  const fromBrowser =
    typeof navigator === 'undefined' ? undefined : navigator.language?.split('-')[0];
  return isSupported(fromBrowser) ? fromBrowser : 'en';
}

export function storeLanguage(storageKey: string, language: SupportedLanguage): void {
  localStorage.setItem(storageKey, language);
}

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  pt: 'Português',
};

let initialised = false;

export function initI18n(storageKey: string = SITE_LANGUAGE_KEY) {
  if (!initialised) {
    initialised = true;
    i18n.use(initReactI18next).init({
      resources: {
        en: { site: siteEn },
        pt: { site: sitePt },
      },
      lng: detectLanguage(storageKey),
      fallbackLng: 'en',
      ns: ['site'],
      defaultNS: 'site',
      interpolation: { escapeValue: false },
    });
  }
  return i18n;
}

export default i18n;
