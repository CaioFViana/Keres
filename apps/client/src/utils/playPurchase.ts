import {
  PlayPurchaseError,
  type NativePayDriver,
  type PlayPurchaseTicket,
} from './playPurchaseTypes';

/**
 * No purchase runtime here (web, desktop, anywhere but the Android app): buying is refused before
 * anything store-side runs, and there is nothing unfinished to reconcile.
 */
export const playDriver: NativePayDriver = {
  available: false,

  packageName(): string {
    return '';
  },

  async buySubscription(): Promise<never> {
    throw new PlayPurchaseError('unavailable');
  },

  async reconcileUnfinished(
    _verify: (ticket: PlayPurchaseTicket) => Promise<boolean>,
  ): Promise<PlayPurchaseTicket[]> {
    return [];
  },
};
