/**
 * @jest-environment node
 */
import type { StoryVocabulary } from '@keres/shared/entities/Story';
import type { TFunction } from 'i18next';
import {
  agreeStoryTerm,
  defaultGrammaticalGender,
  hasStoryTermOverride,
  isStoryVocabularyEntityType,
  localeFamily,
  resolveStoryGender,
} from '../../src/vocabulary/resolveStoryTerm';

const t = ((key: string) => key) as unknown as TFunction;

describe('localeFamily', () => {
  it.each([
    ['pt-BR', 'pt'],
    ['PT-pt', 'pt'],
    ['en', 'en'],
    ['en-US', 'en'],
  ])('maps %p to %p', (language, expected) => {
    expect(localeFamily(language)).toBe(expected);
  });

  it('defaults to English when the language is missing', () => {
    expect(localeFamily(undefined)).toBe('en');
  });
});

describe('isStoryVocabularyEntityType', () => {
  it('accepts the nine core nouns and rejects the rest', () => {
    for (const type of [
      'Character',
      'Location',
      'Chapter',
      'Scene',
      'Event',
      'Item',
      'WorldRule',
      'Choice',
      'Arc',
    ]) {
      expect(isStoryVocabularyEntityType(type)).toBe(true);
    }
    expect(isStoryVocabularyEntityType('Tag')).toBe(false);
    expect(isStoryVocabularyEntityType('ItemJourney')).toBe(false);
    expect(isStoryVocabularyEntityType('')).toBe(false);
  });
});

describe('defaultGrammaticalGender', () => {
  it.each([
    ['Scene', 'feminine'],
    ['Location', 'feminine'],
    ['WorldRule', 'feminine'],
    ['Choice', 'feminine'],
    ['Character', 'masculine'],
    ['Item', 'masculine'],
    ['Chapter', 'masculine'],
    ['Event', 'masculine'],
    ['Arc', 'masculine'],
  ] as const)('defaults %s to %s', (type, expected) => {
    expect(defaultGrammaticalGender(type)).toBe(expected);
  });
});

describe('agreeStoryTerm fallbacks', () => {
  it('falls back to masculine when no neutral form is given', () => {
    expect(agreeStoryTerm('pt', 'neutral', { masculine: 'o', feminine: 'a' })).toBe('o');
    expect(agreeStoryTerm('en', 'feminine', { masculine: 'o', feminine: 'a' })).toBe('o');
  });
});

describe('hasStoryTermOverride with null vocabulary', () => {
  it('reports no override without a vocabulary', () => {
    expect(hasStoryTermOverride(null, 'pt', 'Character')).toBe(false);
  });

  it('ignores a vocabulary saved for the other language', () => {
    const vocabulary: StoryVocabulary = {
      version: 1,
      language: 'en',
      terms: {
        Character: { singular: 'Hero', plural: 'Heroes', grammaticalGender: 'masculine' },
      },
    };
    expect(hasStoryTermOverride(vocabulary, 'pt', 'Character')).toBe(false);
    expect(resolveStoryGender(vocabulary, 'pt', 'Character')).toBe('masculine');
  });
});
