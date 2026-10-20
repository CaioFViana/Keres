import { renderHook, waitFor } from '@testing-library/react-native';
import { useServerStoryUsage } from '@/src/screens/enter-stack/servers/useServerStoryUsage';
import { withSilencedConsole } from '@/test/helpers/silenceConsole';

const mockCountOwned = jest.fn();
// Stable, like the real client: a new object on every render would read the stories again forever.
const mockDrizzle = {};
jest.mock('@/src/db', () => ({ useDrizzle: () => mockDrizzle }));
jest.mock('@/src/services/storymanagement/story-lifecycle/StoryEntityCountService', () => ({
  __esModule: true,
  createStoryEntityCountService: () => ({
    countOwnedOnServer: (...args: unknown[]) => mockCountOwned(...args),
  }),
}));

const usage = [{ id: 'a', title: 'Alpha', total: 4 }];

beforeEach(() => {
  jest.clearAllMocks();
  mockCountOwned.mockResolvedValue(usage);
});

describe('useServerStoryUsage', () => {
  it('counts the own stories of the server once it is active', async () => {
    const { result } = await renderHook(() => useServerStoryUsage('srv-1', true));

    await waitFor(() => expect(result.current.stories).toEqual(usage));
    expect(mockCountOwned).toHaveBeenCalledWith('srv-1');
  });

  it('does not count while the screen is not in front, nor without a server', async () => {
    const hidden = await renderHook(() => useServerStoryUsage('srv-1', false));
    const none = await renderHook(() => useServerStoryUsage(undefined, true));

    expect(mockCountOwned).not.toHaveBeenCalled();
    expect(hidden.result.current.stories).toEqual([]);
    expect(none.result.current.stories).toEqual([]);
  });

  it('counts again when the screen comes back to the front', async () => {
    const { result, rerender } = await renderHook(
      ({ active }: { active: boolean }) => useServerStoryUsage('srv-1', active),
      { initialProps: { active: true } },
    );
    await waitFor(() => expect(result.current.stories).toEqual(usage));

    mockCountOwned.mockResolvedValue([{ id: 'a', title: 'Alpha', total: 9 }]);
    await rerender({ active: false });
    await rerender({ active: true });

    await waitFor(() => expect(result.current.stories[0].total).toBe(9));
  });

  it('shows nothing when the count fails', async () => {
    mockCountOwned.mockRejectedValue(new Error('db'));

    await withSilencedConsole(['warn'], async (spies) => {
      const { result } = await renderHook(() => useServerStoryUsage('srv-1', true));
      await waitFor(() => expect(spies.warn).toHaveBeenCalled());
      expect(result.current.stories).toEqual([]);
    });
  });
});
