const mockGetValuesForEntity = jest.fn();

jest.mock('../../../src/services/storymanagement/AttributeValueService', () => ({
  createAttributeValueService: () => ({ getValuesForEntity: mockGetValuesForEntity }),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { StorySchemaField } from '@keres/shared';
import { useLocationFormState } from '../../../src/screens/locations/useLocationFormState';
import type { LocationService } from '../../../src/services/storymanagement/LocationService';

const createLocationServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as LocationService,
});
const drizzleDb = {} as never;
const customFields: StorySchemaField[] = [];

const renderState = async (
  initialLocationId?: string,
  location?: object,
  fields: StorySchemaField[] = customFields,
) => {
  const locationServiceRef = createLocationServiceRef();
  if (location) {
    (locationServiceRef.current!.getById as jest.Mock).mockResolvedValue(location);
  }
  const view = await renderHook(() =>
    useLocationFormState({
      initialLocationId,
      storyId: 'story-1',
      drizzleDb,
      locationServiceRef,
      customFields: fields,
    }),
  );
  return { locationServiceRef, view };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetValuesForEntity.mockResolvedValue([]);
});

it('retains a newly created location id without rehydrating over draft attributes', async () => {
  const { locationServiceRef, view } = await renderState();

  await act(async () => {
    view.result.current.setCustomValues({ field: 'draft value' });
    view.result.current.retainPersistedLocationId('location-created');
  });

  expect(view.result.current.currentLocationId).toBe('location-created');
  expect(view.result.current.customValues).toEqual({ field: 'draft value' });
  expect(locationServiceRef.current!.getById).not.toHaveBeenCalled();
  expect(mockGetValuesForEntity).not.toHaveBeenCalled();
});

it('still hydrates the location and attributes supplied when the form opens', async () => {
  mockGetValuesForEntity.mockResolvedValue([{ fieldId: 'field', value: 'persisted value' }]);
  const { locationServiceRef, view } = await renderState('location-existing', {
    name: 'Existing location',
    description: null,
    climate: 'arid',
    culture: null,
    politics: null,
    isFavorite: false,
    extraNotes: null,
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(locationServiceRef.current!.getById).toHaveBeenCalledWith('location-existing');
  expect(mockGetValuesForEntity).toHaveBeenCalledWith('location-existing');
  expect(view.result.current.name).toBe('Existing location');
  expect(view.result.current.climate).toBe('arid');
  expect(view.result.current.customValues).toEqual({ field: 'persisted value' });
});

it('applies schema defaults once for a new location instead of hydrating', async () => {
  const { view } = await renderState(undefined, undefined, [
    { id: 'field-1', defaultValue: 'fresh default' } as StorySchemaField,
  ]);

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.customValues).toEqual({ 'field-1': 'fresh default' });
  expect(view.result.current.isEditing).toBe(false);
});
