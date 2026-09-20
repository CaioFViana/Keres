/** @jest-environment node */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockGetValuesForEntity = jest.fn();

jest.mock('../../../src/services/storymanagement/AttributeValueService', () => ({
  createAttributeValueService: () => ({ getValuesForEntity: mockGetValuesForEntity }),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { StorySchemaField } from '@keres/shared';
import { useCharacterFormState } from '../../../src/screens/characters/useCharacterFormState';
import {
  resetEditorDraftDbForTests,
  setEditorDraftDb,
} from '../../../src/services/EditorDraftService';
import type { CharacterService } from '../../../src/services/storymanagement/CharacterService';
import { createTestDatabase, type TestDatabase } from '../../helpers/testDb';

let database: TestDatabase;

const createCharacterServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as CharacterService,
});
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
      drizzleDb: database.db,
      characterServiceRef,
      customFields,
    }),
  );
  return { characterServiceRef, view };
};

const persistedCharacter = {
  name: 'Aragorn',
  title: null,
  description: 'Ranger do Norte',
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
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockGetValuesForEntity.mockResolvedValue([]);
  await AsyncStorage.clear();
  database = await createTestDatabase();
  setEditorDraftDb(database.db);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  resetEditorDraftDbForTests();
  database.close();
  jest.restoreAllMocks();
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

describe('useCharacterFormState durable drafts', () => {
  it('restores typed creation content after a navigation round-trip', async () => {
    const { view: first } = await renderState();
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setName('Gandalf');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState();
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.name).toBe('Gandalf');
  });

  it('writes no draft when nothing was typed', async () => {
    const { view: first } = await renderState();
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState();
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('');
  });

  it('restores edits over the loaded database values', async () => {
    const { view: first } = await renderState('char-1', persistedCharacter);
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.name).toBe('Aragorn');

    await act(async () => {
      first.result.current.setName('Aragorn, filho de Arathorn');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState('char-1', persistedCharacter);
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.name).toBe('Aragorn, filho de Arathorn');
    expect(second.result.current.description).toBe('Ranger do Norte');
  });

  it('resets a creation back to blanks and drops the stored draft', async () => {
    const { view: first } = await renderState();
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setName('Gandalf');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.name).toBe('');
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    // Nothing comes back: the draft died with the reset, and tracking re-armed instead.
    const { view: second } = await renderState();
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('');

    // ...so typing again drafts again.
    await act(async () => {
      second.result.current.setName('Saruman');
    });
    await act(async () => {
      second.unmount();
    });
    const { view: third } = await renderState();
    await waitFor(() => expect(third.result.current.draftRestored).toBe(true));
    expect(third.result.current.name).toBe('Saruman');
  });

  it('resets an edit back to the saved values and drops the stored draft', async () => {
    const { view: first } = await renderState('char-1', persistedCharacter);
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setName('Rascunho');
      first.result.current.setTitle('Capitão');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.name).toBe('Aragorn');
    expect(first.result.current.title).toBeNull();
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState('char-1', persistedCharacter);
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('Aragorn');
  });

  it('discards the draft when the entity was saved elsewhere since', async () => {
    const { view: first } = await renderState('char-1', persistedCharacter);
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setName('Rascunho velho');
    });
    await act(async () => {
      first.unmount();
    });

    const newerCharacter = {
      ...persistedCharacter,
      name: 'Elessar',
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    };
    const { view: second } = await renderState('char-1', newerCharacter);
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('Elessar');
  });
});
