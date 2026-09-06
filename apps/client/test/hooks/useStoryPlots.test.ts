const mockDb = {};
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('../../src/services/storymanagement/PlotService', () => ({
  __esModule: true,
  createPlotService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/PlotSceneService', () => ({
  __esModule: true,
  createPlotSceneService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/ChapterService', () => ({
  __esModule: true,
  createChapterService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/ChoiceService', () => ({
  __esModule: true,
  createChoiceService: jest.fn(),
}));
jest.mock('../../src/hooks/useEntityRefreshLifecycle', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    useEntityInitialLoad: (load: () => Promise<void>) =>
      React.useEffect(() => {
        void load();
      }, [load]),
  };
});

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createChapterService } from '../../src/services/storymanagement/ChapterService';
import { createChoiceService } from '../../src/services/storymanagement/ChoiceService';
import { useStoryPlots } from '../../src/hooks/useStoryPlots';
import { createPlotSceneService } from '../../src/services/storymanagement/PlotSceneService';
import { createPlotService } from '../../src/services/storymanagement/PlotService';
import { createSceneService } from '../../src/services/storymanagement/SceneService';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const chapters = [
  { id: 'chapter-1', name: 'Beginning', index: 1 },
  { id: 'chapter-2', name: 'End', index: 2 },
] as never;
const scenes = [
  { id: 'scene-2', name: 'End scene', chapterId: 'chapter-2', index: 1 },
  { id: 'scene-1', name: 'Start scene', chapterId: 'chapter-1', index: 1 },
] as never;
const plots = [{ id: 'plot-1', name: 'Main plot' }] as never;
const relations = [
  { id: 'relation-2', plotId: 'plot-1', sceneId: 'scene-2' },
  { id: 'relation-1', plotId: 'plot-1', sceneId: 'scene-1' },
  { id: 'orphan', plotId: 'plot-1', sceneId: 'removed-scene' },
] as never;

beforeEach(() => {
  jest.clearAllMocks();
  (createPlotService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue(plots),
  });
  (createPlotSceneService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue(relations),
  });
  (createSceneService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue(scenes),
  });
  (createChapterService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue(chapters),
  });
  (createChoiceService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue([]),
  });
});

describe('useStoryPlots', () => {
  it('builds a coherent narrative view and does not count relations to absent scenes', async () => {
    const view = await renderHook(() => useStoryPlots('story'));
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    expect(view.result.current.scenes.map((scene) => scene.id)).toEqual(['scene-1', 'scene-2']);
    expect(view.result.current.relationsOf('plot-1').map((relation) => relation.sceneId)).toEqual([
      'scene-1',
      'scene-2',
    ]);
    expect(view.result.current.coverageOf('plot-1')).toEqual({
      covered: 2,
      total: 2,
      percentage: 100,
    });
    expect(view.result.current.coverageOf('unknown')).toEqual({
      covered: 0,
      total: 2,
      percentage: 0,
    });
    expect(view.result.current.chapterNameOf('chapter-1')).toBe('Beginning');
    expect(view.result.current.sceneById('scene-1')).toMatchObject({ name: 'Start scene' });
    expect(view.result.current.presentationOrder).toBe('narrative-order');
  });

  it('reloads when a plot dependency changes and clears itself without a story', async () => {
    const view = await renderHook<
      ReturnType<typeof useStoryPlots>,
      { storyId: string | undefined }
    >(({ storyId }) => useStoryPlots(storyId), {
      initialProps: { storyId: 'story' as string | undefined },
    });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    const service = (createPlotService as jest.Mock).mock.results[0].value;

    await act(async () => {
      entityEventEmitter.emit('scene_changed', 'story');
    });
    await waitFor(() => expect(service.getAllByStoryId).toHaveBeenCalledTimes(2));

    await act(async () => view.rerender({ storyId: undefined }));
    expect(view.result.current).toMatchObject({ plots: [], scenes: [], loading: false });
  });
});
