import type { Purchase } from 'expo-iap';

const mockInitConnection = jest.fn();
const mockEndConnection = jest.fn();
const mockFetchProducts = jest.fn();
const mockRequestPurchase = jest.fn();
const mockFinishTransaction = jest.fn();
const mockGetAvailablePurchases = jest.fn();
let updatedListener: ((purchase: Purchase) => void) | null = null;
let errorListener: ((error: { code: string }) => void) | null = null;

jest.mock('expo-application', () => ({ applicationId: 'com.test.app' }));
jest.mock('expo-iap', () => ({
  initConnection: (...args: unknown[]) => mockInitConnection(...args),
  endConnection: (...args: unknown[]) => mockEndConnection(...args),
  fetchProducts: (...args: unknown[]) => mockFetchProducts(...args),
  requestPurchase: (...args: unknown[]) => mockRequestPurchase(...args),
  finishTransaction: (...args: unknown[]) => mockFinishTransaction(...args),
  getAvailablePurchases: (...args: unknown[]) => mockGetAvailablePurchases(...args),
  purchaseUpdatedListener: (listener: (purchase: Purchase) => void) => {
    updatedListener = listener;
    return { remove: jest.fn() };
  },
  purchaseErrorListener: (listener: (error: { code: string }) => void) => {
    errorListener = listener;
    return { remove: jest.fn() };
  },
}));

// The platform file, directly: on iOS (and in this suite) the stub is resolved instead.
import { playDriver } from '../../src/utils/playPurchase.android';

const googlePurchase = (over: Record<string, unknown> = {}) =>
  ({
    store: 'google',
    productId: 'plus_monthly',
    purchaseToken: 'token-abc',
    ...over,
  }) as unknown as Purchase;

const androidProduct = (offers: { offerTokenAndroid: string | null }[]) =>
  ({
    platform: 'android',
    id: 'plus_monthly',
    type: 'subs',
    subscriptionOffers: offers,
  }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  updatedListener = null;
  errorListener = null;
  mockInitConnection.mockResolvedValue(true);
  mockEndConnection.mockResolvedValue(undefined);
  mockRequestPurchase.mockResolvedValue({});
  mockFinishTransaction.mockResolvedValue(undefined);
});

/** Lets the driver's awaits (including the deferred store import) settle. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('the Android store driver', () => {
  it('knows the app package the token is verified against', () => {
    expect(playDriver.available).toBe(true);
    expect(playDriver.packageName()).toBe('com.test.app');
  });

  it('buys the first offer of the product and finishes only on demand', async () => {
    mockFetchProducts.mockResolvedValue([androidProduct([{ offerTokenAndroid: 'offer-1' }])]);

    const bought = playDriver.buySubscription('plus_monthly');
    await flush();
    expect(mockRequestPurchase).toHaveBeenCalledWith({
      request: {
        google: {
          skus: ['plus_monthly'],
          subscriptionOffers: [{ sku: 'plus_monthly', offerToken: 'offer-1' }],
        },
      },
      type: 'subs',
    });
    updatedListener!(googlePurchase());

    const pending = await bought;
    expect(pending.ticket).toEqual({ purchaseToken: 'token-abc', productId: 'plus_monthly' });
    expect(mockFinishTransaction).not.toHaveBeenCalled();

    await pending.finish();
    expect(mockFinishTransaction).toHaveBeenCalledWith({
      purchase: googlePurchase(),
      isConsumable: false,
    });
    expect(mockEndConnection).toHaveBeenCalled();
  });

  it('refuses a product the store has no offer for', async () => {
    mockFetchProducts.mockResolvedValue([androidProduct([{ offerTokenAndroid: null }])]);

    await expect(playDriver.buySubscription('plus_monthly')).rejects.toMatchObject({
      kind: 'misconfigured',
    });
    expect(mockRequestPurchase).not.toHaveBeenCalled();
  });

  it('reports backing out of the sheet as cancelled, not failed', async () => {
    mockFetchProducts.mockResolvedValue([androidProduct([{ offerTokenAndroid: 'offer-1' }])]);

    const bought = playDriver.buySubscription('plus_monthly');
    await flush();
    errorListener!({ code: 'E_USER_CANCELLED' });

    await expect(bought).rejects.toMatchObject({ kind: 'cancelled' });
  });

  it('is unavailable when the store cannot be reached', async () => {
    mockInitConnection.mockRejectedValue(new Error('no billing client'));

    await expect(playDriver.buySubscription('plus_monthly')).rejects.toMatchObject({
      kind: 'unavailable',
    });
  });

  it('finishes unfinished purchases the server confirms, and leaves the rest', async () => {
    mockGetAvailablePurchases.mockResolvedValue([
      googlePurchase({ purchaseToken: 'token-old', productId: 'plus_monthly' }),
      googlePurchase({ purchaseToken: 'token-unknown', productId: 'other_product' }),
      { store: 'apple', productId: 'plus_monthly', purchaseToken: 'token-ios' },
    ]);
    const verify = jest.fn(
      async (ticket: { productId: string }) => ticket.productId === 'plus_monthly',
    );

    const finished = await playDriver.reconcileUnfinished(verify);

    expect(finished).toEqual([{ purchaseToken: 'token-old', productId: 'plus_monthly' }]);
    expect(mockFinishTransaction).toHaveBeenCalledTimes(1);
    expect(mockFinishTransaction).toHaveBeenCalledWith({
      purchase: googlePurchase({ purchaseToken: 'token-old', productId: 'plus_monthly' }),
      isConsumable: false,
    });
  });
});
