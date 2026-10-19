import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { servers } from './servers';

/**
 * Local copy of a person's payment history on each server, like `story_invitations`: what was last seen
 * stays readable offline, and a sync replaces a server's rows with the server's answer. The server is the
 * only source - nothing here is ever written by the device - so there is no merge and no sync engine.
 *
 * `id` is the server's own id for the payment (a ULID). Nothing of the provider is ever kept: no reference,
 * no token, no way to pay.
 */
export const serverPayments = sqliteTable('server_payments', {
  id: text('id').primaryKey(),
  serverId: text('server_id')
    .notNull()
    .references(() => servers.id),
  kind: text('kind', {
    enum: ['payment_succeeded', 'payment_refunded', 'payment_failed', 'gift_granted'],
  }).notNull(),
  tierName: text('tier_name'),
  /** Minor units of `currency`; null for a line with no amount (a failure). */
  amountCents: integer('amount_cents'),
  currency: text('currency'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type ServerPaymentInsert = InferInsertModel<typeof serverPayments>;
export type ServerPaymentSelect = InferSelectModel<typeof serverPayments>;
