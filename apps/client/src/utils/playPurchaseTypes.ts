/**
 * The seam between the plan screen and the device's store. The web build (and any platform without a
 * purchase runtime) gets a driver that refuses; the Android build gets the Play Billing one
 * (`playPurchase.android`). Metro picks the file per platform, so the web bundle never carries the
 * store SDK - the same split as the canvas web twins.
 */

export interface PlayPurchaseTicket {
  purchaseToken: string;
  productId: string;
}

/** A bought-but-unfinished purchase: the server has to confirm it before it is finished. */
export interface PlayPendingPurchase {
  ticket: PlayPurchaseTicket;
  /** Hands the purchase to the store as done. Call only after the server confirmed it. */
  finish(): Promise<void>;
}

export type PlayPurchaseFailureKind = 'unavailable' | 'cancelled' | 'misconfigured' | 'failed';

export class PlayPurchaseError extends Error {
  readonly kind: PlayPurchaseFailureKind;

  constructor(kind: PlayPurchaseFailureKind, message?: string) {
    super(message ?? kind);
    this.name = 'PlayPurchaseError';
    this.kind = kind;
  }
}

export interface NativePayDriver {
  /** False where no purchase runtime exists: buying is refused before anything store-side runs. */
  readonly available: boolean;
  /** The app's own package, as the store knows it: the token is verified against it. */
  packageName(): string;
  /**
   * Opens the store's purchase sheet for a subscription product and resolves with the bought
   * (unfinished) purchase. Throws `PlayPurchaseError`: `cancelled` when the person backs out,
   * `misconfigured` when the product has no offer to buy, `unavailable`/`failed` otherwise.
   */
  buySubscription(productId: string): Promise<PlayPendingPurchase>;
  /**
   * Finishes unfinished store purchases the server confirms (a bought plan whose app died before
   * telling the server, a purchase made on another device). Returns the confirmed tickets, so a
   * caller that only needs to know the purchase already went through can treat it as paid instead
   * of buying again (the store refuses an already-owned subscription).
   */
  reconcileUnfinished(
    verify: (ticket: PlayPurchaseTicket) => Promise<boolean>,
  ): Promise<PlayPurchaseTicket[]>;
}
