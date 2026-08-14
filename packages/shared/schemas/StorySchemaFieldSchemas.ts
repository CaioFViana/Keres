import { z } from 'zod';
import { AttributeType } from '../metadata/AttributeType';
import { STORY_SCHEMA_ENTITY_TYPES } from '../metadata/StorySchemaEntityType';

/** lowercase, snake_case, começa com letra - ver `deriveAttributeKey` em `utils/attributeKey.ts`. */
export const AttributeKeyRegex = /^[a-z][a-z0-9_]*$/;

export const StorySchemaEntityTypeSchema = z.enum(STORY_SCHEMA_ENTITY_TYPES);
export const AttributeTypeSchema = z.nativeEnum(AttributeType);

export const StorySchemaFieldSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  entityType: StorySchemaEntityTypeSchema,
  name: z.string().min(1, 'Display name cannot be empty'),
  key: z
    .string()
    .regex(AttributeKeyRegex, 'Internal key must be lowercase snake_case starting with a letter'),
  description: z.string().nullable(),
  type: AttributeTypeSchema,
  isRequired: z.boolean(),
  defaultValue: z.string().nullable(),
  order: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateStorySchemaFieldDataSchema = StorySchemaFieldSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  description: z.string().nullable().default(null),
  isRequired: z.boolean().default(false),
  defaultValue: z.string().nullable().default(null),
  order: z.number().int().default(0),
});

export const PartialStorySchemaFieldSchema = StorySchemaFieldSchema.partial();

export type CreateStorySchemaFieldDataType = z.infer<typeof CreateStorySchemaFieldDataSchema>;
export type StorySchemaFieldType = z.infer<typeof StorySchemaFieldSchema>;
export type PartialStorySchemaFieldType = z.infer<typeof PartialStorySchemaFieldSchema>;
