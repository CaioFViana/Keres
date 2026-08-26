import { z } from 'zod';
import { UlidSchema } from './SyncSchemas';

// `RegistrationSettings` (the full-row type) is `entities/RegistrationSettings.ts` - not
// re-inferred here, to avoid a duplicate export colliding with it through the package barrel.
export const RegistrationSettingsSchema = z.object({
  id: z.string(),
  isRegistrationOpen: z.boolean(),
  /** `null` = no user ceiling. */
  maxUsers: z.number().int().positive().nullable(),
  /** When true, `isRegistrationOpen` is recomputed on every signup from `maxUsers`. */
  autoManage: z.boolean(),
  defaultTierId: UlidSchema.nullable(),
  updatedAt: z.coerce.date(),
});

export const UpdateRegistrationSettingsSchema = z.object({
  isRegistrationOpen: z.boolean().optional(),
  maxUsers: z.number().int().positive().nullable().optional(),
  autoManage: z.boolean().optional(),
  defaultTierId: UlidSchema.nullable().optional(),
});
export type UpdateRegistrationSettings = z.infer<typeof UpdateRegistrationSettingsSchema>;
