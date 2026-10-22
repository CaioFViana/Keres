import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useSceneDraftFlag } from '@/src/screens/narrative-elements/scenes/useSceneDraftFlag';

const mockReadStoredSceneBodyText = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('@/src/screens/narrative-elements/scenes/useSceneBodyDraft', () => ({
  __esModule: true,
  readStoredSceneBodyText: (...args: unknown[]) => mockReadStoredSceneBodyText(...args),
}));
jest.mock('@/src/utils/logging/logger', () => ({
  __esModule: true,
  logger: { error: (...args: unknown[]) => mockLoggerError(...args) },
}));

interface Props {
  storyId: string | undefined;
  body: string | null | undefined;
}

function renderFlag(initialProps: Props) {
  return renderHook<boolean, Props>(
    ({ storyId, body }) => useSceneDraftFlag(storyId, 'scene-1', body),
    { initialProps },
  );
}

describe('useSceneDraftFlag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('flags a stored draft that differs from the saved body', async () => {
    mockReadStoredSceneBodyText.mockResolvedValue('Unsaved words');
    const view = await renderFlag({ storyId: 'story-1', body: 'Saved words' });
    await waitFor(() => expect(view.result.current).toBe(true));
    expect(mockReadStoredSceneBodyText).toHaveBeenCalledWith('story-1', 'scene-1');
  });

  it('reads clean when the draft matches the saved body or is missing', async () => {
    mockReadStoredSceneBodyText.mockResolvedValue('Saved words');
    const view = await renderFlag({ storyId: 'story-1', body: 'Saved words' });
    await waitFor(() => expect(mockReadStoredSceneBodyText).toHaveBeenCalledTimes(1));
    expect(view.result.current).toBe(false);

    mockReadStoredSceneBodyText.mockResolvedValue(null);
    await view.rerender({ storyId: 'story-1', body: 'Other body' });
    await waitFor(() => expect(mockReadStoredSceneBodyText).toHaveBeenCalledTimes(2));
    expect(view.result.current).toBe(false);
  });

  it('reads nothing without a story', async () => {
    const view = await renderFlag({ storyId: undefined, body: null });
    expect(mockReadStoredSceneBodyText).not.toHaveBeenCalled();
    expect(view.result.current).toBe(false);
  });

  it('never shows the answer of an older body for a newer one', async () => {
    mockReadStoredSceneBodyText.mockResolvedValue('Draft');
    const view = await renderFlag({ storyId: 'story-1', body: 'Saved' });
    await waitFor(() => expect(view.result.current).toBe(true));

    mockReadStoredSceneBodyText.mockReturnValue(new Promise(() => {}));
    await view.rerender({ storyId: 'story-1', body: 'Draft' });
    expect(view.result.current).toBe(false);
  });

  it('logs and reads clean when the read fails', async () => {
    const failure = new Error('storage down');
    mockReadStoredSceneBodyText.mockRejectedValue(failure);
    const view = await renderFlag({ storyId: 'story-1', body: 'Saved' });
    await waitFor(() =>
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Failed to read the stored scene draft:',
        failure,
      ),
    );
    await act(async () => {});
    expect(view.result.current).toBe(false);
  });
});
