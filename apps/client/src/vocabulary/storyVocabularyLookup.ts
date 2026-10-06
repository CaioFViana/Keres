import type { StoryVocabulary, StoryVocabularyEntityType } from '@keres/shared/entities/Story';
import { and, eq } from 'drizzle-orm';
import i18n, { type TFunction } from 'i18next';
import type { AppDrizzleClient } from '../db';
import { stories, storyArcs } from '../db/schemas';
import { resolveEffectiveVocabulary } from './effectiveVocabulary';
import {
  agreeStoryTerm,
  hasStoryTermOverride,
  localeFamily,
  resolveStoryGender,
  resolveStoryTerm,
} from './resolveStoryTerm';

/**
 * Vocabulary resolution for non-component callers (entity solvers, services) that already
 * hold `t` and the database handle: `useStoryVocabulary`/`useVocabularyEntityCopy` cover
 * screens and components.
 */
/**
 * The terms in effect for a story outside any screen: with exactly one Arc that Arc's medium and
 * vocabulary apply, as in the every-Arc view of a one-work story; with several there is no single
 * work to speak for, so only the story's own terms do.
 */
export async function loadStoryVocabulary(
  db: AppDrizzleClient,
  storyId: string,
): Promise<StoryVocabulary | null> {
  const story = await db.query.stories.findFirst({
    where: and(eq(stories.id, storyId), eq(stories.isDeleted, false)),
    columns: { vocabulary: true },
  });
  const arcs = await db.query.storyArcs.findMany({
    where: and(eq(storyArcs.storyId, storyId), eq(storyArcs.isDeleted, false)),
    columns: { medium: true, vocabulary: true },
    limit: 2,
  });
  return resolveEffectiveVocabulary(
    story?.vocabulary ?? null,
    arcs.length === 1 ? arcs[0] : null,
    localeFamily(i18n.language),
  );
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
