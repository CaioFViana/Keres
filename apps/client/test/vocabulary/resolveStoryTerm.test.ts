/**
 * @jest-environment node
 */
import type { StoryVocabulary } from '@keres/shared/entities/Story';
import type { TFunction } from 'i18next';
import {
  agreeStoryTerm,
  hasStoryTermOverride,
  resolveStoryGender,
  resolveStoryTerm,
} from '../../src/vocabulary/resolveStoryTerm';

const t = ((key: string) => key) as unknown as TFunction;

const comicPt: StoryVocabulary = {
  version: 1,
  language: 'pt',
  terms: {
    Character: { singular: 'Heroína', plural: 'Heroínas', grammaticalGender: 'feminine' },
    Scene: { singular: 'Página', plural: 'Páginas', grammaticalGender: 'feminine' },
    Location: { singular: 'Cenário', plural: 'Cenários', grammaticalGender: 'masculine' },
    Item: { singular: 'Artefato', plural: 'Artefatos', grammaticalGender: 'masculine' },
    WorldRule: { singular: 'Lei arcana', plural: 'Leis arcanas', grammaticalGender: 'feminine' },
    Choice: { singular: 'Decisão', plural: 'Decisões', grammaticalGender: 'feminine' },
  },
};

describe('resolveStoryTerm', () => {
  it('uses the story override only when the vocabulary language matches the UI', () => {
    expect(resolveStoryTerm(comicPt, 'pt', t, 'Character')).toBe('Heroína');
    expect(resolveStoryTerm(comicPt, 'pt', t, 'Character', true)).toBe('Heroínas');
    expect(resolveStoryTerm(comicPt, 'en', t, 'Character')).toBe('character');
  });

  it.each([
    ['Item', 'Artefato', 'Artefatos'],
    ['WorldRule', 'Lei arcana', 'Leis arcanas'],
    ['Choice', 'Decisão', 'Decisões'],
  ] as const)('resolves the added core noun %s', (type, singular, plural) => {
    expect(resolveStoryTerm(comicPt, 'pt', t, type)).toBe(singular);
    expect(resolveStoryTerm(comicPt, 'pt', t, type, true)).toBe(plural);
  });

  it('falls back to the translated default when that type was left blank', () => {
    expect(resolveStoryTerm(comicPt, 'pt', t, 'Chapter')).toBe('chapter');
  });
});

describe('hasStoryTermOverride', () => {
  it('only enables customized grammar in the vocabulary language and for a filled term', () => {
    expect(hasStoryTermOverride(comicPt, 'pt', 'Character')).toBe(true);
    expect(hasStoryTermOverride(comicPt, 'pt', 'Chapter')).toBe(false);
    expect(hasStoryTermOverride(comicPt, 'en', 'Character')).toBe(false);
  });
});

describe('resolveStoryGender', () => {
  it('keeps Keres defaults when the story has not renamed the type', () => {
    expect(resolveStoryGender(null, 'pt', 'Scene')).toBe('feminine');
    expect(resolveStoryGender(null, 'pt', 'Character')).toBe('masculine');
  });

  it('follows the override, including a swapped gender', () => {
    expect(resolveStoryGender(comicPt, 'pt', 'Location')).toBe('masculine');
    expect(resolveStoryGender(comicPt, 'en', 'Location')).toBe('feminine');
    expect(resolveStoryGender(comicPt, 'pt', 'WorldRule')).toBe('feminine');
    expect(resolveStoryGender(comicPt, 'pt', 'Choice')).toBe('feminine');
  });
});

describe('agreeStoryTerm', () => {
  const forms = { masculine: 'o', feminine: 'a', neutral: 'o(a)' };

  it('uses the masculine ending for a masculine Portuguese noun, not the neutral fallback', () => {
    expect(agreeStoryTerm('pt', 'masculine', forms)).toBe('o');
  });

  it('uses the feminine ending for a feminine Portuguese noun', () => {
    expect(agreeStoryTerm('pt', 'feminine', forms)).toBe('a');
  });

  it('uses the neutral form when the noun is marked neutral', () => {
    expect(agreeStoryTerm('pt', 'neutral', forms)).toBe('o(a)');
  });

  it('ignores grammatical gender in English', () => {
    expect(agreeStoryTerm('en', 'feminine', forms)).toBe('o(a)');
  });
});
