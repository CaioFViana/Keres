import type { SectionWords } from '@keres/shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * What an unlabelled section of a song is called, in the person's language. One object that changes
 * only with the language, so what is drawn from it is not drawn again for nothing.
 */
export function useSectionWords(): SectionWords {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      verse: t('song_section_verse'),
      chorus: t('song_section_chorus'),
      bridge: t('song_section_bridge'),
    }),
    [t],
  );
}
