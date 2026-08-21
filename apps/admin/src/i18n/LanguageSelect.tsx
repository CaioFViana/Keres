import { useTranslation } from 'react-i18next';
import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  storeLanguage,
  type SupportedLanguage,
} from './index';

/**
 * O seletor de idioma, usado pelo painel e pelo site.
 *
 * Um `<select>` puro: são dois idiomas, e um controle nativo já traz teclado, leitor de tela e
 * o comportamento do sistema em celular de graça.
 */
export function LanguageSelect({
  storageKey,
  className,
}: {
  storageKey: string;
  className?: string;
}) {
  const { i18n, t } = useTranslation();
  const current = (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.language)
    ? (i18n.language as SupportedLanguage)
    : 'en';

  return (
    <select
      className={className}
      value={current}
      aria-label={t('language.label')}
      onChange={(event) => {
        const language = event.target.value as SupportedLanguage;
        void i18n.changeLanguage(language);
        storeLanguage(storageKey, language);
      }}
    >
      {SUPPORTED_LANGUAGES.map((language) => (
        <option key={language} value={language}>
          {LANGUAGE_LABELS[language]}
        </option>
      ))}
    </select>
  );
}
