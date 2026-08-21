import type { LauncherLanguage } from './locales';

function languageFromTag(value: string | undefined): LauncherLanguage | undefined {
  if (!value) {
    return undefined;
  }
  const base = value.trim().replace('_', '-').split('-')[0]?.toLowerCase();
  if (base === 'pt') {
    return 'pt';
  }
  if (base === 'en') {
    return 'en';
  }
  return undefined;
}

/**
 * Sistema → pt ou en; qualquer outra coisa (ou vazio) → inglês, como o painel admin.
 */
export function detectSystemLanguage(
  env: NodeJS.ProcessEnv = process.env,
  locale: string = Intl.DateTimeFormat().resolvedOptions().locale,
): LauncherLanguage {
  const candidates = [env.KERES_LANG, env.LC_ALL, env.LANG, env.LANGUAGE, locale];
  for (const candidate of candidates) {
    const detected = languageFromTag(candidate);
    if (detected) {
      return detected;
    }
  }
  return 'en';
}
