import { renderHook, waitFor } from '@testing-library/react-native';
import { useCharacterTrajectoryData } from '../../src/hooks/useCharacterTrajectoryData';

const mockDb = {};
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
const mockGetChapters = jest.fn(async () => [
  { id: 'ch-1', index: 1, isDeleted: false },
  { id: 'ch-2', index: 2, isDeleted: true },
]);
jest.mock('../../src/services/storymanagement/ChapterService', () => ({
  createChapterService: () => ({ getAllByStoryId: mockGetChapters }),
}));
const mockGetRoutes = jest.fn(async () => [
  { id: 'route-1', name: 'Main', isDeleted: false },
  { id: 'route-old', name: 'Old', isDeleted: true },
]);
const mockGetSteps = jest.fn(async () => [
  { sceneId: 's-1', position: 1, isDeleted: false },
  { sceneId: 's-9', position: 2, isDeleted: true },
]);
jest.mock('../../src/services/storymanagement/RouteService', () => ({
  createRouteService: () => ({ getAllByStoryId: mockGetRoutes, getSteps: mockGetSteps }),
}));

describe('useCharacterTrajectoryData', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads chapters only for linear stories', async () => {
    const view = await renderHook(() => useCharacterTrajectoryData('story-1', 'linear'));

    await waitFor(() =>
      expect(view.result.current.chapters).toEqual([{ id: 'ch-1', index: 1, isDeleted: false }]),
    );
    expect(mockGetChapters).toHaveBeenCalledWith('story-1');
    expect(mockGetRoutes).not.toHaveBeenCalled();
    expect(view.result.current.routes).toEqual([]);
    expect(view.result.current.stepsByRoute).toEqual({});
  });

  it('loads routes and steps for branching stories, skipping deleted rows', async () => {
    const view = await renderHook(() => useCharacterTrajectoryData('story-1', 'branching'));

    await waitFor(() =>
      expect(view.result.current.routes).toEqual([
        { id: 'route-1', name: 'Main', isDeleted: false },
      ]),
    );
    expect(mockGetRoutes).toHaveBeenCalledWith('story-1');
    expect(mockGetSteps).toHaveBeenCalledTimes(1);
    expect(mockGetSteps).toHaveBeenCalledWith('route-1');
    expect(view.result.current.stepsByRoute).toEqual({
      'route-1': [{ sceneId: 's-1', position: 1, isDeleted: false }],
    });
  });
});
