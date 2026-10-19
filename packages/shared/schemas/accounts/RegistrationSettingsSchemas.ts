import { z } from 'zod';
import { TIERS_DISPLAYS } from '../../metadata/TiersDisplay';
import { UlidSchema } from '../sync/SyncSchemas';

/** ISO-4217 alphabetic code (`BRL`, `USD`, `EUR`): the one currency of the whole system. */
export const CurrencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO code, e.g. BRL');

/** How the landing page presents the plans: priced for sale, or information only. */
export const TiersDisplaySchema = z.enum(TIERS_DISPLAYS);

// `RegistrationSettings` (the full-row type) is `entities/RegistrationSettings.ts` - not
// re-inferred here, to avoid a duplicate export colliding with it through the package barrel.
export const RegistrationSettingsSchema = z.object({
  id: z.string(),
  isRegistrationOpen: z.boolean(),
  /** `null` = no user ceiling. */
  maxUsers: z.number().int().positive().nullable(),
  /** When true, `isRegistrationOpen` is recomputed on every signup from `maxUsers`. */
  autoManage: z.boolean(),
  allowNsfw: z.boolean(),
  defaultTierId: UlidSchema.nullable(),
  currency: CurrencySchema,
  /** `info` lists the plans with no prices and nothing for sale. */
  tiersDisplay: TiersDisplaySchema,
  updatedAt: z.coerce.date(),
});

export const UpdateRegistrationSettingsSchema = z.object({
  isRegistrationOpen: z.boolean().optional(),
  maxUsers: z.number().int().positive().nullable().optional(),
  autoManage: z.boolean().optional(),
  allowNsfw: z.boolean().optional(),
  defaultTierId: UlidSchema.nullable().optional(),
  currency: CurrencySchema.optional(),
  tiersDisplay: TiersDisplaySchema.optional(),
});
export type UpdateRegistrationSettings = z.infer<typeof UpdateRegistrationSettingsSchema>;
