/**
 * @jest-environment node
 */
import type { StoryVocabulary } from '@keres/shared/entities/Story';
import i18n, { type TFunction } from 'i18next';
import {
  fromStoryNoun,
  loadStoryVocabulary,
  translateStoryNoun,
  unknownStoryNoun,
} from '../../src/vocabulary/storyVocabularyLookup';

const t = jest.fn((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key,
) as unknown as TFunction;

const comicPt: StoryVocabulary = {
  version: 1,
  language: 'pt',
  terms: {
    Character: { singular: 'Heroína', plural: 'Heroínas', grammaticalGender: 'feminine' },
    Item: { singular: 'Artefato', plural: 'Artefatos', grammaticalGender: 'masculine' },
  },
};

const originalLanguage = i18n.language;

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  (i18n as { language?: string }).language = originalLanguage;
});

describe('loadStoryVocabulary', () => {
  it('returns the stored vocabulary', async () => {
    const findFirst = jest.fn(async () => ({ vocabulary: comicPt }));
    const db = { query: { stories: { findFirst } } } as any;

    await expect(loadStoryVocabulary(db, 'story-1')).resolves.toBe(comicPt);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ columns: { vocabulary: true } }),
    );
  });

  it('returns null when the story is missing or has no vocabulary', async () => {
    const missing = { query: { stories: { findFirst: jest.fn(async () => undefined) } } } as any;
    const blank = { query: { stories: { findFirst: jest.fn(async () => ({})) } } } as any;

    await expect(loadStoryVocabulary(missing, 'story-1')).resolves.toBeNull();
    await expect(loadStoryVocabulary(blank, 'story-1')).resolves.toBeNull();
  });
});

describe('translateStoryNoun', () => {
  it('uses the override in the vocabulary language', () => {
    (i18n as { language?: string }).language = 'pt-BR';
    expect(translateStoryNoun(t, comicPt, 'Character')).toBe('Heroína');
    expect(translateStoryNoun(t, comicPt, 'Character', true)).toBe('Heroínas');
  });

  it('falls back to the default term otherwise', () => {
    (i18n as { language?: string }).language = 'en';
    expect(translateStoryNoun(t, comicPt, 'Character')).toBe('character');
    expect(translateStoryNoun(t, null, 'Item', true)).toBe('items');
  });
});

describe('unknownStoryNoun', () => {
  it('uses the dedicated key without an override', () => {
    (i18n as { language?: string }).language = 'pt-BR';
    expect(unknownStoryNoun(t, null, 'Character')).toBe('unknown_character');
    expect(unknownStoryNoun(t, comicPt, 'Scene')).toBe('unknown_scene');
  });

  it('agrees the generic copy with the override', () => {
    (i18n as { language?: string }).language = 'pt-BR';
    expect(unknownStoryNoun(t, comicPt, 'Character')).toBe(
      'vocabulary_unknown_entity:{"entity":"Heroína","ending":"a"}',
    );
    expect(unknownStoryNoun(t, comicPt, 'Item')).toBe(
      'vocabulary_unknown_entity:{"entity":"Artefato","ending":"o"}',
    );
  });
});

describe('fromStoryNoun', () => {
  it('keeps the dedicated scene key without an override', () => {
    (i18n as { language?: string }).language = 'pt-BR';
    expect(fromStoryNoun(t, comicPt, 'Scene')).toBe('from_scene');
  });

  it('uses the generic copy for overridden and other nouns', () => {
    (i18n as { language?: string }).language = 'pt-BR';
    expect(fromStoryNoun(t, comicPt, 'Character')).toBe(
      'vocabulary_from_entity:{"entity":"Heroína"}',
    );
    expect(fromStoryNoun(t, null, 'Item')).toBe('vocabulary_from_entity:{"entity":"item"}');
  });
});
