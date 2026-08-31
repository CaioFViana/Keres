import type { GrammaticalGender, StoryVocabularyEntityType } from '@keres/shared/entities/Story';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useStoryStore } from '../state/storyStore';

const DEFAULT_TERM_KEYS: Record<StoryVocabularyEntityType, { singular: string; plural: string }> = {
  Character: { singular: 'character', plural: 'characters' },
  Location: { singular: 'location', plural: 'locations' },
  Chapter: { singular: 'chapter', plural: 'chapters' },
  Scene: { singular: 'scene', plural: 'scenes' },
  Event: { singular: 'event', plural: 'events' },
};

function localeFamily(language: string | undefined): 'pt' | 'en' {
  return language?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

/** Resolves optional story terminology without changing any canonical entity model. */
export function useStoryVocabulary() {
  const { t, i18n } = useTranslation();
  const vocabulary = useStoryStore((state) => state.selectedStory?.vocabulary ?? null);
  // Focused navigation tests provide only `t`; production i18n always exists, but vocabulary must
  // remain a harmless default when a host intentionally supplies no language object.
  const language = localeFamily(i18n?.resolvedLanguage ?? i18n?.language ?? 'en');

  return useMemo(() => {
    const enabled = vocabulary?.language === language;
    return {
      language,
      isCustomVocabularyActive: enabled,
      term(type: StoryVocabularyEntityType, plural = false): string {
        const override = enabled ? vocabulary?.terms[type] : undefined;
        if (override) return plural ? override.plural : override.singular;
        return t(plural ? DEFAULT_TERM_KEYS[type].plural : DEFAULT_TERM_KEYS[type].singular);
      },
      gender(type: StoryVocabularyEntityType): GrammaticalGender {
        const override = enabled ? vocabulary?.terms[type] : undefined;
        return (
          override?.grammaticalGender ??
          (type === 'Scene' || type === 'Location' ? 'feminine' : 'masculine')
        );
      },
    };
  }, [language, t, vocabulary]);
}
