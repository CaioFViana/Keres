import type {
  Checkout,
  CheckoutCreate,
  PaymentsInfo,
  PublicTiersResponse,
  Subscription,
} from '@keres/shared';
import type { ServerSelect } from '../db/schemas/servers';
import { createKeresAxiosInstance } from './apiClient';
import { authTokenManager } from './AuthTokenManager';

/**
 * Payments live on one server each, and what a server says about them (whether it sells plans, which plan
 * the user has, until when) is only true of that server: the same reason `MessageApiService` builds a client
 * bound to the target server rather than using the shared one.
 *
 * Nothing here ever carries a way to pay. The user picks a plan, how often and a method; the server answers
 * with what to do next (open a page, follow instructions) and the payment itself happens at the provider.
 */
export class PaymentApiService {
  private clientFor(server: ServerSelect) {
    const client = createKeresAxiosInstance({ baseURL: server.url });
    client.setTokenProvider(authTokenManager);
    client.setActiveServer(server);
    return client;
  }

  async getInfo(server: ServerSelect): Promise<PaymentsInfo> {
    const response = await this.clientFor(server).get('/payments');
    return response.data;
  }

  /** The plans on sale, with prices: the same list the server's landing page shows. */
  async getPlans(server: ServerSelect): Promise<PublicTiersResponse> {
    const response = await this.clientFor(server).get('/public/tiers');
    return response.data;
  }

  async startCheckout(
    server: ServerSelect,
    request: CheckoutCreate,
    language: string,
  ): Promise<Checkout> {
    const response = await this.clientFor(server).post('/payments/checkout', request, {
      // The provider's page and messages come in the language the person uses here.
      headers: { 'Accept-Language': language || 'en' },
    });
    return response.data;
  }

  async getCheckout(server: ServerSelect, checkoutId: string): Promise<Checkout> {
    const response = await this.clientFor(server).get(
      `/payments/checkout/${encodeURIComponent(checkoutId)}`,
    );
    return response.data;
  }

  async cancelSubscription(server: ServerSelect): Promise<Subscription> {
    const response = await this.clientFor(server).post('/payments/subscription/cancel');
    return response.data;
  }
}

export const paymentApi = new PaymentApiService();
