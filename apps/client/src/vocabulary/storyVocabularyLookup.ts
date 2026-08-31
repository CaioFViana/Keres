import type { StoryVocabulary, StoryVocabularyEntityType } from '@keres/shared/entities/Story';
import { and, eq } from 'drizzle-orm';
import i18n, { type TFunction } from 'i18next';
import type { AppDrizzleClient } from '../db';
import { stories } from '../db/schemas';
import {
  agreeStoryTerm,
  hasStoryTermOverride,
  localeFamily,
  resolveStoryGender,
  resolveStoryTerm,
} from './resolveStoryTerm';

export async function loadStoryVocabulary(
  db: AppDrizzleClient,
  storyId: string,
): Promise<StoryVocabulary | null> {
  const story = await db.query.stories.findFirst({
    where: and(eq(stories.id, storyId), eq(stories.isDeleted, false)),
    columns: { vocabulary: true },
  });
  return story?.vocabulary ?? null;
}

export function translateStoryNoun(
  t: TFunction,
  vocabulary: StoryVocabulary | null,
  type: StoryVocabularyEntityType,
  plural = false,
): string {
  return resolveStoryTerm(vocabulary, localeFamily(i18n.language), t, type, plural);
}

function participleEnding(
  vocabulary: StoryVocabulary | null,
  type: StoryVocabularyEntityType,
): string {
  const language = localeFamily(i18n.language);
  return agreeStoryTerm(language, resolveStoryGender(vocabulary, language, type), {
    masculine: 'o',
    feminine: 'a',
    neutral: 'o(a)',
  });
}

export function unknownStoryNoun(
  t: TFunction,
  vocabulary: StoryVocabulary | null,
  type: StoryVocabularyEntityType,
): string {
  const language = localeFamily(i18n.language);
  if (!hasStoryTermOverride(vocabulary, language, type)) {
    return t(`unknown_${type.toLowerCase()}`);
  }
  return t('vocabulary_unknown_entity', {
    entity: translateStoryNoun(t, vocabulary, type),
    ending: participleEnding(vocabulary, type),
  });
}

export function fromStoryNoun(
  t: TFunction,
  vocabulary: StoryVocabulary | null,
  type: StoryVocabularyEntityType,
): string {
  const language = localeFamily(i18n.language);
  if (type === 'Scene' && !hasStoryTermOverride(vocabulary, language, type)) {
    return t('from_scene');
  }
  return t('vocabulary_from_entity', { entity: translateStoryNoun(t, vocabulary, type) });
}
