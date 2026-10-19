import type { PaymentConnector } from '@keres/shared/payments/PaymentConnector';

/**
 * The payment connector this server sells through, if there is one: set when the server has connected to it (see
 * `connector/startConnector.ts`), and by the tests.
 *
 * The server must work exactly as before with none: every payments route answers "not enabled" and the clients
 * show nothing about payments. And it keeps working while the connector is away - a connector that is down or
 * wrong is reported in the log and the server carries on, because a payment service that cannot be reached must not
 * take the stories on it down.
 */
let current: PaymentConnector | null = null;

export function getPaymentConnector(): PaymentConnector | null {
  return current;
}

export function setPaymentConnector(connector: PaymentConnector | null): void {
  current = connector;
}
