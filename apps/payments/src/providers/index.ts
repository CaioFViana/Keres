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
): Array<'status' | 'cancel' | 'due'> {
  const capabilities: Array<'status' | 'cancel' | 'due'> = [];
  if (providers.some((provider) => provider.hasStatus)) capabilities.push('status');
  if (providers.some((provider) => provider.hasCancel)) capabilities.push('cancel');
  return capabilities;
}
