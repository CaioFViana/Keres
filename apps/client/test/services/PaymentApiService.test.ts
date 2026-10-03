/**
 * @jest-environment node
 */
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockSetActiveServer = jest.fn();

jest.mock('../../src/services/AuthTokenManager', () => ({
  __esModule: true,
  authTokenManager: {},
}));
jest.mock('../../src/services/apiClient', () => ({
  __esModule: true,
  createKeresAxiosInstance: () => ({
    setTokenProvider: jest.fn(),
    setActiveServer: (...args: unknown[]) => mockSetActiveServer(...args),
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  }),
}));

import { paymentApi } from '../../src/services/PaymentApiService';

const server = { id: 'server-1', url: 'https://keres.test' } as never;

beforeEach(() => jest.clearAllMocks());

describe('PaymentApiService', () => {
  it('reads what the given server says about payments and the plans it sells', async () => {
    mockGet.mockResolvedValueOnce({ data: { enabled: true } });
    mockGet.mockResolvedValueOnce({ data: { currency: 'BRL', tiers: [] } });

    await expect(paymentApi.getInfo(server)).resolves.toEqual({ enabled: true });
    await expect(paymentApi.getPlans(server)).resolves.toEqual({ currency: 'BRL', tiers: [] });

    expect(mockGet).toHaveBeenNthCalledWith(1, '/payments');
    expect(mockGet).toHaveBeenNthCalledWith(2, '/public/tiers');
    expect(mockSetActiveServer).toHaveBeenCalledWith(server);
  });

  it('opens an attempt with only the plan, the interval and the method, in the language of the user', async () => {
    mockPost.mockResolvedValue({ data: { id: 'c1', status: 'pending' } });
    const request = { tierId: 't1', interval: 'monthly' as const, methodId: 'pix' };

    await expect(paymentApi.startCheckout(server, request, 'pt')).resolves.toMatchObject({
      id: 'c1',
    });

    expect(mockPost).toHaveBeenCalledWith('/payments/checkout', request, {
      headers: { 'Accept-Language': 'pt' },
    });
  });

  it('asks what changing plan would do to the time left, and reads nothing as nothing', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        quote: { fromTierName: 'Plus', toTierName: 'Max', remainingDays: 20, convertedDays: 7 },
      },
    });
    mockGet.mockResolvedValueOnce({ data: { quote: null } });
    mockGet.mockResolvedValueOnce({ data: null });

    await expect(paymentApi.getSwitchQuote(server, 't2', 'monthly')).resolves.toMatchObject({
      convertedDays: 7,
    });
    await expect(paymentApi.getSwitchQuote(server, 't2', 'monthly')).resolves.toBeNull();
    await expect(paymentApi.getSwitchQuote(server, 't2', 'monthly')).resolves.toBeNull();

    expect(mockGet).toHaveBeenNthCalledWith(1, '/payments/switch-quote', {
      params: { tierId: 't2', interval: 'monthly' },
    });
  });

  it('falls back to English when it has no language', async () => {
    mockPost.mockResolvedValue({ data: {} });

    await paymentApi.startCheckout(server, { tierId: 't', interval: 'yearly', methodId: 'm' }, '');

    expect(mockPost.mock.calls[0][2]).toEqual({ headers: { 'Accept-Language': 'en' } });
  });

  it('follows an attempt by its id, escaped, and stops a renewal', async () => {
    mockGet.mockResolvedValue({ data: { id: 'c/1', status: 'paid' } });
    mockPost.mockResolvedValue({ data: { cancelAtPeriodEnd: true } });

    await paymentApi.getCheckout(server, 'c/1');
    await expect(paymentApi.cancelSubscription(server)).resolves.toEqual({
      cancelAtPeriodEnd: true,
    });

    expect(mockGet).toHaveBeenCalledWith('/payments/checkout/c%2F1');
    expect(mockPost).toHaveBeenCalledWith('/payments/subscription/cancel');
  });
});
