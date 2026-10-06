import type { StoryVocabularyEntityType, StoryVocabularyTerm } from '../entities/Story';

/**
 * What an Arc is: the form of the work it holds. An output profile, never a rule about the data -
 * it picks the default terms, the compilation template, the page preset and a few shortcuts, and
 * every entity stays available whatever it says. Changing it migrates nothing.
 */
export const ARC_MEDIUMS = ['generic', 'screenplay', 'comic', 'storyboard', 'campaign'] as const;

export type ArcMedium = (typeof ARC_MEDIUMS)[number];

export const DEFAULT_ARC_MEDIUM: ArcMedium = 'generic';

export function isArcMedium(value: unknown): value is ArcMedium {
  return typeof value === 'string' && (ARC_MEDIUMS as readonly string[]).includes(value);
}

export type ArcMediumLanguage = 'pt' | 'en';

type TermTable = Partial<Record<StoryVocabularyEntityType, StoryVocabularyTerm>>;

const term = (
  singular: string,
  plural: string,
  grammaticalGender: StoryVocabularyTerm['grammaticalGender'],
): StoryVocabularyTerm => ({ singular, plural, grammaticalGender });

/**
 * The friendlier default nouns each medium brings. They sit *below* anything the person chose:
 * the Arc's own vocabulary beats the Story's, which beats these, which beat the app's.
 * `generic` brings none, so a prose story reads exactly as it always has.
 */
export const ARC_MEDIUM_TERMS: Record<ArcMedium, Record<ArcMediumLanguage, TermTable>> = {
  generic: { en: {}, pt: {} },
  screenplay: {
    en: { Arc: term('Script', 'Scripts', 'masculine'), Chapter: term('Act', 'Acts', 'masculine') },
    pt: {
      Arc: term('Roteiro', 'Roteiros', 'masculine'),
      Chapter: term('Ato', 'Atos', 'masculine'),
    },
  },
  comic: {
    en: { Arc: term('Issue', 'Issues', 'masculine') },
    pt: { Arc: term('Edição', 'Edições', 'feminine') },
  },
  storyboard: {
    en: {
      Arc: term('Storyboard', 'Storyboards', 'masculine'),
      Chapter: term('Sequence', 'Sequences', 'feminine'),
    },
    pt: {
      Arc: term('Storyboard', 'Storyboards', 'masculine'),
      Chapter: term('Sequência', 'Sequências', 'feminine'),
    },
  },
  campaign: {
    en: {
      Arc: term('Module', 'Modules', 'masculine'),
      Chapter: term('Session', 'Sessions', 'feminine'),
    },
    pt: {
      Arc: term('Módulo', 'Módulos', 'masculine'),
      Chapter: term('Sessão', 'Sessões', 'feminine'),
    },
  },
};

export function arcMediumTerms(medium: ArcMedium, language: ArcMediumLanguage): TermTable {
  return ARC_MEDIUM_TERMS[medium][language];
}
