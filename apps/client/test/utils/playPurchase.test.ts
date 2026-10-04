import { playDriver } from '../../src/utils/playPurchase';

describe('the stub store driver (no purchase runtime here)', () => {
  it('is unavailable, refuses to buy and has nothing to reconcile', async () => {
    expect(playDriver.available).toBe(false);
    expect(playDriver.packageName()).toBe('');

    await expect(playDriver.buySubscription('plus_monthly')).rejects.toMatchObject({
      kind: 'unavailable',
    });
    await expect(playDriver.reconcileUnfinished(async () => true)).resolves.toEqual([]);
  });
});
