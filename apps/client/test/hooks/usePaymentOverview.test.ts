const mockLoad = jest.fn();
jest.mock('../../src/services/PaymentService', () => ({
  __esModule: true,
  PAYMENTS_CHANGED: 'payments_changed',
  loadPaymentOverview: (...args: unknown[]) => mockLoad(...args),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { usePaymentOverview } from '../../src/hooks/usePaymentOverview';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const server = { id: 'server-1', name: 'Home', url: 'https://keres.test' } as never;
const overview = (name = 'Pro') => ({
  info: { enabled: true, subscription: { tierName: name } },
  plans: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockLoad.mockResolvedValue(overview());
});

describe('usePaymentOverview', () => {
  it('reads what the server says about payments once it answers', async () => {
    const { result } = await renderHook(() => usePaymentOverview(server, true));

    await waitFor(() => expect(result.current.overview).toEqual(overview()));
    expect(mockLoad).toHaveBeenCalledWith(server);
    expect(result.current.loading).toBe(false);
  });

  it('asks nothing while the server is not answering, or when there is no server', async () => {
    const offline = await renderHook(() => usePaymentOverview(server, false));
    const missing = await renderHook(() => usePaymentOverview(undefined, true));
    await act(async () => {});

    expect(mockLoad).not.toHaveBeenCalled();
    expect(offline.result.current.overview).toBeNull();
    expect(missing.result.current.overview).toBeNull();
  });

  it('shows nothing, and says nothing, when the server sells no plans or cannot be reached', async () => {
    mockLoad.mockResolvedValueOnce(null);
    const sells = await renderHook(() => usePaymentOverview(server, true));
    await waitFor(() => expect(mockLoad).toHaveBeenCalledTimes(1));
    expect(sells.result.current.overview).toBeNull();

    mockLoad.mockRejectedValueOnce(new Error('offline'));
    const down = await renderHook(() => usePaymentOverview(server, true));
    await waitFor(() => expect(mockLoad).toHaveBeenCalledTimes(2));
    expect(down.result.current.overview).toBeNull();
    expect(down.result.current.loading).toBe(false);
  });

  it('forgets what it knew when the server stops answering', async () => {
    const { result, rerender } = await renderHook(
      ({ online }: { online: boolean }) => usePaymentOverview(server, online),
      { initialProps: { online: true } },
    );
    await waitFor(() => expect(result.current.overview).not.toBeNull());

    await rerender({ online: false });

    await waitFor(() => expect(result.current.overview).toBeNull());
  });

  it('reads again when the server says a payment changed on it, and only on it', async () => {
    const { result } = await renderHook(() => usePaymentOverview(server, true));
    await waitFor(() => expect(result.current.overview).toEqual(overview()));
    mockLoad.mockResolvedValue(overview('Plus'));

    await act(async () => {
      entityEventEmitter.emit('payments_changed', 'another-server');
    });
    expect(mockLoad).toHaveBeenCalledTimes(1);

    await act(async () => {
      entityEventEmitter.emit('payments_changed', 'server-1');
    });
    await waitFor(() => expect(result.current.overview).toEqual(overview('Plus')));
    expect(mockLoad).toHaveBeenCalledTimes(2);
  });

  it('does not let a slow, older answer overwrite a newer one', async () => {
    let releaseFirst!: (value: unknown) => void;
    mockLoad.mockReset();
    mockLoad.mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)));
    const { result } = await renderHook(() => usePaymentOverview(server, true));
    await waitFor(() => expect(mockLoad).toHaveBeenCalledTimes(1));
    mockLoad.mockResolvedValueOnce(overview('Newer'));

    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.overview).toEqual(overview('Newer'));
    await act(async () => {
      releaseFirst(overview('Older'));
    });

    expect(result.current.overview).toEqual(overview('Newer'));
  });
});
