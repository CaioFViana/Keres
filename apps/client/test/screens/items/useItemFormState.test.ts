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
import { useItemFormState } from '../../../src/screens/items/useItemFormState';
import {
  resetEditorDraftDbForTests,
  setEditorDraftDb,
} from '../../../src/services/EditorDraftService';
import type { ItemService } from '../../../src/services/storymanagement/ItemService';
import { createTestDatabase, type TestDatabase } from '../../helpers/testDb';

let database: TestDatabase;

const createItemServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as ItemService,
});
const customFields: StorySchemaField[] = [];

const renderState = async (
  initialItemId?: string,
  item?: object,
  fields: StorySchemaField[] = customFields,
) => {
  const itemServiceRef = createItemServiceRef();
  if (item) {
    (itemServiceRef.current!.getById as jest.Mock).mockResolvedValue(item);
  }
  const view = await renderHook(() =>
    useItemFormState({
      initialItemId,
      storyId: 'story-1',
      drizzleDb: database.db,
      itemServiceRef,
      customFields: fields,
    }),
  );
  return { itemServiceRef, view };
};

const persistedItem = {
  name: 'Andúril',
  category: 'Espada',
  description: 'Chama do Oeste',
  initialState: null,
  isFavorite: false,
  extraNotes: null,
  characterOwnerId: null,
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

it('retains a newly created item id without rehydrating over draft attributes', async () => {
  const { itemServiceRef, view } = await renderState();

  await act(async () => {
    view.result.current.setCustomValues({ field: 'draft value' });
    view.result.current.retainPersistedItemId('item-created');
  });

  expect(view.result.current.currentItemId).toBe('item-created');
  expect(view.result.current.customValues).toEqual({ field: 'draft value' });
  expect(itemServiceRef.current!.getById).not.toHaveBeenCalled();
  expect(mockGetValuesForEntity).not.toHaveBeenCalled();
});

it('still hydrates the item and attributes supplied when the form opens', async () => {
  mockGetValuesForEntity.mockResolvedValue([{ fieldId: 'field', value: 'persisted value' }]);
  const { itemServiceRef, view } = await renderState('item-existing', {
    name: 'Existing item',
    category: 'tool',
    description: null,
    initialState: null,
    isFavorite: false,
    extraNotes: null,
    characterOwnerId: 'character-1',
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(itemServiceRef.current!.getById).toHaveBeenCalledWith('item-existing');
  expect(mockGetValuesForEntity).toHaveBeenCalledWith('item-existing');
  expect(view.result.current.name).toBe('Existing item');
  expect(view.result.current.category).toBe('tool');
  expect(view.result.current.characterOwnerId).toBe('character-1');
  expect(view.result.current.customValues).toEqual({ field: 'persisted value' });
});

it('applies schema defaults once for a new item instead of hydrating', async () => {
  const { view } = await renderState(undefined, undefined, [
    { id: 'field-1', defaultValue: 'fresh default' } as StorySchemaField,
  ]);

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.customValues).toEqual({ 'field-1': 'fresh default' });
  expect(view.result.current.isEditing).toBe(false);
});

describe('useItemFormState durable drafts', () => {
  it('restores typed creation content after a navigation round-trip', async () => {
    const { view: first } = await renderState();
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setName('Ferroada');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState();
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.name).toBe('Ferroada');
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
    const { view: first } = await renderState('item-1', persistedItem);
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.name).toBe('Andúril');

    await act(async () => {
      first.result.current.setName('Andúril, reforjada');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState('item-1', persistedItem);
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.name).toBe('Andúril, reforjada');
    expect(second.result.current.description).toBe('Chama do Oeste');
  });

  it('resets a creation back to blanks and drops the stored draft', async () => {
    const { view: first } = await renderState();
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setName('Ferroada');
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
      second.result.current.setName('Narsil');
    });
    await act(async () => {
      second.unmount();
    });
    const { view: third } = await renderState();
    await waitFor(() => expect(third.result.current.draftRestored).toBe(true));
    expect(third.result.current.name).toBe('Narsil');
  });

  it('resets an edit back to the saved values and drops the stored draft', async () => {
    const { view: first } = await renderState('item-1', persistedItem);
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setName('Rascunho');
      first.result.current.setCategory('Adaga');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.name).toBe('Andúril');
    expect(first.result.current.category).toBe('Espada');
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState('item-1', persistedItem);
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('Andúril');
  });

  it('discards the draft when the entity was saved elsewhere since', async () => {
    const { view: first } = await renderState('item-1', persistedItem);
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setName('Rascunho velho');
    });
    await act(async () => {
      first.unmount();
    });

    const newerItem = {
      ...persistedItem,
      name: 'Andúril refeita',
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    };
    const { view: second } = await renderState('item-1', newerItem);
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('Andúril refeita');
  });
});
