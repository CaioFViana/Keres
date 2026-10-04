const mockStart = jest.fn();
const mockGet = jest.fn();
const mockVerify = jest.fn();
const mockBuy = jest.fn();
const mockReconcile = jest.fn();
const mockFinish = jest.fn();
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
  verifyPlayPurchase: (...args: unknown[]) => mockVerify(...args),
}));
jest.mock('../../src/utils/playPurchase', () => ({
  __esModule: true,
  playDriver: {
    available: true,
    packageName: () => 'com.test.app',
    buySubscription: (...args: unknown[]) => mockBuy(...args),
    reconcileUnfinished: (...args: unknown[]) => mockReconcile(...args),
  },
}));

import { act, renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { CHECKOUT_POLL_MS, usePlanCheckout } from '../../src/hooks/usePlanCheckout';
import { entityEventEmitter } from '../../src/utils/EventEmitter';
import { PlayPurchaseError } from '../../src/utils/playPurchaseTypes';

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
  mockVerify.mockResolvedValue({ active: true, subscription: null });
  mockFinish.mockResolvedValue(undefined);
  mockBuy.mockResolvedValue({
    ticket: { purchaseToken: 'token-abc', productId: 'plus_monthly' },
    finish: (...args: unknown[]) => mockFinish(...args),
  });
  mockReconcile.mockResolvedValue([]);
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

describe('usePlanCheckout natively (the store sheet)', () => {
  const native = {
    tierId: 'tier-pro',
    interval: 'monthly' as const,
    methodId: 'playbilling',
    productId: 'plus_monthly',
    packageName: 'com.test.app',
    planName: 'Pro',
    tiers: [
      {
        id: 'tier-pro',
        name: 'Pro',
        playMonthlyProductId: 'plus_monthly',
        playYearlyProductId: null,
      },
    ],
  };

  it('buys, checks the token with the server and finishes once it is confirmed', async () => {
    const { result } = await renderHook(() => usePlanCheckout(server));

    await act(async () => {
      await result.current.startNative(native);
    });

    expect(mockBuy).toHaveBeenCalledWith('plus_monthly');
    expect(mockVerify).toHaveBeenCalledWith(server, {
      tierId: 'tier-pro',
      interval: 'monthly',
      productId: 'plus_monthly',
      purchaseToken: 'token-abc',
      packageName: 'com.test.app',
    });
    expect(mockFinish).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('paid');
    expect(result.current.paidPlanName).toBe('Pro');
    expect(result.current.error).toBeNull();
  });

  it('goes quietly back to choosing when the person backs out of the sheet', async () => {
    mockBuy.mockRejectedValueOnce(new PlayPurchaseError('cancelled'));
    const { result } = await renderHook(() => usePlanCheckout(server));

    await act(async () => {
      await result.current.startNative(native);
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.error).toBeNull();
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('says the store is missing when buying is refused there', async () => {
    mockBuy.mockRejectedValueOnce(new PlayPurchaseError('unavailable'));
    const { result } = await renderHook(() => usePlanCheckout(server));

    await act(async () => {
      await result.current.startNative(native);
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.error).toBe('payment_error_play_unavailable');
  });

  it('picks up a purchase the server already confirmed instead of buying again', async () => {
    mockReconcile.mockImplementationOnce(async (verify: unknown) => {
      const confirm = verify as (ticket: unknown) => Promise<boolean>;
      const ok = await confirm({ purchaseToken: 'token-old', productId: 'plus_monthly' });
      return ok ? [{ purchaseToken: 'token-old', productId: 'plus_monthly' }] : [];
    });
    const { result } = await renderHook(() => usePlanCheckout(server));

    await act(async () => {
      await result.current.startNative(native);
    });

    expect(result.current.phase).toBe('paid');
    expect(result.current.paidPlanName).toBe('Pro');
    expect(mockBuy).not.toHaveBeenCalled();
    expect(mockVerify).toHaveBeenCalledWith(server, {
      tierId: 'tier-pro',
      interval: 'monthly',
      productId: 'plus_monthly',
      purchaseToken: 'token-old',
      packageName: 'com.test.app',
    });
  });

  it('says the store did not confirm the purchase, and finishes nothing', async () => {
    mockVerify.mockResolvedValueOnce({ active: false, subscription: null });
    const { result } = await renderHook(() => usePlanCheckout(server));

    await act(async () => {
      await result.current.startNative(native);
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.error).toBe('payment_error_play_inactive');
    expect(mockFinish).not.toHaveBeenCalled();
  });
});
