import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useShowcaseStory } from '@/src/screens/showcase/useShowcaseStory';

const mockGetStory = jest.fn();
const mockUnlockStory = jest.fn();

jest.mock('@/src/services/api/ShowcaseApiService', () => {
  class ShowcaseUnlockError extends Error {
    reason: string;
    constructor(reason: string) {
      super(reason);
      this.reason = reason;
    }
  }
  return {
    ShowcaseUnlockError,
    showcaseApiService: {
      getStory: (...args: unknown[]) => mockGetStory(...args),
      unlockStory: (...args: unknown[]) => mockUnlockStory(...args),
    },
  };
});

const source = { kind: 'guest', origin: 'https://other.example' } as never;
const story = { storyId: 'S1', snapshot: { title: 'Casa' }, versions: [] };
const stub = { storyId: 'S1', protected: true };

function unlockError(reason: string) {
  const { ShowcaseUnlockError } = jest.requireMock('@/src/services/api/ShowcaseApiService');
  return new ShowcaseUnlockError(reason);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetStory.mockResolvedValue(story);
});

describe('useShowcaseStory', () => {
  it('reads an open story', async () => {
    const { result } = await renderHook(() => useShowcaseStory(source, 'S1'));

    await waitFor(() => expect(result.current.state).toEqual({ status: 'open', story }));
    expect(mockGetStory).toHaveBeenCalledWith(source, 'S1');
    expect(result.current.unlockToken).toBeNull();
  });

  it('asks nothing while there is no source to ask', async () => {
    const { result } = await renderHook(() => useShowcaseStory(null, 'S1'));

    expect(result.current.state).toEqual({ status: 'loading' });
    expect(mockGetStory).not.toHaveBeenCalled();
  });

  it('says whether the story is not on show, the server is unreachable, or the read failed', async () => {
    for (const [error, status] of [
      [{ response: { status: 404 }, isAxiosError: true }, 'not_found'],
      [Object.assign(new Error('x'), { code: 'NO_RESPONSE' }), 'unreachable'],
      [new Error('boom'), 'failed'],
    ] as const) {
      mockGetStory.mockRejectedValueOnce(error);
      const { result, unmount } = await renderHook(() => useShowcaseStory(source, 'S1'));
      await waitFor(() => expect(result.current.state.status).not.toBe('loading'));
      expect(result.current.state.status).toBe(status);
      await unmount();
    }
  });

  it('reads again on request', async () => {
    mockGetStory.mockRejectedValueOnce(new Error('boom'));
    const { result } = await renderHook(() => useShowcaseStory(source, 'S1'));
    await waitFor(() => expect(result.current.state.status).toBe('failed'));

    await act(async () => result.current.reload());

    await waitFor(() => expect(result.current.state.status).toBe('open'));
    expect(mockGetStory).toHaveBeenCalledTimes(2);
  });

  describe('a story behind a password', () => {
    beforeEach(() => mockGetStory.mockResolvedValueOnce(stub));

    it('stays locked until the password opens it, then keeps the token', async () => {
      mockUnlockStory.mockResolvedValue('tok');
      mockGetStory.mockResolvedValueOnce(story);
      const { result } = await renderHook(() => useShowcaseStory(source, 'S1'));
      await waitFor(() => expect(result.current.state.status).toBe('locked'));

      await act(async () => result.current.unlock('hunter2'));

      expect(mockUnlockStory).toHaveBeenCalledWith(source, 'S1', 'hunter2');
      expect(mockGetStory).toHaveBeenLastCalledWith(source, 'S1', 'tok');
      expect(result.current.state).toEqual({ status: 'open', story });
      expect(result.current.unlockToken).toBe('tok');
      expect(result.current.unlocking).toBe(false);
      expect(result.current.unlockFailure).toBeNull();
    });

    it('says why a try did not work, and clears it on the next', async () => {
      const { result } = await renderHook(() => useShowcaseStory(source, 'S1'));
      await waitFor(() => expect(result.current.state.status).toBe('locked'));

      mockUnlockStory.mockRejectedValueOnce(unlockError('wrong'));
      await act(async () => result.current.unlock('x'));
      expect(result.current.unlockFailure).toBe('wrong');
      expect(result.current.state.status).toBe('locked');

      mockUnlockStory.mockRejectedValueOnce(unlockError('locked'));
      await act(async () => result.current.unlock('x'));
      expect(result.current.unlockFailure).toBe('locked');

      mockUnlockStory.mockRejectedValueOnce(new Error('down'));
      await act(async () => result.current.unlock('x'));
      expect(result.current.unlockFailure).toBe('failed');
    });

    it('does not take the story as open when the server still answers with the stub', async () => {
      mockUnlockStory.mockResolvedValue('tok');
      mockGetStory.mockResolvedValueOnce(stub);
      const { result } = await renderHook(() => useShowcaseStory(source, 'S1'));
      await waitFor(() => expect(result.current.state.status).toBe('locked'));

      await act(async () => result.current.unlock('x'));

      expect(result.current.unlockFailure).toBe('failed');
      expect(result.current.unlockToken).toBeNull();
      expect(result.current.state.status).toBe('locked');
    });

    it('does nothing without a source', async () => {
      const { result } = await renderHook(() => useShowcaseStory(null, 'S1'));
      await act(async () => result.current.unlock('x'));
      expect(mockUnlockStory).not.toHaveBeenCalled();
    });
  });
});
