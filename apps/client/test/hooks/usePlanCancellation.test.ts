const mockCancel = jest.fn();
const mockAlert = jest.fn();
const mockIsOffline = jest.fn();

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));
jest.mock('../../src/services/apiClient', () => ({
  __esModule: true,
  isOfflineError: (error: unknown) => mockIsOffline(error),
}));
jest.mock('../../src/services/PaymentService', () => ({
  __esModule: true,
  cancelSubscription: (...args: unknown[]) => mockCancel(...args),
}));
jest.mock('../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

import { renderHook } from '@testing-library/react-native';
import { usePlanCancellation } from '../../src/hooks/usePlanCancellation';

const server = { id: 'server-1' } as never;
type Button = { text: string; onPress?: () => Promise<void> | void };
const buttons = (call = 0) => mockAlert.mock.calls[call][2] as Button[];

beforeEach(() => {
  jest.clearAllMocks();
  mockCancel.mockResolvedValue({ cancelAtPeriodEnd: true });
  mockIsOffline.mockReturnValue(false);
});

describe('usePlanCancellation', () => {
  it('asks first, saying the plan stays until its date', async () => {
    const { result } = await renderHook(() => usePlanCancellation(server, jest.fn()));

    result.current('2026-04-03T12:00:00.000Z');

    expect(mockAlert.mock.calls[0][0]).toBe('payment_cancel_title');
    expect(mockAlert.mock.calls[0][1]).toContain('payment_cancel_message');
    expect(mockAlert.mock.calls[0][1]).toContain('date');
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('asks in other words when the method is paid again each time, and cancels all the same', async () => {
    const onDone = jest.fn();
    const { result } = await renderHook(() => usePlanCancellation(server, onDone));

    result.current('2026-04-03T12:00:00.000Z', false);

    expect(mockAlert.mock.calls[0][0]).toBe('payment_cancel_no_renewal_title');
    expect(mockAlert.mock.calls[0][1]).toContain('payment_cancel_no_renewal_message');
    expect(buttons()[1].text).toBe('payment_cancel_no_renewal_confirm');
    await buttons()[1].onPress?.();
    expect(mockCancel).toHaveBeenCalledWith(server);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('stops the renewal when confirmed, and lets the screen read the plan again', async () => {
    const onDone = jest.fn();
    const { result } = await renderHook(() => usePlanCancellation(server, onDone));
    result.current('2026-04-03T12:00:00.000Z');

    await buttons()[1].onPress?.();

    expect(mockCancel).toHaveBeenCalledWith(server);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the user backs out', async () => {
    const { result } = await renderHook(() => usePlanCancellation(server, jest.fn()));
    result.current('2026-04-03T12:00:00.000Z');

    expect(buttons()[0].onPress).toBeUndefined();
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('says why it could not, and does not report it done', async () => {
    const onDone = jest.fn();
    mockCancel.mockRejectedValueOnce(new Error('502'));
    const { result } = await renderHook(() => usePlanCancellation(server, onDone));
    result.current('2026-04-03T12:00:00.000Z');

    await buttons()[1].onPress?.();
    expect(mockAlert).toHaveBeenLastCalledWith('error', 'payment_error_cancel_failed');

    mockIsOffline.mockReturnValue(true);
    mockCancel.mockRejectedValueOnce(new Error('offline'));
    await buttons()[1].onPress?.();
    expect(mockAlert).toHaveBeenLastCalledWith('error', 'payment_error_offline');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('asks nothing without a server', async () => {
    const { result } = await renderHook(() => usePlanCancellation(undefined, jest.fn()));

    result.current('2026-04-03T12:00:00.000Z');

    expect(mockAlert).not.toHaveBeenCalled();
  });
});
