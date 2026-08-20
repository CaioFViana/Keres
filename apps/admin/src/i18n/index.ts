import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import adminEn from './locales/admin.en.json';
import adminPt from './locales/admin.pt.json';
import showcaseEn from './locales/showcase.en.json';
import showcasePt from './locales/showcase.pt.json';

/**
 * Tradução do painel e do site público.
 *
 * Mesma pilha do aplicativo (`i18next` + `react-i18next`, ver apps/client/src/utils/i18n.ts) em
 * vez de um mecanismo próprio: quem já mexeu nas traduções do app não precisa aprender um
 * segundo sistema, e plural e interpolação vêm prontos.
 *
 * Dois namespaces porque são dois apps que só dividem o repositório: o painel é interno e o
 * site é público, não têm texto em comum, e separar evita que uma tradução de um vaze no outro.
 */

export const SUPPORTED_LANGUAGES = ['en', 'pt'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Chaves distintas: painel e site são coisas separadas, como já acontece com o tema. */
export const ADMIN_LANGUAGE_KEY = 'keres_admin_language';
export const SHOWCASE_LANGUAGE_KEY = 'keres_showcase_language';

function isSupported(value: string | null | undefined): value is SupportedLanguage {
  return !!value && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * O idioma inicial: o que a pessoa escolheu antes; senão, o do navegador; senão, inglês.
 *
 * `navigator.language` vem como `pt-BR`/`en-US`, então só a primeira parte interessa - o app
 * não distingue variantes regionais.
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

/** Nome de cada idioma no próprio idioma - quem não lê a língua atual ainda se reconhece. */
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
