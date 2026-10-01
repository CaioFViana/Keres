const mockDb = {};
const mockCreateItemService: jest.Mock = jest.fn(() => ({ id: 'item-service' }));

jest.mock('../../../src/db', () => ({ useDrizzle: () => mockDb }));
jest.mock('../../../src/services/storymanagement/ItemService', () => ({
  createItemService: (...args: unknown[]) => mockCreateItemService(...args),
}));

import { renderHook } from '@testing-library/react-native';
import { useItemFormResources } from '../../../src/screens/items/useItemFormResources';

beforeEach(() => {
  jest.clearAllMocks();
});

it('creates the item service once for the form database', async () => {
  const view = await renderHook(() => useItemFormResources());

  expect(view.result.current.drizzleDb).toBe(mockDb);
  expect(mockCreateItemService).toHaveBeenCalledTimes(1);
  expect(mockCreateItemService).toHaveBeenCalledWith(mockDb);
  expect(view.result.current.itemServiceRef.current).toEqual({ id: 'item-service' });
});
