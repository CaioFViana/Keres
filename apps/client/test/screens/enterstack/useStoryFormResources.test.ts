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

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useStoryFormResources } from '../../../src/screens/enterstack/useStoryFormResources';
import { useShippedPacksInstallerStore } from '../../../src/state/shippedPacksInstallerStore';

beforeEach(() => {
  jest.clearAllMocks();
  mockListPacks.mockResolvedValue([]);
  useShippedPacksInstallerStore.setState({ open: false, lastInstalledPackId: null });
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

it('re-lists packs when the overlay reports an install', async () => {
  mockListPacks.mockResolvedValue([{ id: 'pack-1' }]);
  const view = await renderHook(() => useStoryFormResources());

  await waitFor(() => expect(view.result.current.packs).toEqual([{ id: 'pack-1' }]));
  expect(mockListPacks).toHaveBeenCalledTimes(1);

  // The overlay's modal never refocuses the form, so the install nudges the list this way.
  mockListPacks.mockResolvedValue([{ id: 'pack-1' }, { id: 'pack-2' }]);
  await act(async () => {
    useShippedPacksInstallerStore.getState().markInstalled('pack-2');
  });

  await waitFor(() =>
    expect(view.result.current.packs).toEqual([{ id: 'pack-1' }, { id: 'pack-2' }]),
  );
  expect(mockListPacks).toHaveBeenCalledTimes(2);
});
