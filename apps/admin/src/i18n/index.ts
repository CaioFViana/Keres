import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import adminEn from './locales/admin.en.json';
import adminPt from './locales/admin.pt.json';
import showcaseEn from './locales/showcase.en.json';
import showcasePt from './locales/showcase.pt.json';

/**
 * Translation for the panel and the public site.
 *
 * The same stack as the application (`i18next` + `react-i18next`, see apps/client/src/utils/i18n.ts)
 * rather than a mechanism of its own: whoever has touched the app's translations does not have to
 * learn a second system, and plurals and interpolation come for free.
 *
 * Two namespaces because these are two apps that only share the repository: the panel is internal
 * and the site is public, they have no text in common, and separating them keeps a translation for
 * one from leaking into the other.
 */

export const SUPPORTED_LANGUAGES = ['en', 'pt'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Distinct keys: panel and site are separate things, as is already the case for the theme. */
export const ADMIN_LANGUAGE_KEY = 'keres_admin_language';
export const SHOWCASE_LANGUAGE_KEY = 'keres_showcase_language';

function isSupported(value: string | null | undefined): value is SupportedLanguage {
  return !!value && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * The initial language: whatever the person chose before; failing that, the browser's; failing
 * that, English.
 *
 * `navigator.language` arrives as `pt-BR`/`en-US`, so only the first part matters - the app does
 * not distinguish regional variants.
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

/** Each language's name in its own language - someone who cannot read the current one still */
export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  pt: 'Português',
};

let initialised = false;

export function initI18n(storageKey: string, defaultNamespace: 'admin' | 'showcase') {
  if (!initialised) {
    initialised = true;
    i18n.use(initReactI18next).init({
      resources: {
        en: { admin: adminEn, showcase: showcaseEn },
        pt: { admin: adminPt, showcase: showcasePt },
      },
      lng: detectLanguage(storageKey),
      fallbackLng: 'en',
      ns: ['admin', 'showcase'],
      defaultNS: defaultNamespace,
      interpolation: { escapeValue: false },
    });
  }
  return i18n;
}

export default i18n;
