/**
 * @jest-environment node
 */
const mockApi = {
  getInfo: jest.fn(),
  getPlans: jest.fn(),
  startCheckout: jest.fn(),
  getCheckout: jest.fn(),
  cancelSubscription: jest.fn(),
};
jest.mock('../../src/services/PaymentApiService', () => ({
  __esModule: true,
  paymentApi: {
    getInfo: (...args: unknown[]) => mockApi.getInfo(...args),
    getPlans: (...args: unknown[]) => mockApi.getPlans(...args),
    startCheckout: (...args: unknown[]) => mockApi.startCheckout(...args),
    getCheckout: (...args: unknown[]) => mockApi.getCheckout(...args),
    cancelSubscription: (...args: unknown[]) => mockApi.cancelSubscription(...args),
  },
}));

import {
  cancelSubscription,
  getCheckout,
  loadPaymentOverview,
  PAYMENTS_CHANGED,
  startCheckout,
} from '../../src/services/PaymentService';

const server = { id: 'server-1', name: 'Home', url: 'https://keres.test' } as never;
const info = (over: Record<string, unknown> = {}) => ({
  enabled: true,
  provider: { id: 'p', displayName: 'Pay' },
  currency: 'BRL',
  methods: [],
  subscription: null,
  ...over,
});

beforeEach(() => jest.resetAllMocks());

describe('loadPaymentOverview', () => {
  it('reads what the server says and the plans it sells', async () => {
    mockApi.getInfo.mockResolvedValue(info());
    mockApi.getPlans.mockResolvedValue({ currency: 'BRL', tiers: [] });

    await expect(loadPaymentOverview(server)).resolves.toEqual({
      info: info(),
      plans: { currency: 'BRL', tiers: [] },
    });
  });

  it('has nothing to show for a server that sells no plans, and does not even read its plans', async () => {
    mockApi.getInfo.mockResolvedValue(info({ enabled: false, provider: null }));

    await expect(loadPaymentOverview(server)).resolves.toBeNull();
    expect(mockApi.getPlans).not.toHaveBeenCalled();
  });

  it('treats a server that has no such route (an older one) as one that sells nothing', async () => {
    mockApi.getInfo.mockRejectedValue({ response: { status: 404 } });

    await expect(loadPaymentOverview(server)).resolves.toBeNull();
  });

  it('lets a server that cannot be reached say so, for the caller to stay quiet about', async () => {
    mockApi.getInfo.mockRejectedValue(new Error('offline'));

    await expect(loadPaymentOverview(server)).rejects.toThrow('offline');
  });

  it('still shows the subscription when only the list of plans could not be read', async () => {
    mockApi.getInfo.mockResolvedValue(info());
    mockApi.getPlans.mockRejectedValue(new Error('no plans'));

    await expect(loadPaymentOverview(server)).resolves.toEqual({ info: info(), plans: null });
  });
});

describe('the attempt and the subscription', () => {
  it('hands each call to the server it is about', async () => {
    mockApi.startCheckout.mockResolvedValue({ id: 'c1' });
    mockApi.getCheckout.mockResolvedValue({ id: 'c1', status: 'paid' });
    mockApi.cancelSubscription.mockResolvedValue({ cancelAtPeriodEnd: true });
    const request = { tierId: 't', interval: 'monthly' as const, methodId: 'pix' };

    await startCheckout(server, request, 'pt');
    await getCheckout(server, 'c1');
    await cancelSubscription(server);

    expect(mockApi.startCheckout).toHaveBeenCalledWith(server, request, 'pt');
    expect(mockApi.getCheckout).toHaveBeenCalledWith(server, 'c1');
    expect(mockApi.cancelSubscription).toHaveBeenCalledWith(server);
  });

  it('names the event the screens listen to', () => {
    expect(PAYMENTS_CHANGED).toBe('payments_changed');
  });
});
