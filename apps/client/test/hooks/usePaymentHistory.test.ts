const mockGetForServer = jest.fn();
const mockSync = jest.fn();
const mockDb = {};

jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../src/services/PaymentHistoryService', () => ({
  __esModule: true,
  createPaymentHistoryService: () => ({
    getForServer: (...args: unknown[]) => mockGetForServer(...args),
    syncWithServer: (...args: unknown[]) => mockSync(...args),
  }),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { usePaymentHistory } from '../../src/hooks/usePaymentHistory';
import { entityEventEmitter } from '../../src/utils/EventEmitter';
import { PAYMENTS_CHANGED } from '../../src/utils/paymentEvents';

const server = { id: 'srv-1', name: 'Main', url: 'https://a.example' } as never;
const saved = [{ id: 'p1', serverId: 'srv-1', kind: 'payment_succeeded' }];
const fresh = [...saved, { id: 'p2', serverId: 'srv-1', kind: 'payment_succeeded' }];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetForServer.mockResolvedValue(saved);
  mockSync.mockResolvedValue('synced');
});

describe('usePaymentHistory', () => {
  it("shows what is saved at once, then the server's answer once it is brought in", async () => {
    const { result } = await renderHook(() => usePaymentHistory(server, true));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.items).toEqual(saved);

    mockGetForServer.mockResolvedValue(fresh);
    await act(async () => {
      await result.current.refresh();
    });

    expect(mockSync).toHaveBeenCalledWith(server);
    expect(result.current.items).toEqual(fresh);
    expect(result.current.stale).toBe(false);
  });

  it('only reads the saved copy while the server cannot be asked, and says it is that copy', async () => {
    const { result } = await renderHook(() => usePaymentHistory(server, false));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(mockSync).not.toHaveBeenCalled();
    expect(result.current.items).toEqual(saved);
    expect(result.current.stale).toBe(true);
  });

  it('keeps the saved copy on screen, marked as such, when the server fails', async () => {
    mockSync.mockRejectedValue(new Error('500'));
    const { result } = await renderHook(() => usePaymentHistory(server, true));
    await waitFor(() => expect(result.current.failed).toBe(true));

    expect(result.current.items).toEqual(saved);
    expect(result.current.stale).toBe(true);
  });

  it('brings in a payment the server says was just made', async () => {
    const { result } = await renderHook(() => usePaymentHistory(server, true));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    mockSync.mockClear();
    mockGetForServer.mockResolvedValue(fresh);

    await act(async () => {
      entityEventEmitter.emit(PAYMENTS_CHANGED, 'srv-1');
    });
    await waitFor(() => expect(result.current.items).toEqual(fresh));
    expect(mockSync).toHaveBeenCalledTimes(1);

    // Another server's payment is none of this screen's business.
    mockSync.mockClear();
    await act(async () => {
      entityEventEmitter.emit(PAYMENTS_CHANGED, 'srv-other');
    });
    expect(mockSync).not.toHaveBeenCalled();
  });
});
