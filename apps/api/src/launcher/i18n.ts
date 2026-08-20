import { en, pt, type LauncherLanguage, type LauncherMessageKey } from './locales';

const dictionaries = { en, pt } as const;

export function createTranslator(language: LauncherLanguage) {
  const dictionary = dictionaries[language];
  return (key: LauncherMessageKey, vars?: Record<string, string | number>): string => {
    let text: string = dictionary[key] ?? en[key];
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.replaceAll(`{{${name}}}`, String(value));
      }
    }
    return text;
  };
}

export type Translate = ReturnType<typeof createTranslator>;
