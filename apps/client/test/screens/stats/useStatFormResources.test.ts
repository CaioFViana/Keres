const mockUseDrizzle = jest.fn();
const mockCreateStatService = jest.fn();
const mockUseStoryStats = jest.fn();

jest.mock('../../../src/db', () => ({
  useDrizzle: (...args: unknown[]) => mockUseDrizzle(...args),
}));
jest.mock('../../../src/services/storymanagement/StatService', () => ({
  createStatService: (...args: unknown[]) => mockCreateStatService(...args),
}));
jest.mock('../../../src/hooks/useStoryStats', () => ({
  useStoryStats: (...args: unknown[]) => mockUseStoryStats(...args),
}));

import { renderHook } from '@testing-library/react-native';
import { useStatFormResources } from '../../../src/screens/stats/useStatFormResources';

const fakeDb = { marker: 'db' };
const fakeService = { marker: 'stat-service' };
const fakeData = { stats: [{ id: 'stat-1' }] };

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDrizzle.mockReturnValue(fakeDb);
  mockCreateStatService.mockReturnValue(fakeService);
  mockUseStoryStats.mockReturnValue(fakeData);
});

it('creates the stat service and passes the story stats lookup through', async () => {
  const view = await renderHook(() => useStatFormResources('story-1'));

  expect(mockCreateStatService).toHaveBeenCalledWith(fakeDb);
  expect(view.result.current.statServiceRef.current).toBe(fakeService);
  expect(mockUseStoryStats).toHaveBeenCalledWith('story-1');
  expect(view.result.current.data).toBe(fakeData);
  expect(view.result.current.drizzleDb).toBe(fakeDb);
});
