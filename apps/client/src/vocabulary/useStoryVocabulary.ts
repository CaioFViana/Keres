import type { GrammaticalGender, StoryVocabularyEntityType } from '@keres/shared/entities/Story';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useStoryStore } from '../state/storyStore';
import {
  agreeStoryTerm,
  isStoryVocabularyEntityType,
  localeFamily,
  resolveStoryGender,
  resolveStoryTerm,
} from './resolveStoryTerm';

/** Resolves optional story terminology without changing any canonical entity model. */
export function useStoryVocabulary() {
  const { t, i18n } = useTranslation();
  const vocabulary = useStoryStore((state) => state.selectedStory?.vocabulary ?? null);
  // Focused navigation tests provide only `t`; production i18n always exists, but vocabulary must
  // remain a harmless default when a host intentionally supplies no language object.
  const language = localeFamily(i18n?.resolvedLanguage ?? i18n?.language ?? 'en');

  return useMemo(() => {
    return {
      language,
      isCustomVocabularyActive: vocabulary?.language === language,
      term(type: StoryVocabularyEntityType, plural = false): string {
        return resolveStoryTerm(vocabulary, language, t, type, plural);
      },
      gender(type: StoryVocabularyEntityType): GrammaticalGender {
        return resolveStoryGender(vocabulary, language, type);
      },
      /** Gives surrounding Portuguese copy the ending that agrees with the configured noun. */
      agree(
        type: StoryVocabularyEntityType,
        forms: { masculine: string; feminine: string; neutral?: string },
      ): string {
        return agreeStoryTerm(language, resolveStoryGender(vocabulary, language, type), forms);
      },
      /**
       * Labels a mixed entity-type string. Vocabulary types use the story's terms; everything
       * else keeps the existing lowercase translation key (`character` → still `term('Character')`).
       */
      label(type: string, plural = false): string {
        if (isStoryVocabularyEntityType(type)) {
          return resolveStoryTerm(vocabulary, language, t, type, plural);
        }
        if (type === 'ItemJourney') {
          const item = resolveStoryTerm(vocabulary, language, t, 'Item', plural);
          return t(plural ? 'vocabulary_item_journeys' : 'vocabulary_item_journey', {
            [plural ? 'items' : 'item']: item,
          });
        }
        return t(plural ? `${type.toLowerCase()}s` : type.toLowerCase());
      },
    };
  }, [language, t, vocabulary]);
}
