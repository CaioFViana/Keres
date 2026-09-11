import {
  STORY_VOCABULARY_ENTITY_TYPES,
  type GrammaticalGender,
  type StoryVocabulary,
  type StoryVocabularyEntityType,
} from '@keres/shared/entities/Story';
import type { TFunction } from 'i18next';

const DEFAULT_TERM_KEYS: Record<StoryVocabularyEntityType, { singular: string; plural: string }> = {
  Character: { singular: 'character', plural: 'characters' },
  Location: { singular: 'location', plural: 'locations' },
  Chapter: { singular: 'chapter', plural: 'chapters' },
  Scene: { singular: 'scene', plural: 'scenes' },
  Event: { singular: 'event', plural: 'events' },
  Item: { singular: 'item', plural: 'items' },
  WorldRule: { singular: 'world_piece', plural: 'world_pieces' },
  Choice: { singular: 'choice', plural: 'choices' },
  Arc: { singular: 'arc', plural: 'arcs' },
};

export function localeFamily(language: string | undefined): 'pt' | 'en' {
  return language?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

export function isStoryVocabularyEntityType(type: string): type is StoryVocabularyEntityType {
  return (STORY_VOCABULARY_ENTITY_TYPES as readonly string[]).includes(type);
}

export function defaultGrammaticalGender(type: StoryVocabularyEntityType): GrammaticalGender {
  return type === 'Scene' || type === 'Location' || type === 'WorldRule' || type === 'Choice'
    ? 'feminine'
    : 'masculine';
}

function vocabularyApplies(vocabulary: StoryVocabulary | null, language: 'pt' | 'en'): boolean {
  return vocabulary?.language === language;
}

/** Whether this particular noun has a usable override in the UI's language. */
export function hasStoryTermOverride(
  vocabulary: StoryVocabulary | null,
  language: 'pt' | 'en',
  type: StoryVocabularyEntityType,
): boolean {
  return vocabularyApplies(vocabulary, language) && Boolean(vocabulary?.terms[type]);
}

/** Resolves one core noun for the current UI language, falling back to Keres' standard term. */
export function resolveStoryTerm(
  vocabulary: StoryVocabulary | null,
  language: 'pt' | 'en',
  t: TFunction,
  type: StoryVocabularyEntityType,
  plural = false,
): string {
  const override = vocabularyApplies(vocabulary, language) ? vocabulary?.terms[type] : undefined;
  if (override) return plural ? override.plural : override.singular;
  return t(plural ? DEFAULT_TERM_KEYS[type].plural : DEFAULT_TERM_KEYS[type].singular);
}

export function resolveStoryGender(
  vocabulary: StoryVocabulary | null,
  language: 'pt' | 'en',
  type: StoryVocabularyEntityType,
): GrammaticalGender {
  const override = vocabularyApplies(vocabulary, language) ? vocabulary?.terms[type] : undefined;
  return override?.grammaticalGender ?? defaultGrammaticalGender(type);
}

/** Portuguese participle/article endings; English copy typically ignores the result. */
export function agreeStoryTerm(
  language: 'pt' | 'en',
  gender: GrammaticalGender,
  forms: { masculine: string; feminine: string; neutral?: string },
): string {
  if (language !== 'pt') return forms.neutral ?? forms.masculine;
  if (gender === 'feminine') return forms.feminine;
  if (gender === 'neutral') return forms.neutral ?? forms.masculine;
  return forms.masculine;
}
