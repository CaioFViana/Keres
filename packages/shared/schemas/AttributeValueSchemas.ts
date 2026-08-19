import { z } from 'zod';
import { StorySchemaEntityTypeSchema } from './StorySchemaFieldSchemas';

export const AttributeValueSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  entityType: StorySchemaEntityTypeSchema,
  entityId: z.string(),
  fieldId: z.string(),
  value: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateAttributeValueDataSchema = AttributeValueSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  value: z.string().nullable().default(null),
});

export const PartialAttributeValueSchema = CreateAttributeValueDataSchema.partial();

export type CreateAttributeValueDataType = z.infer<typeof CreateAttributeValueDataSchema>;
export type AttributeValueType = z.infer<typeof AttributeValueSchema>;
export type PartialAttributeValueType = z.infer<typeof PartialAttributeValueSchema>;
