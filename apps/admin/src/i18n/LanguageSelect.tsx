import { useTranslation } from 'react-i18next';
import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  storeLanguage,
  type SupportedLanguage,
} from './index';

/**
 * The language selector, used by the panel and by the site.
 *
 * A plain `<select>`: there are two languages, and a native control already brings keyboard,
 * screen reader and the system's behaviour on mobile for free.
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
