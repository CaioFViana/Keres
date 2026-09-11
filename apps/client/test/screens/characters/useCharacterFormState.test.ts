const mockGetValuesForEntity = jest.fn();

jest.mock('../../../src/services/storymanagement/AttributeValueService', () => ({
  createAttributeValueService: () => ({ getValuesForEntity: mockGetValuesForEntity }),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { StorySchemaField } from '@keres/shared';
import { useCharacterFormState } from '../../../src/screens/characters/useCharacterFormState';
import type { CharacterService } from '../../../src/services/storymanagement/CharacterService';

const createCharacterServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as CharacterService,
});
const drizzleDb = {} as never;
const customFields: StorySchemaField[] = [];

const renderState = async (initialCharacterId?: string, character?: object) => {
  const characterServiceRef = createCharacterServiceRef();
  if (character) {
    (characterServiceRef.current!.getById as jest.Mock).mockResolvedValue(character);
  }
  const view = await renderHook(() =>
    useCharacterFormState({
      initialCharacterId,
      storyId: 'story-1',
      drizzleDb,
      characterServiceRef,
      customFields,
    }),
  );
  return { characterServiceRef, view };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetValuesForEntity.mockResolvedValue([]);
});

it('retains a newly created character id without rehydrating over draft attributes', async () => {
  const { characterServiceRef, view } = await renderState();

  await act(async () => {
    view.result.current.setCustomValues({ field: 'draft value' });
    view.result.current.retainPersistedCharacterId('character-created');
  });

  expect(view.result.current.currentCharacterId).toBe('character-created');
  expect(view.result.current.customValues).toEqual({ field: 'draft value' });
  expect(characterServiceRef.current!.getById).not.toHaveBeenCalled();
  expect(mockGetValuesForEntity).not.toHaveBeenCalled();
});

it('still hydrates the character and attributes supplied when the form opens', async () => {
  mockGetValuesForEntity.mockResolvedValue([{ fieldId: 'field', value: 'persisted value' }]);
  const { characterServiceRef, view } = await renderState('character-existing', {
    name: 'Existing character',
    title: null,
    description: null,
    gender: null,
    race: null,
    subrace: null,
    personality: null,
    motivation: null,
    qualities: null,
    weaknesses: null,
    biography: null,
    plannedTimeline: null,
    isFavorite: false,
    extraNotes: null,
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(characterServiceRef.current!.getById).toHaveBeenCalledWith('character-existing');
  expect(mockGetValuesForEntity).toHaveBeenCalledWith('character-existing');
  expect(view.result.current.name).toBe('Existing character');
  expect(view.result.current.customValues).toEqual({ field: 'persisted value' });
});
