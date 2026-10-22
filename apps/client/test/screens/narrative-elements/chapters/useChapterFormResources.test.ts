import { renderHook } from '@testing-library/react-native';
import { useChapterFormResources } from '@/src/screens/narrative-elements/chapters/useChapterFormResources';

const mockUseDrizzle = jest.fn();
const mockCreateChapterService = jest.fn();

jest.mock('@/src/db', () => ({
  useDrizzle: (...args: unknown[]) => mockUseDrizzle(...args),
}));
jest.mock('@/src/services/storymanagement/scenes-chapters/ChapterService', () => ({
  createChapterService: (...args: unknown[]) => mockCreateChapterService(...args),
}));

const fakeDb = { marker: 'db' };
const fakeService = { marker: 'chapter-service' };

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDrizzle.mockReturnValue(fakeDb);
  mockCreateChapterService.mockReturnValue(fakeService);
});

it('creates the chapter service once from the drizzle client', async () => {
  const view = await renderHook(() => useChapterFormResources());

  expect(view.result.current.drizzleDb).toBe(fakeDb);
  expect(mockCreateChapterService).toHaveBeenCalledWith(fakeDb);
  expect(view.result.current.chapterServiceRef.current).toBe(fakeService);

  await view.rerender({});
  expect(mockCreateChapterService).toHaveBeenCalledTimes(1);
});
