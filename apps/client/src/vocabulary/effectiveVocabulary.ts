import type { ArcMedium } from '@keres/shared/metadata/ArcMedium';
import { arcMediumTerms } from '@keres/shared/metadata/ArcMedium';
import type { StoryVocabulary } from '@keres/shared/entities/Story';

/** What the vocabulary needs to know about the Arc in effect. */
export interface ArcVocabularySource {
  medium: ArcMedium;
  vocabulary: StoryVocabulary | null;
}

/**
 * The terms in effect, most specific first: the Arc's own, then the Story's, then the medium's
 * defaults, then (by absence) the app's. A term the person chose is never replaced by a default.
 * Each layer speaks one language; a layer in another language than the UI's contributes nothing.
 *
 * Returns `null` when no layer brings a term, so a plain prose story resolves exactly as before.
 */
export function resolveEffectiveVocabulary(
  storyVocabulary: StoryVocabulary | null,
  arc: ArcVocabularySource | null,
  language: 'pt' | 'en',
): StoryVocabulary | null {
  const terms: StoryVocabulary['terms'] = {
    ...(arc ? arcMediumTerms(arc.medium, language) : {}),
    ...(storyVocabulary?.language === language ? storyVocabulary.terms : {}),
    ...(arc?.vocabulary?.language === language ? arc.vocabulary.terms : {}),
  };
  if (Object.keys(terms).length === 0) return null;
  return { version: 1, language, terms };
}
