import type { z } from 'zod';
import {
  type CheckoutRequestWireSchema,
  type CheckoutResultWireSchema,
  type ConnectorInfo,
  type DueSubscriptionWireSchema,
  type PaymentEventWire,
  type PaymentMethodOptionSchema,
} from '@keres/shared';

/**
 * Wire types of the connector contract. The schemas live in `@keres/shared` (the same ones
 * the Keres server validates with); the row types below are inferred from them so the two
 * sides cannot drift.
 */
export type { ConnectorInfo, PaymentEventWire };
export type CheckoutRequestWire = z.infer<typeof CheckoutRequestWireSchema>;
export type CheckoutResultWire = z.infer<typeof CheckoutResultWireSchema>;
export type DueSubscriptionWire = z.infer<typeof DueSubscriptionWireSchema>;
export type PaymentMethodOption = z.infer<typeof PaymentMethodOptionSchema>;
/**
 * What a provider may return from `methods()`: `flow` is optional on the way in (an older
 * provider says nothing and means `redirect`) and always present on the wire - the route
 * validates with the schema, which fills the default.
 */
export type PaymentMethodOptionInput = z.input<typeof PaymentMethodOptionSchema>;
