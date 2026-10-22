import { renderHook, waitFor } from '@testing-library/react-native';
import { useFriendAuthorPage } from '@/src/screens/enter-stack/social/useFriendAuthorPage';

const mockGetAuthorPage = jest.fn();

jest.mock('@/src/services/api/PublicationApiService', () => ({
  publicationApiService: {
    getAuthorPage: (...args: unknown[]) => mockGetAuthorPage(...args),
  },
}));

const server = { id: 'srv-1' } as never;
const page = { owner: { username: 'zoe' }, stories: [{ storyId: 's1' }] };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAuthorPage.mockResolvedValue(page);
});

describe('useFriendAuthorPage', () => {
  it("reads the friend's page from their server by the name they publish under", async () => {
    const { result } = await renderHook(() => useFriendAuthorPage(server, 'zoe', 1));

    await waitFor(() => expect(result.current).toEqual(page));
    expect(mockGetAuthorPage).toHaveBeenCalledWith(server, 'zoe');
  });

  it('has nothing while there is no server or no name to ask by', async () => {
    const { result } = await renderHook(() => useFriendAuthorPage(null, 'zoe', 1));
    expect(result.current).toBeNull();

    const nameless = await renderHook(() => useFriendAuthorPage(server, null, 1));
    expect(nameless.result.current).toBeNull();
    expect(mockGetAuthorPage).not.toHaveBeenCalled();
  });

  it('has nothing when the friend has no page to show', async () => {
    mockGetAuthorPage.mockResolvedValue(null);
    const { result } = await renderHook(() => useFriendAuthorPage(server, 'zoe', 1));

    await waitFor(() => expect(mockGetAuthorPage).toHaveBeenCalledTimes(1));
    expect(result.current).toBeNull();
  });

  it('reads again when the refresh key changes, and forgets the page when the name goes', async () => {
    const { result, rerender } = await renderHook(
      ({ key, name }: { key: number; name: string | null }) =>
        useFriendAuthorPage(server, name, key),
      { initialProps: { key: 1, name: 'zoe' as string | null } },
    );
    await waitFor(() => expect(result.current).toEqual(page));

    await rerender({ key: 2, name: 'zoe' });
    await waitFor(() => expect(mockGetAuthorPage).toHaveBeenCalledTimes(2));

    await rerender({ key: 3, name: null });
    expect(result.current).toBeNull();
  });

  it('does not take an answer that arrives after the screen moved on', async () => {
    let resolve: (value: unknown) => void = () => {};
    mockGetAuthorPage.mockReturnValue(new Promise((done) => (resolve = done)));
    const { result, unmount } = await renderHook(() => useFriendAuthorPage(server, 'zoe', 1));

    await unmount();
    resolve(page);
    await Promise.resolve();
    expect(result.current).toBeNull();
  });
});
