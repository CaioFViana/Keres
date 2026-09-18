const mockGetValuesForEntity = jest.fn();

jest.mock('../../../src/services/storymanagement/AttributeValueService', () => ({
  createAttributeValueService: () => ({ getValuesForEntity: mockGetValuesForEntity }),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { StorySchemaField } from '@keres/shared';
import { useItemFormState } from '../../../src/screens/items/useItemFormState';
import type { ItemService } from '../../../src/services/storymanagement/ItemService';

const createItemServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as ItemService,
});
const drizzleDb = {} as never;
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
      drizzleDb,
      itemServiceRef,
      customFields: fields,
    }),
  );
  return { itemServiceRef, view };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetValuesForEntity.mockResolvedValue([]);
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
