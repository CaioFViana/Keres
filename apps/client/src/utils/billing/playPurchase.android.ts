import * as Application from 'expo-application';
import type { Purchase } from 'expo-iap';
import {
  PlayPurchaseError,
  type NativePayDriver,
  type PlayPendingPurchase,
  type PlayPurchaseTicket,
} from './playPurchaseTypes';

/**
 * Google Play Billing, through `expo-iap`. The purchase sheet itself is the Play Store's - this only
 * opens it, takes the purchase token to the server, and finishes the purchase once the server
 * confirmed it (Android refunds purchases left unfinished for 3 days).
 *
 * `expo-iap` is imported late on purpose: the module is only resolvable where the store SDK is linked
 * (a dev build or production). Anywhere else - Expo Go included - the import fails and buying is
 * refused with `unavailable` instead of crashing the screen.
 */

type ExpoIap = typeof import('expo-iap');

async function loadIap(): Promise<ExpoIap> {
  try {
    return await import('expo-iap');
  } catch {
    throw new PlayPurchaseError(
      'unavailable',
      'In-app purchases need a build with the store SDK linked.',
    );
  }
}

function ticketOf(purchase: Purchase): PlayPurchaseTicket {
  if (purchase.store !== 'google') {
    throw new PlayPurchaseError('failed', 'The purchase is not from Google Play.');
  }
  const purchaseToken = purchase.purchaseToken;
  if (!purchaseToken) throw new PlayPurchaseError('failed', 'The store answered without a token.');
  return { purchaseToken, productId: purchase.productId };
}

export const playDriver: NativePayDriver = {
  available: true,

  packageName(): string {
    return Application.applicationId ?? '';
  },

  async buySubscription(productId: string): Promise<PlayPendingPurchase> {
    const iap = await loadIap();
    try {
      await iap.initConnection();
    } catch {
      throw new PlayPurchaseError('unavailable', 'Could not reach the store.');
    }
    try {
      const products = (await iap.fetchProducts({ skus: [productId], type: 'subs' })) ?? [];
      const product = products.find(
        (candidate) => candidate.platform === 'android' && candidate.id === productId,
      );
      const offers =
        product && 'subscriptionOffers' in product ? (product.subscriptionOffers ?? []) : [];
      const offerToken = offers.find((offer) => offer.offerTokenAndroid)?.offerTokenAndroid ?? null;
      if (!product || !offerToken) {
        throw new PlayPurchaseError(
          'misconfigured',
          'The store has no offer to buy for this plan.',
        );
      }
      const purchase = await new Promise<Purchase>((resolve, reject) => {
        const done = purchaseListener(iap, resolve, reject);
        void iap
          .requestPurchase({
            request: {
              google: { skus: [productId], subscriptionOffers: [{ sku: productId, offerToken }] },
            },
            type: 'subs',
          })
          .catch((error: unknown) => {
            done();
            reject(mappedRequestError(error));
          });
        function purchaseListener(
          module: ExpoIap,
          resolvePurchase: (value: Purchase) => void,
          rejectPurchase: (reason: unknown) => void,
        ): () => void {
          const updated = module.purchaseUpdatedListener((next) => {
            cleanup();
            resolvePurchase(next);
          });
          const failed = module.purchaseErrorListener((error) => {
            cleanup();
            rejectPurchase(mappedPurchaseError(error));
          });
          const cleanup = () => {
            updated.remove();
            failed.remove();
          };
          return cleanup;
        }
      });
      const ticket = ticketOf(purchase);
      return {
        ticket,
        finish: async () => {
          await iap.finishTransaction({ purchase, isConsumable: false });
        },
      };
    } finally {
      await iap.endConnection().catch(() => undefined);
    }
  },

  async reconcileUnfinished(
    verify: (ticket: PlayPurchaseTicket) => Promise<boolean>,
  ): Promise<PlayPurchaseTicket[]> {
    const iap = await loadIap();
    try {
      await iap.initConnection();
    } catch {
      return [];
    }
    try {
      const held = (await iap.getAvailablePurchases()) ?? [];
      const finished: PlayPurchaseTicket[] = [];
      for (const purchase of held) {
        if (purchase.store !== 'google') continue;
        let ticket: PlayPurchaseTicket;
        try {
          ticket = ticketOf(purchase);
        } catch {
          continue;
        }
        let confirmed = false;
        try {
          confirmed = await verify(ticket);
        } catch {
          continue;
        }
        if (!confirmed) continue;
        try {
          await iap.finishTransaction({ purchase, isConsumable: false });
          finished.push(ticket);
        } catch {
          // Left for the next pass: finishing is retried, never forced.
        }
      }
      return finished;
    } catch {
      return [];
    } finally {
      await iap.endConnection().catch(() => undefined);
    }
  },
};

function mappedRequestError(error: unknown): PlayPurchaseError {
  if (isCancelled(error)) return new PlayPurchaseError('cancelled');
  return new PlayPurchaseError(
    'failed',
    error instanceof Error ? error.message : 'The purchase could not start.',
  );
}

function mappedPurchaseError(error: { code?: unknown; message?: string }): PlayPurchaseError {
  if (isCancelled(error)) return new PlayPurchaseError('cancelled');
  return new PlayPurchaseError('failed', error.message ?? 'The purchase failed.');
}

function isCancelled(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code: unknown }).code ?? '');
    if (/cancel/i.test(code)) return true;
  }
  return error instanceof Error && /cancel/i.test(error.message);
}
