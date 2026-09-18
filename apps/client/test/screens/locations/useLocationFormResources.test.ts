const mockDb = {};
const mockCreateLocationService: jest.Mock = jest.fn(() => ({ id: 'location-service' }));
const mockCreateLocationRelationService: jest.Mock = jest.fn(() => ({
  id: 'location-relation-service',
}));

jest.mock('../../../src/db', () => ({ useDrizzle: () => mockDb }));
jest.mock('../../../src/services/storymanagement/LocationService', () => ({
  createLocationService: (...args: unknown[]) => mockCreateLocationService(...args),
}));
jest.mock('../../../src/services/storymanagement/LocationRelationService', () => ({
  createLocationRelationService: (...args: unknown[]) => mockCreateLocationRelationService(...args),
}));

import { renderHook } from '@testing-library/react-native';
import { useLocationFormResources } from '../../../src/screens/locations/useLocationFormResources';

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
