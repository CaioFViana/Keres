import { renderHook, waitFor } from '@testing-library/react-native';

const mockGetLastEdited = jest.fn();
const mockGetChapter = jest.fn();
const mockDb = {};

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useFocusEffect: (effect: () => void | (() => void)) => {
    const react = jest.requireActual('react') as typeof import('react');
    react.useEffect(effect, [effect]);
  },
}));
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: () => ({ getLastEdited: mockGetLastEdited }),
}));
jest.mock('../../src/services/storymanagement/ChapterService', () => ({
  __esModule: true,
  createChapterService: () => ({ getById: mockGetChapter }),
}));

import { useResumeScene } from '../../src/hooks/useResumeScene';

const EDITED = new Date('2026-10-08T10:00:00.000Z');

beforeEach(() => {
  jest.clearAllMocks();
  mockGetChapter.mockResolvedValue({ id: 'chapter-1', name: 'Arrival' });
});

describe('useResumeScene', () => {
  it('offers the last edited scene with the name of its chapter', async () => {
    mockGetLastEdited.mockResolvedValue({
      id: 'scene-1',
      name: 'The bridge',
      chapterId: 'chapter-1',
      updatedAt: EDITED,
    });
    const { result } = await renderHook(() => useResumeScene('story-1'));

    await waitFor(() =>
      expect(result.current).toEqual({
        id: 'scene-1',
        name: 'The bridge',
        chapterName: 'Arrival',
        editedAt: EDITED,
      }),
    );
    expect(mockGetLastEdited).toHaveBeenCalledWith('story-1');
  });

  it('does not look for a chapter a loose scene does not have', async () => {
    mockGetLastEdited.mockResolvedValue({
      id: 'scene-2',
      name: 'Loose',
      chapterId: null,
      updatedAt: EDITED,
    });
    const { result } = await renderHook(() => useResumeScene('story-1'));

    await waitFor(() => expect(result.current?.id).toBe('scene-2'));
    expect(result.current?.chapterName).toBeNull();
    expect(mockGetChapter).not.toHaveBeenCalled();
  });

  it('has nothing to offer in a story with no scenes', async () => {
    mockGetLastEdited.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useResumeScene('story-1'));

    await waitFor(() => expect(mockGetLastEdited).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('has nothing to offer when it cannot read, and does not break the screen', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetLastEdited.mockRejectedValue(new Error('db down'));
    const { result } = await renderHook(() => useResumeScene('story-1'));

    await waitFor(() => expect(mockGetLastEdited).toHaveBeenCalled());
    expect(result.current).toBeNull();
    (console.error as jest.Mock).mockRestore();
  });

  it('asks for nothing without a story', async () => {
    const { result } = await renderHook(() => useResumeScene(undefined));

    expect(result.current).toBeNull();
    expect(mockGetLastEdited).not.toHaveBeenCalled();
  });
});
