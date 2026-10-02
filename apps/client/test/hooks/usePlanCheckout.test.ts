const mockStart = jest.fn();
const mockGet = jest.fn();
const mockOpenURL = jest.fn();
const mockIsOffline = jest.fn();

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'pt' } }),
}));
jest.mock('../../src/services/apiClient', () => ({
  __esModule: true,
  isOfflineError: (error: unknown) => mockIsOffline(error),
}));
jest.mock('../../src/services/PaymentService', () => ({
  __esModule: true,
  PAYMENTS_CHANGED: 'payments_changed',
  startCheckout: (...args: unknown[]) => mockStart(...args),
  getCheckout: (...args: unknown[]) => mockGet(...args),
}));

import { act, renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { CHECKOUT_POLL_MS, usePlanCheckout } from '../../src/hooks/usePlanCheckout';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const server = { id: 'server-1', name: 'Home', url: 'https://keres.test' } as never;
const request = { tierId: 'tier-1', interval: 'monthly' as const, methodId: 'pix' };
const checkout = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  status: 'pending',
  tierName: 'Pro',
  action: { kind: 'redirect', url: 'https://pay.example.test/c1' },
  failureReason: null,
  ...over,
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockIsOffline.mockReturnValue(false);
  jest.spyOn(Linking, 'openURL').mockImplementation((...args: unknown[]) => mockOpenURL(...args));
  mockStart.mockResolvedValue(checkout());
  mockGet.mockResolvedValue(checkout());
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const open = async () => {
  const view = await renderHook(() => usePlanCheckout(server));
  await act(async () => {
    await view.result.current.start(request);
  });
  return view;
};

describe('usePlanCheckout', () => {
  it('starts idle, and opens an attempt with the plan, the interval and the method and the user language', async () => {
    const { result } = await renderHook(() => usePlanCheckout(server));
    expect(result.current.phase).toBe('idle');

    await act(async () => {
      await result.current.start(request);
    });

    expect(mockStart).toHaveBeenCalledWith(server, request, 'pt');
    expect(result.current.phase).toBe('pending');
    expect(result.current.checkout?.id).toBe('c1');
    expect(result.current.error).toBeNull();
  });

  it('shows that it is starting while the server answers', async () => {
    let release!: (value: unknown) => void;
    mockStart.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const { result } = await renderHook(() => usePlanCheckout(server));

    let started!: Promise<void>;
    await act(async () => {
      started = result.current.start(request);
    });
    expect(result.current.phase).toBe('starting');
    await act(async () => {
      release(checkout());
      await started;
    });

    expect(result.current.phase).toBe('pending');
  });

  it('goes back to choosing, with the reason, when the payment could not be started', async () => {
    mockStart.mockRejectedValueOnce(new Error('502'));
    const { result } = await renderHook(() => usePlanCheckout(server));
    await act(async () => {
      await result.current.start(request);
    });
    expect(result.current.phase).toBe('idle');
    expect(result.current.error).toBe('payment_error_start_failed');

    mockIsOffline.mockReturnValue(true);
    mockStart.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await result.current.start(request);
    });
    expect(result.current.error).toBe('payment_error_offline');
  });

  it('asks how it ended on a timer, and stops once it is paid', async () => {
    const { result } = await open();
    mockGet.mockResolvedValue(checkout({ status: 'paid', action: null }));

    await act(async () => {
      jest.advanceTimersByTime(CHECKOUT_POLL_MS);
    });

    expect(mockGet).toHaveBeenCalledWith(server, 'c1');
    expect(result.current.phase).toBe('paid');
    mockGet.mockClear();
    await act(async () => {
      jest.advanceTimersByTime(CHECKOUT_POLL_MS * 3);
    });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it.each(['failed', 'expired'] as const)('knows when the attempt %s', async (status) => {
    const { result } = await open();
    mockGet.mockResolvedValue(checkout({ status, action: null, failureReason: 'Declined' }));

    await act(async () => {
      jest.advanceTimersByTime(CHECKOUT_POLL_MS);
    });

    expect(result.current.phase).toBe(status);
    expect(result.current.checkout?.failureReason).toBe('Declined');
  });

  it('keeps waiting when a look fails: a missed look is not a failed payment', async () => {
    const { result } = await open();
    mockGet.mockRejectedValueOnce(new Error('offline'));

    await act(async () => {
      jest.advanceTimersByTime(CHECKOUT_POLL_MS);
    });

    expect(result.current.phase).toBe('pending');
  });

  it('looks at once when the server says a payment changed, not on another server', async () => {
    await open();
    mockGet.mockClear();

    await act(async () => {
      entityEventEmitter.emit('payments_changed', 'another-server');
    });
    expect(mockGet).not.toHaveBeenCalled();
    await act(async () => {
      entityEventEmitter.emit('payments_changed', 'server-1');
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('opens the provider’s page for a redirect, and says so when it cannot', async () => {
    const { result } = await open();

    await act(async () => {
      await result.current.openProviderPage();
    });
    expect(mockOpenURL).toHaveBeenCalledWith('https://pay.example.test/c1');

    mockOpenURL.mockRejectedValueOnce(new Error('no browser'));
    await act(async () => {
      await result.current.openProviderPage();
    });
    expect(result.current.error).toBe('payment_error_open_failed');
  });

  it('has nothing to open for instructions', async () => {
    mockStart.mockResolvedValue(
      checkout({ action: { kind: 'instructions', title: 'PIX', text: 'Pay it', copyText: 'abc' } }),
    );
    const { result } = await open();

    await act(async () => {
      await result.current.openProviderPage();
    });

    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  it('goes back to choosing on reset, and ignores what an abandoned attempt was still going to say', async () => {
    let release!: (value: unknown) => void;
    const { result } = await open();
    mockGet.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    await act(async () => {
      jest.advanceTimersByTime(CHECKOUT_POLL_MS);
    });

    await act(async () => result.current.reset());
    await act(async () => {
      release(checkout({ status: 'paid' }));
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.checkout).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('does nothing without a server', async () => {
    const { result } = await renderHook(() => usePlanCheckout(undefined));

    await act(async () => {
      await result.current.start(request);
    });

    expect(mockStart).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
  });
});
