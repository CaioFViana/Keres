import { z } from 'zod';

export const EffectSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  entityType: z.enum(['Scene', 'Choice']),
  entityId: z.string(),
  effectType: z.enum(['itemGrant', 'itemTake', 'triggerSet', 'triggerUnset']),
  itemId: z.string().nullable(),
  triggerName: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateEffectDataSchema = EffectSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  entityType: z.enum(['Scene', 'Choice']),
  entityId: z.string().min(1, 'Entity ID cannot be empty'),
  effectType: z.enum(['itemGrant', 'itemTake', 'triggerSet', 'triggerUnset']),
  itemId: z.string().nullable().default(null),
  triggerName: z.string().nullable().default(null),
});

export const PartialEffectSchema = CreateEffectDataSchema.partial();

export type CreateEffectDataType = z.infer<typeof CreateEffectDataSchema>;
export type EffectType = z.infer<typeof EffectSchema>;
export type PartialEffectType = z.infer<typeof PartialEffectSchema>;
