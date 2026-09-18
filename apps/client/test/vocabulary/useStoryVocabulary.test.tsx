import { render } from '@testing-library/react-native';
import React from 'react';

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: jest.fn(),
}));
jest.mock('../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: jest.fn(),
}));

import { useTranslation } from 'react-i18next';
import { useStoryStore } from '../../src/state/storyStore';
import { useStoryVocabulary } from '../../src/vocabulary/useStoryVocabulary';

const t = jest.fn((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key,
);

const comicPt = {
  version: 1,
  language: 'pt',
  terms: {
    Character: { singular: 'Heroína', plural: 'Heroínas', grammaticalGender: 'feminine' },
    Item: { singular: 'Artefato', plural: 'Artefatos', grammaticalGender: 'masculine' },
  },
};

async function renderHook(options: {
  story?: any;
  i18n?: any;
}): Promise<ReturnType<typeof useStoryVocabulary>> {
  (useTranslation as jest.Mock).mockReturnValue({ t, i18n: options.i18n });
  (useStoryStore as unknown as jest.Mock).mockImplementation((selector: any) =>
    selector({ selectedStory: options.story ?? null }),
  );
  let result!: ReturnType<typeof useStoryVocabulary>;
  const Probe = () => {
    result = useStoryVocabulary();
    return null;
  };
  await render(<Probe />);
  return result;
}

beforeEach(() => jest.clearAllMocks());

it('resolves terms, gender and agreement from the story vocabulary', async () => {
  const vocabulary = await renderHook({
    story: { vocabulary: comicPt },
    i18n: { language: 'pt-BR', resolvedLanguage: 'pt-BR' },
  });

  expect(vocabulary.language).toBe('pt');
  expect(vocabulary.isCustomVocabularyActive).toBe(true);
  expect(vocabulary.term('Character')).toBe('Heroína');
  expect(vocabulary.term('Character', true)).toBe('Heroínas');
  expect(vocabulary.gender('Character')).toBe('feminine');
  expect(vocabulary.agree('Character', { masculine: 'o', feminine: 'a' })).toBe('a');
});

it('falls back to defaults without a story', async () => {
  const vocabulary = await renderHook({ i18n: { language: 'en' } });

  expect(vocabulary.isCustomVocabularyActive).toBe(false);
  expect(vocabulary.term('Character')).toBe('character');
  expect(vocabulary.gender('Scene')).toBe('feminine');
});

it('prefers the resolved language and tolerates a missing i18n object', async () => {
  expect((await renderHook({ i18n: { language: 'en', resolvedLanguage: 'pt-PT' } })).language).toBe(
    'pt',
  );
  expect((await renderHook({ i18n: { language: 'pt-BR' } })).language).toBe('pt');
  const fallback = await renderHook({ i18n: undefined });
  expect(fallback.language).toBe('en');
  expect(fallback.term('Item')).toBe('item');
});

it('labels vocabulary types with story terms', async () => {
  const vocabulary = await renderHook({
    story: { vocabulary: comicPt },
    i18n: { language: 'pt-BR' },
  });

  expect(vocabulary.label('Character')).toBe('Heroína');
  expect(vocabulary.label('Character', true)).toBe('Heroínas');
  expect(vocabulary.label('Chapter')).toBe('chapter');
});

it('labels item journeys through the item noun', async () => {
  const vocabulary = await renderHook({
    story: { vocabulary: comicPt },
    i18n: { language: 'pt-BR' },
  });

  expect(vocabulary.label('ItemJourney')).toBe('vocabulary_item_journey:{"item":"Artefato"}');
  expect(vocabulary.label('ItemJourney', true)).toBe(
    'vocabulary_item_journeys:{"items":"Artefatos"}',
  );
});

it('labels other types with lowercase keys', async () => {
  const vocabulary = await renderHook({ i18n: { language: 'en' } });

  expect(vocabulary.label('Tag')).toBe('tag');
  expect(vocabulary.label('Tag', true)).toBe('tags');
});
