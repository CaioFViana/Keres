import type { PaymentsConfig } from '../config';
import { createMockProvider, mockEnabled } from './mock';
import { createPayPalProvider } from './paypal';
import { createStripeProvider } from './stripe';
import type { Provider } from './types';

/**
 * The providers this service sells through: PayPal directly, Google Pay through Stripe
 * Checkout. A provider whose keys are absent is not registered - its method is simply not
 * listed, and a checkout naming it is refused as unknown.
 */
export function activeProviders(config: PaymentsConfig): Provider[] {
  const providers: Provider[] = [];
  if (config.paypal) providers.push(createPayPalProvider());
  if (config.stripe) providers.push(createStripeProvider());
  if (mockEnabled(config.publicBaseUrl)) providers.push(createMockProvider());
  return providers;
}

export function providerFor(
  providers: readonly Provider[],
  methodId: string,
): Provider | undefined {
  return providers.find((provider) => provider.methodIds.includes(methodId));
}

export function connectorCapabilities(
  providers: readonly Provider[],
  config?: PaymentsConfig,
): Array<'status' | 'cancel' | 'due' | 'reconcile'> {
  const capabilities: Array<'status' | 'cancel' | 'due' | 'reconcile'> = [];
  if (providers.some((provider) => provider.hasStatus)) capabilities.push('status');
  // Cancelling is also what stops a store subscription, once the app's package is known (a cancel names only the token).
  const cancelsStore = Boolean(config?.play && (config.play.packageName || config.play.mock));
  if (providers.some((provider) => provider.hasCancel) || cancelsStore) capabilities.push('cancel');
  if (providers.some((provider) => provider.hasReconcile)) capabilities.push('reconcile');
  return capabilities;
}
