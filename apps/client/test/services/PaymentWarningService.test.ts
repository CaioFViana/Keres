/**
 * @jest-environment node
 */
const mockNotify = jest.fn();
const mockStorage = new Map<string, string>();
const mockStorageFails = { value: false };

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => {
      if (mockStorageFails.value) throw new Error('storage down');
      return mockStorage.get(key) ?? null;
    },
    setItem: async (key: string, value: string) => {
      if (mockStorageFails.value) throw new Error('storage down');
      mockStorage.set(key, value);
    },
  },
}));
jest.mock('../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: { getState: () => ({ showNotification: mockNotify }) },
}));
jest.mock('../../src/utils/i18n', () => ({
  __esModule: true,
  default: {
    language: 'en',
    t: (key: string, options?: Record<string, unknown>) => `${key}:${JSON.stringify(options)}`,
  },
}));

import { warnAboutPayment } from '../../src/services/PaymentWarningService';

const server = { id: 'server-1', name: 'Home' };
const now = new Date('2026-04-01T12:00:00.000Z');
const subscription = (over: Record<string, unknown> = {}) =>
  ({
    tierId: 't',
    tierName: 'Pro',
    interval: 'monthly',
    status: 'active',
    paidUntil: '2026-04-03T12:00:00.000Z',
    lastPaymentAt: null,
    amountCents: 1990,
    currency: 'BRL',
    cancelAtPeriodEnd: false,
    canCancelHere: true,
    ...over,
  }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockStorage.clear();
  mockStorageFails.value = false;
});

describe('warnAboutPayment', () => {
  it('reminds once that a payment is coming up, with the plan, the server and the days left', async () => {
    await expect(warnAboutPayment(server, subscription(), true, now)).resolves.toBe(true);

    expect(mockNotify).toHaveBeenCalledTimes(1);
    const [message, type] = mockNotify.mock.calls[0];
    expect(type).toBe('warning');
    expect(message).toContain('payment_warning_soon');
    expect(message).toContain('"plan":"Pro"');
    expect(message).toContain('"server":"Home"');
    expect(message).toContain('"count":2');
  });

  it('does not say it again for the same period, at the next start-up or after a nudge', async () => {
    await warnAboutPayment(server, subscription(), true, now);
    await expect(warnAboutPayment(server, subscription(), true, now)).resolves.toBe(false);

    expect(mockNotify).toHaveBeenCalledTimes(1);
  });

  it('says it again for the next period, and for a different kind of reminder', async () => {
    await warnAboutPayment(server, subscription(), true, now);
    await warnAboutPayment(
      server,
      subscription({ paidUntil: '2026-05-03T12:00:00.000Z' }),
      true,
      new Date('2026-05-01T12:00:00.000Z'),
    );
    await warnAboutPayment(server, subscription({ status: 'due' }), true, now);

    expect(mockNotify).toHaveBeenCalledTimes(3);
    expect(mockNotify.mock.calls[2][0]).toContain('payment_warning_due');
  });

  it('keeps servers apart', async () => {
    await warnAboutPayment(server, subscription(), true, now);
    await warnAboutPayment({ id: 'server-2', name: 'Work' }, subscription(), true, now);

    expect(mockNotify).toHaveBeenCalledTimes(2);
  });

  it('says nothing when the user did not allow reminders, and remembers nothing then', async () => {
    await expect(warnAboutPayment(server, subscription(), false, now)).resolves.toBe(false);
    expect(mockNotify).not.toHaveBeenCalled();

    // Allowed later: it is still news.
    await expect(warnAboutPayment(server, subscription(), true, now)).resolves.toBe(true);
  });

  it.each([
    ['no subscription', null],
    ['plenty of time left', subscription({ paidUntil: '2026-05-20T12:00:00.000Z' })],
    ['a subscription that will not renew', subscription({ cancelAtPeriodEnd: true })],
  ])('says nothing for %s', async (_label, value) => {
    await expect(warnAboutPayment(server, value as never, true, now)).resolves.toBe(false);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('stays silent rather than repeat itself when the device cannot remember', async () => {
    mockStorageFails.value = true;

    await expect(warnAboutPayment(server, subscription(), true, now)).resolves.toBe(false);
    expect(mockNotify).not.toHaveBeenCalled();
  });
});
