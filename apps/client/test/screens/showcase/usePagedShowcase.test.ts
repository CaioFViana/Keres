import { act, renderHook, waitFor } from '@testing-library/react-native';
import { usePagedShowcase } from '@/src/screens/showcase/usePagedShowcase';
import { SHOWCASE_PAGE_SIZE } from '@/src/utils/format/showcaseFilters';

const fetchPage = jest.fn();
const page = (from: number, count: number, total: number | null) => ({
  items: Array.from({ length: count }, (_, at) => from + at),
  total,
});

beforeEach(() => {
  jest.clearAllMocks();
  fetchPage.mockResolvedValue(page(0, 3, 3));
});

describe('usePagedShowcase', () => {
  it('reads the first page', async () => {
    const { result } = await renderHook(() => usePagedShowcase('q', fetchPage, true));

    await waitFor(() => expect(result.current.items).toEqual([0, 1, 2]));
    expect(fetchPage).toHaveBeenCalledWith(0, SHOWCASE_PAGE_SIZE);
    expect(result.current).toMatchObject({
      total: 3,
      loading: false,
      failed: false,
      hasMore: false,
    });
  });

  it('reads nothing while disabled', async () => {
    const { result } = await renderHook(() => usePagedShowcase('q', fetchPage, false));

    expect(fetchPage).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
  });

  it('asks for the next page when the server says there are more, and adds it to the list', async () => {
    fetchPage.mockResolvedValueOnce(page(0, SHOWCASE_PAGE_SIZE, SHOWCASE_PAGE_SIZE + 2));
    const { result } = await renderHook(() => usePagedShowcase('q', fetchPage, true));
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    fetchPage.mockResolvedValueOnce(page(SHOWCASE_PAGE_SIZE, 2, SHOWCASE_PAGE_SIZE + 2));
    await act(async () => result.current.loadMore());

    await waitFor(() => expect(result.current.items).toHaveLength(SHOWCASE_PAGE_SIZE + 2));
    expect(fetchPage).toHaveBeenLastCalledWith(SHOWCASE_PAGE_SIZE, SHOWCASE_PAGE_SIZE);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.loadingMore).toBe(false);
  });

  it('takes a full page as maybe more when the server does not say how many there are', async () => {
    fetchPage.mockResolvedValueOnce(page(0, SHOWCASE_PAGE_SIZE, null));
    const { result } = await renderHook(() => usePagedShowcase('q', fetchPage, true));
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    fetchPage.mockResolvedValueOnce(page(SHOWCASE_PAGE_SIZE, 5, null));
    await act(async () => result.current.loadMore());

    await waitFor(() => expect(result.current.hasMore).toBe(false));
  });

  it('does nothing on "more" when there is no more, or while one is on its way', async () => {
    const { result } = await renderHook(() => usePagedShowcase('q', fetchPage, true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.loadMore());
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('starts over when the query changes, and drops the answer to the old one', async () => {
    let resolveOld: (value: unknown) => void = () => {};
    fetchPage.mockReturnValueOnce(new Promise((resolve) => (resolveOld = resolve)));
    const { result, rerender } = await renderHook(
      ({ key }: { key: string }) => usePagedShowcase(key, fetchPage, true),
      { initialProps: { key: 'old' } },
    );

    fetchPage.mockResolvedValueOnce(page(100, 1, 1));
    await rerender({ key: 'new' });
    await waitFor(() => expect(result.current.items).toEqual([100]));

    await act(async () => resolveOld(page(0, 2, 2)));
    expect(result.current.items).toEqual([100]);
  });

  it('says it failed, and reads again on request', async () => {
    fetchPage.mockRejectedValueOnce(new Error('down'));
    const { result } = await renderHook(() => usePagedShowcase('q', fetchPage, true));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.items).toEqual([]);

    await act(async () => result.current.reload());

    await waitFor(() => expect(result.current.items).toEqual([0, 1, 2]));
    expect(result.current.failed).toBe(false);
  });

  it('says it failed when more could not be read, keeping what it has', async () => {
    fetchPage.mockResolvedValueOnce(page(0, SHOWCASE_PAGE_SIZE, 100));
    const { result } = await renderHook(() => usePagedShowcase('q', fetchPage, true));
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    fetchPage.mockRejectedValueOnce(new Error('down'));
    await act(async () => result.current.loadMore());

    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.items).toHaveLength(SHOWCASE_PAGE_SIZE);
  });
});
