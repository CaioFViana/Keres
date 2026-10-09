const mockDispatch = jest.fn();
const mockSetTheme = jest.fn();
const mockNotify = jest.fn();
const mockFindFirst = jest.fn();
const mockSetSelectedStory = jest.fn();

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: (...args: unknown[]) => mockDispatch(...args) }),
  StackActions: {
    replace: (name: string, params: unknown) => ({ type: 'REPLACE', name, params }),
  },
}));
jest.mock('../../src/db', () => ({
  useDrizzle: () => ({
    query: { stories: { findFirst: (...args: unknown[]) => mockFindFirst(...args) } },
  }),
}));
jest.mock('../../src/theme', () => ({ useTheme: () => ({ setTheme: mockSetTheme }) }));
jest.mock('../../src/state/notificationStore', () => ({
  useNotificationStore: () => ({ showNotification: (...args: unknown[]) => mockNotify(...args) }),
}));
jest.mock('../../src/state/storyStore', () => ({
  useStoryStore: {
    getState: () => ({ setSelectedStory: (...args: unknown[]) => mockSetSelectedStory(...args) }),
  },
}));

import { renderHook } from '@testing-library/react-native';
import { useOpenStoryById } from '../../src/hooks/useOpenStoryById';

beforeEach(() => jest.clearAllMocks());

describe('useOpenStoryById', () => {
  it('selects the story, takes its theme and goes to its screens, as the story list does', async () => {
    const story = { id: 's1', title: 'Casa', theme: 'forest', isDeleted: false };
    mockFindFirst.mockResolvedValue(story);
    const { result } = await renderHook(() => useOpenStoryById());

    await result.current('s1');

    expect(mockSetSelectedStory).toHaveBeenCalledWith(story);
    expect(mockSetTheme).toHaveBeenCalledWith('forest');
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'REPLACE',
      name: 'MainSystem',
      params: { storyId: 's1' },
    });
  });

  it('uses the default theme for a story without one', async () => {
    mockFindFirst.mockResolvedValue({ id: 's1', theme: null, isDeleted: false });
    const { result } = await renderHook(() => useOpenStoryById());

    await result.current('s1');

    expect(mockSetTheme).toHaveBeenCalledWith('default');
  });

  it('says so, and opens nothing, for a story that is not on this device', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useOpenStoryById());

    await result.current('missing');

    expect(mockNotify).toHaveBeenCalledWith('friend_shared_unavailable', 'warning');
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockSetSelectedStory).not.toHaveBeenCalled();
  });

  it('does not open a deleted story', async () => {
    mockFindFirst.mockResolvedValue({ id: 's1', isDeleted: true });
    const { result } = await renderHook(() => useOpenStoryById());

    await result.current('s1');

    expect(mockNotify).toHaveBeenCalledWith('friend_shared_unavailable', 'warning');
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
