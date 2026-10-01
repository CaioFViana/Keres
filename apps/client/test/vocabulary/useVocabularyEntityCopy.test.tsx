import { render } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: jest.fn(),
}));
jest.mock('../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: jest.fn(),
}));

import { useTranslation } from 'react-i18next';
import { useStoryVocabulary } from '../../src/vocabulary/useStoryVocabulary';
import { useVocabularyEntityCopy } from '../../src/vocabulary/useVocabularyEntityCopy';

const t = jest.fn((key: string, options?: Record<string, unknown>) => ({ key, options }));

beforeEach(() => {
  jest.clearAllMocks();
  (useTranslation as jest.Mock).mockReturnValue({ t });
  (useStoryVocabulary as jest.Mock).mockReturnValue({
    term: (type: string, plural = false) => (plural ? `${type}s-pt` : `${type}-pt`),
    agree: () => 'a',
  });
});

async function renderCopy(type: any = 'Character') {
  let result!: ReturnType<typeof useVocabularyEntityCopy>;
  const Probe = () => {
    result = useVocabularyEntityCopy(type);
    return null;
  };
  await render(<Probe />);
  return result;
}

it('exposes the resolved noun, plural and participle ending', async () => {
  const copy = await renderCopy();

  expect(copy.entity).toBe('Character-pt');
  expect(copy.entities).toBe('Characters-pt');
  expect(copy.ending).toBe('a');
});

it('substitutes the noun into every chrome string', async () => {
  const copy = await renderCopy();

  expect(copy.createTitle).toEqual({
    key: 'vocabulary_create_entity',
    options: { entity: 'Character-pt' },
  });
  expect(copy.editTitle).toEqual({
    key: 'vocabulary_edit_entity',
    options: { entity: 'Character-pt' },
  });
  expect(copy.detailsTitle).toEqual({
    key: 'vocabulary_entity_details',
    options: { entity: 'Character-pt' },
  });
  expect(copy.formDescription).toEqual({
    key: 'vocabulary_form_description',
    options: { entity: 'Character-pt' },
  });
  expect(copy.fromEntity).toEqual({
    key: 'vocabulary_from_entity',
    options: { entity: 'Character-pt' },
  });
});

it('agrees participles with the ending', async () => {
  const copy = await renderCopy();

  expect(copy.created).toEqual({
    key: 'vocabulary_entity_created',
    options: { entity: 'Character-pt', ending: 'a' },
  });
  expect(copy.updated).toEqual({
    key: 'vocabulary_entity_updated',
    options: { entity: 'Character-pt', ending: 'a' },
  });
  expect(copy.deleted).toEqual({
    key: 'vocabulary_entity_deleted',
    options: { entity: 'Character-pt', ending: 'a' },
  });
  expect(copy.notFound).toEqual({
    key: 'vocabulary_entity_not_found',
    options: { entity: 'Character-pt', ending: 'a' },
  });
});

it('uses the plural for list copy and item-named journey copy', async () => {
  const copy = await renderCopy();

  expect(copy.loading).toEqual({
    key: 'vocabulary_loading_entities',
    options: { entities: 'Characters-pt' },
  });
  expect(copy.searchPlaceholder).toEqual({
    key: 'search_entities',
    options: { entities: 'Characters-pt' },
  });
  expect(copy.itemJourney).toEqual({
    key: 'vocabulary_item_journey',
    options: { item: 'Character-pt' },
  });
  expect(copy.itemJourneys).toEqual({
    key: 'vocabulary_item_journeys',
    options: { items: 'Characters-pt' },
  });
});
