const mockDb = {};
const mockListPacks = jest.fn();
const mockCreateStoryService: jest.Mock = jest.fn(() => ({ id: 'story-service' }));
const mockCreatePackService: jest.Mock = jest.fn(() => ({
  id: 'pack-service',
  listPacks: mockListPacks,
}));

jest.mock('../../../src/db', () => ({ useDrizzle: () => mockDb }));
jest.mock('../../../src/services/storymanagement/StoryService', () => ({
  createStoryService: (...args: unknown[]) => mockCreateStoryService(...args),
}));
jest.mock('../../../src/services/storymanagement/PackService', () => ({
  createPackService: (...args: unknown[]) => mockCreatePackService(...args),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useStoryFormResources } from '../../../src/screens/enterstack/useStoryFormResources';

beforeEach(() => {
  jest.clearAllMocks();
  mockListPacks.mockResolvedValue([]);
});

it('creates the story and pack services for the form database', async () => {
  const view = await renderHook(() => useStoryFormResources());

  expect(view.result.current.drizzleDb).toBe(mockDb);
  expect(mockCreateStoryService).toHaveBeenCalledWith(mockDb);
  expect(mockCreatePackService).toHaveBeenCalledWith(mockDb);
  expect(view.result.current.storyServiceRef.current).toEqual({ id: 'story-service' });
  expect(view.result.current.packServiceRef.current).toEqual(
    expect.objectContaining({ id: 'pack-service' }),
  );
});

it('lists packs only while creating a story', async () => {
  mockListPacks.mockResolvedValue([{ id: 'pack-1' }]);
  const created = await renderHook(() => useStoryFormResources());

  await waitFor(() => expect(created.result.current.packs).toEqual([{ id: 'pack-1' }]));
  expect(mockListPacks).toHaveBeenCalled();

  mockListPacks.mockClear();
  const editing = await renderHook(() => useStoryFormResources('story-1'));

  expect(editing.result.current.packs).toEqual([]);
  expect(mockListPacks).not.toHaveBeenCalled();
});
