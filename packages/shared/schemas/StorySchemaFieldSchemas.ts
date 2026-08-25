import { z } from 'zod';
import { AttributeType } from '../metadata/AttributeType';
import { STORY_SCHEMA_ENTITY_TYPES } from '../metadata/StorySchemaEntityType';

/** lowercase, snake_case, starts with a letter - see `deriveAttributeKey` in `utils/attributeKey.ts`. */
export const AttributeKeyRegex = /^[a-z][a-z0-9_]*$/;

export const StorySchemaEntityTypeSchema = z.enum(STORY_SCHEMA_ENTITY_TYPES);
export const AttributeTypeSchema = z.nativeEnum(AttributeType);

function validateEntityAttribute(
  data: {
    type: AttributeType;
    targetEntityType: string | null;
    defaultValue: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (data.type === AttributeType.ENTITY) {
    if (data.targetEntityType === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetEntityType'],
        message: 'Entity attributes require a target entity type',
      });
    }
    if (data.defaultValue !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['defaultValue'],
        message: 'Entity attributes cannot have a default value',
      });
    }
  } else if (data.targetEntityType !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['targetEntityType'],
      message: 'Only entity attributes can have a target entity type',
    });
  }
}

const StorySchemaFieldBaseSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  entityType: StorySchemaEntityTypeSchema,
  name: z.string().min(1, 'Display name cannot be empty'),
  key: z
    .string()
    .regex(AttributeKeyRegex, 'Internal key must be lowercase snake_case starting with a letter'),
  description: z.string().nullable(),
  type: AttributeTypeSchema,
  // Exports created before entity attributes did not persist this property. Keep
  // parsing them compatible by materializing the historical null value.
  targetEntityType: StorySchemaEntityTypeSchema.nullable().default(null),
  isRequired: z.boolean(),
  defaultValue: z.string().nullable(),
  order: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const StorySchemaFieldSchema =
  StorySchemaFieldBaseSchema.superRefine(validateEntityAttribute);

export const CreateStorySchemaFieldDataSchema = StorySchemaFieldBaseSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
})
  .extend({
    description: z.string().nullable().default(null),
    targetEntityType: StorySchemaEntityTypeSchema.nullable().default(null),
    isRequired: z.boolean().default(false),
    defaultValue: z.string().nullable().default(null),
    order: z.number().int().default(0),
  })
  .superRefine(validateEntityAttribute);

// `partial()` keeps a nested Zod default active. Updates that do not mention
// targetEntityType must preserve it instead of materializing the legacy null.
export const PartialStorySchemaFieldSchema = StorySchemaFieldBaseSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
})
  .partial()
  .extend({
    targetEntityType: StorySchemaEntityTypeSchema.nullable().optional(),
  });

export type CreateStorySchemaFieldDataType = z.infer<typeof CreateStorySchemaFieldDataSchema>;
export type StorySchemaFieldType = z.infer<typeof StorySchemaFieldSchema>;
export type PartialStorySchemaFieldType = z.infer<typeof PartialStorySchemaFieldSchema>;
