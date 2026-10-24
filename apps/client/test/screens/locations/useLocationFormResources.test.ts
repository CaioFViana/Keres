import { renderHook } from '@testing-library/react-native';
import { useLocationFormResources } from '@/src/screens/locations/useLocationFormResources';

const mockDb = {};
const mockCreateLocationService: jest.Mock = jest.fn(() => ({ id: 'location-service' }));
const mockCreateLocationRelationService: jest.Mock = jest.fn(() => ({
  id: 'location-relation-service',
}));

jest.mock('@/src/db', () => ({ useDrizzle: () => mockDb }));
jest.mock('@/src/services/storymanagement/entities/LocationService', () => ({
  createLocationService: (...args: unknown[]) => mockCreateLocationService(...args),
}));
jest.mock('@/src/services/storymanagement/relations/LocationRelationService', () => ({
  createLocationRelationService: (...args: unknown[]) => mockCreateLocationRelationService(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it('creates the location services once for the form database', async () => {
  const view = await renderHook(() => useLocationFormResources());

  expect(view.result.current.drizzleDb).toBe(mockDb);
  expect(mockCreateLocationService).toHaveBeenCalledTimes(1);
  expect(mockCreateLocationService).toHaveBeenCalledWith(mockDb);
  expect(mockCreateLocationRelationService).toHaveBeenCalledTimes(1);
  expect(mockCreateLocationRelationService).toHaveBeenCalledWith(mockDb);
  expect(view.result.current.locationServiceRef.current).toEqual({ id: 'location-service' });
  expect(view.result.current.locationRelationServiceRef.current).toEqual({
    id: 'location-relation-service',
  });
});

it('has the services in the very first render, not only after the effects ran', async () => {
  const seenDuringRender: unknown[] = [];

  await renderHook(() => {
    const resources = useLocationFormResources();
    seenDuringRender.push(
      resources.locationServiceRef.current,
      resources.locationRelationServiceRef.current,
    );
    return resources;
  });

  expect(seenDuringRender.slice(0, 2)).toEqual([
    { id: 'location-service' },
    { id: 'location-relation-service' },
  ]);
});
