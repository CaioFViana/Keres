const mockUseDrizzle = jest.fn();
const mockCreatePlotService = jest.fn();
const mockCreatePlotSceneService = jest.fn();
const mockUseStoryPlots = jest.fn();

jest.mock('../../../src/db', () => ({
  useDrizzle: (...args: unknown[]) => mockUseDrizzle(...args),
}));
jest.mock('../../../src/services/storymanagement/PlotService', () => ({
  createPlotService: (...args: unknown[]) => mockCreatePlotService(...args),
}));
jest.mock('../../../src/services/storymanagement/PlotSceneService', () => ({
  createPlotSceneService: (...args: unknown[]) => mockCreatePlotSceneService(...args),
}));
jest.mock('../../../src/hooks/useStoryPlots', () => ({
  useStoryPlots: (...args: unknown[]) => mockUseStoryPlots(...args),
}));

import { renderHook } from '@testing-library/react-native';
import { usePlotFormResources } from '../../../src/screens/plots/usePlotFormResources';

const fakeDb = { marker: 'db' };
const fakePlotService = { marker: 'plot-service' };
const fakePlotSceneService = { marker: 'plot-scene-service' };
const fakeLookup = {
  scenes: [{ id: 'scene-1' }],
  relationsOf: jest.fn(),
  chapterNameOf: jest.fn(),
  reload: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDrizzle.mockReturnValue(fakeDb);
  mockCreatePlotService.mockReturnValue(fakePlotService);
  mockCreatePlotSceneService.mockReturnValue(fakePlotSceneService);
  mockUseStoryPlots.mockReturnValue(fakeLookup);
});

it('creates both plot services and passes the story lookup through', async () => {
  const view = await renderHook(() => usePlotFormResources('story-1'));

  expect(mockCreatePlotService).toHaveBeenCalledWith(fakeDb);
  expect(mockCreatePlotSceneService).toHaveBeenCalledWith(fakeDb);
  expect(view.result.current.plotServiceRef.current).toBe(fakePlotService);
  expect(view.result.current.plotSceneServiceRef.current).toBe(fakePlotSceneService);
  expect(mockUseStoryPlots).toHaveBeenCalledWith('story-1', 'linear');
  expect(view.result.current.scenes).toBe(fakeLookup.scenes);
  expect(view.result.current.relationsOf).toBe(fakeLookup.relationsOf);
  expect(view.result.current.chapterNameOf).toBe(fakeLookup.chapterNameOf);
  expect(view.result.current.reloadPlotData).toBe(fakeLookup.reload);
});

it('forwards a branching story type to the lookup', async () => {
  await renderHook(() => usePlotFormResources('story-1', 'branching'));

  expect(mockUseStoryPlots).toHaveBeenCalledWith('story-1', 'branching');
});
