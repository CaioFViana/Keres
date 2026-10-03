import { z } from 'zod';
import { BILLING_INTERVALS, GIFT_MAX_MONTHS, SUBSCRIPTION_STATUSES } from '../metadata/Payments';

/** The person picked a plan, how often to pay, and a way to pay. */
export const CheckoutCreateSchema = z.object({
  tierId: z.string().min(1),
  interval: z.enum(BILLING_INTERVALS),
  methodId: z.string().min(1).max(64),
});
export type CheckoutCreate = z.infer<typeof CheckoutCreateSchema>;

export const ADMIN_SUBSCRIPTION_SORTS = ['paidUntil', 'createdAt', 'user'] as const;

export const AdminSubscriptionListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['all', ...SUBSCRIPTION_STATUSES]).default('all'),
  sort: z.enum(ADMIN_SUBSCRIPTION_SORTS).default('paidUntil'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminSubscriptionListQuery = z.infer<typeof AdminSubscriptionListQuerySchema>;

export const AdminPaymentEventListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminPaymentEventListQuery = z.infer<typeof AdminPaymentEventListQuerySchema>;

/**
 * An administrator gives a plan for a number of months. `cancelRenewal` is for a person whose paid subscription of
 * another plan would still be charged: it is stopped first, and only with `consent` - the administrator's word that
 * the person agreed to it.
 */
export const AdminGiftCreateSchema = z.object({
  tierId: z.string().min(1),
  months: z.coerce.number().int().min(1).max(GIFT_MAX_MONTHS),
  cancelRenewal: z.boolean().optional().default(false),
  consent: z.boolean().optional().default(false),
});
export type AdminGiftCreate = z.infer<typeof AdminGiftCreateSchema>;
