import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getLanguageOptions } from '../utils/i18n';

/** Resolves a language code to its localized label (no per-code i18n keys needed). */
export function useLanguageLabel() {
  const { t } = useTranslation();
  const labelByCode = useMemo(
    () => new Map(getLanguageOptions(t).map((option) => [option.value, option.label])),
    [t],
  );
  return useCallback((code: string) => labelByCode.get(code) ?? code, [labelByCode]);
}
