import { z } from 'zod';
import { AUDIT_CATEGORIES, AUDIT_OUTCOMES } from '../metadata/AuditEvents';

export const AUDIT_SORT_ORDERS = ['desc', 'asc'] as const;

/**
 * The activity list of the admin panel. `userId` matches the user as the actor and as the subject (the
 * one an action was done to), so a person's whole story is one filter.
 */
export const AuditEventListQuerySchema = z.object({
  category: z.enum(['all', ...AUDIT_CATEGORIES]).default('all'),
  outcome: z.enum(['all', ...AUDIT_OUTCOMES]).default('all'),
  /** A part of the action name (`login`, `message.`, `friend`...). */
  action: z.string().trim().optional(),
  userId: z.string().trim().optional(),
  /** Text in the action, the user names, the target and the address. */
  search: z.string().trim().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  order: z.enum(AUDIT_SORT_ORDERS).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type AuditEventListQuery = z.infer<typeof AuditEventListQuerySchema>;

/** The look at the last hours the summary takes; one day by default. */
export const AuditSummaryQuerySchema = z.object({
  hours: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 30)
    .default(24),
});
export type AuditSummaryQuery = z.infer<typeof AuditSummaryQuerySchema>;
