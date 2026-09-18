const mockUseDrizzle = jest.fn();
const mockCreatePackService = jest.fn();
const mockCreateStoryService = jest.fn();
const mockGetAllStories = jest.fn();
const mockShowNotification = jest.fn();

jest.mock('../../../src/db', () => ({
  useDrizzle: (...args: unknown[]) => mockUseDrizzle(...args),
}));
jest.mock('../../../src/services/storymanagement/PackService', () => ({
  createPackService: (...args: unknown[]) => mockCreatePackService(...args),
}));
jest.mock('../../../src/services/storymanagement/StoryService', () => ({
  createStoryService: (...args: unknown[]) => mockCreateStoryService(...args),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../src/state/notificationStore', () => ({
  useNotificationStore: (selector: (state: unknown) => unknown) =>
    selector({ showNotification: (...args: unknown[]) => mockShowNotification(...args) }),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { usePackFormResources } from '../../../src/screens/packs/usePackFormResources';

const fakeDb = { marker: 'db' };
const fakePackService = { marker: 'pack-service' };
const fakeStoryService = { getAllStories: mockGetAllStories };

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDrizzle.mockReturnValue(fakeDb);
  mockCreatePackService.mockReturnValue(fakePackService);
  mockCreateStoryService.mockReturnValue(fakeStoryService);
  mockGetAllStories.mockResolvedValue([{ id: 'story-1' }]);
});

it('creates both services and loads the source-story lookup', async () => {
  const view = await renderHook(() => usePackFormResources('user-1'));

  await waitFor(() => expect(view.result.current.storiesLoading).toBe(false));

  expect(mockCreatePackService).toHaveBeenCalledWith(fakeDb);
  expect(mockCreateStoryService).toHaveBeenCalledWith(fakeDb);
  expect(view.result.current.packServiceRef.current).toBe(fakePackService);
  expect(view.result.current.storyServiceRef.current).toBe(fakeStoryService);
  expect(mockGetAllStories).toHaveBeenCalledWith('user-1');
  expect(view.result.current.stories).toEqual([{ id: 'story-1' }]);
});

it('loads every story when no user is identified', async () => {
  const view = await renderHook(() => usePackFormResources(undefined));

  await waitFor(() => expect(view.result.current.storiesLoading).toBe(false));

  expect(mockGetAllStories).toHaveBeenCalledWith(undefined);
});

it('notifies and finishes loading when the lookup fails', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockGetAllStories.mockRejectedValue(new Error('db down'));
  const view = await renderHook(() => usePackFormResources('user-1'));

  await waitFor(() => expect(view.result.current.storiesLoading).toBe(false));

  expect(error).toHaveBeenCalledWith('PackFormScreen: failed to load.', expect.any(Error));
  expect(mockShowNotification).toHaveBeenCalledWith('packs_load_failed', 'error');
  expect(view.result.current.stories).toEqual([]);
  error.mockRestore();
});
