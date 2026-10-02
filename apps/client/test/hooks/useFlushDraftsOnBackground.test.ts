const mockFlushEditor = jest.fn();
const mockFlushCanvas = jest.fn();
jest.mock('../../src/services/EditorDraftService', () => ({
  __esModule: true,
  flushPendingEditorDrafts: (...args: unknown[]) => mockFlushEditor(...args),
}));
jest.mock('../../src/services/canvasDraftPersistence', () => ({
  __esModule: true,
  flushPendingCanvasDrafts: (...args: unknown[]) => mockFlushCanvas(...args),
}));

import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useFlushDraftsOnBackground } from '../../src/hooks/useFlushDraftsOnBackground';

type Listener = (state: string) => void;
let listener: Listener | null;
const remove = jest.fn();

const mount = async () => {
  let view!: ReturnType<typeof renderHook>;
  await act(async () => {
    view = renderHook(() => useFlushDraftsOnBackground());
  });
  return view;
};

beforeEach(() => {
  jest.clearAllMocks();
  listener = null;
  mockFlushEditor.mockResolvedValue(undefined);
  mockFlushCanvas.mockResolvedValue(undefined);
  // The jest setup already replaces AppState's methods with mocks.
  (AppState.addEventListener as jest.Mock).mockImplementation((_: string, cb: Listener) => {
    listener = cb;
    return { remove };
  });
});

describe('useFlushDraftsOnBackground', () => {
  it.each(['background', 'inactive'])(
    'writes the waiting drafts when the app goes %s',
    async (state) => {
      await mount();

      listener?.(state);

      expect(mockFlushEditor).toHaveBeenCalledTimes(1);
      expect(mockFlushCanvas).toHaveBeenCalledTimes(1);
    },
  );

  it('does nothing when the app comes back to the foreground', async () => {
    await mount();

    listener?.('active');

    expect(listener).not.toBeNull();
    expect(mockFlushEditor).not.toHaveBeenCalled();
  });

  it('logs a failed flush instead of throwing, and stops listening on unmount', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFlushEditor.mockRejectedValueOnce(new Error('disk full'));
    const { unmount } = await mount();

    await act(async () => {
      listener?.('background');
    });
    expect(error).toHaveBeenCalledWith('Failed to flush pending drafts:', expect.any(Error));

    await act(async () => {
      unmount();
    });
    expect(remove).toHaveBeenCalled();
    error.mockRestore();
  });
});
