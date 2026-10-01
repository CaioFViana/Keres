const mockUseDrizzle = jest.fn();
const mockCreateRouteService = jest.fn();

jest.mock('../../../src/db', () => ({
  useDrizzle: (...args: unknown[]) => mockUseDrizzle(...args),
}));
jest.mock('../../../src/services/storymanagement/RouteService', () => ({
  createRouteService: (...args: unknown[]) => mockCreateRouteService(...args),
}));

import { renderHook } from '@testing-library/react-native';
import { useRouteFormResources } from '../../../src/screens/routes/useRouteFormResources';

const fakeDb = { marker: 'db' };
const fakeService = { marker: 'route-service' };

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDrizzle.mockReturnValue(fakeDb);
  mockCreateRouteService.mockReturnValue(fakeService);
});

it('creates the route service once from the drizzle client', async () => {
  const view = await renderHook(() => useRouteFormResources());

  expect(view.result.current.drizzleDb).toBe(fakeDb);
  expect(mockCreateRouteService).toHaveBeenCalledWith(fakeDb);
  expect(view.result.current.routeServiceRef.current).toBe(fakeService);

  view.rerender({});
  expect(mockCreateRouteService).toHaveBeenCalledTimes(1);
});
