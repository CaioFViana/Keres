import { z } from 'zod';
import { SEE_ALSO_ENTITY_TYPES } from '../metadata/SeeAlsoEntityType';

export const SeeAlsoEntityTypeSchema = z.enum(SEE_ALSO_ENTITY_TYPES);

export const SeeAlsoRelationSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  entityAType: SeeAlsoEntityTypeSchema,
  entityAId: z.string(),
  entityBType: SeeAlsoEntityTypeSchema,
  entityBId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateSeeAlsoRelationDataSchema = SeeAlsoRelationSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
})
  .extend({
    entityAId: z.string().min(1, 'Entity A ID cannot be empty'),
    entityBId: z.string().min(1, 'Entity B ID cannot be empty'),
  })
  .refine((data) => !(data.entityAType === data.entityBType && data.entityAId === data.entityBId), {
    message: 'An entity cannot be See-Also-linked to itself.',
    path: ['entityBId'],
  });

export const PartialSeeAlsoRelationSchema = SeeAlsoRelationSchema.partial().refine(
  (data) => {
    if (data.entityAType && data.entityAId && data.entityBType && data.entityBId) {
      return !(data.entityAType === data.entityBType && data.entityAId === data.entityBId);
    }
    return true;
  },
  {
    message: 'An entity cannot be See-Also-linked to itself.',
    path: ['entityBId'],
  },
);

export type CreateSeeAlsoRelationDataType = z.infer<typeof CreateSeeAlsoRelationDataSchema>;
export type SeeAlsoRelationSchemaType = z.infer<typeof SeeAlsoRelationSchema>;
export type PartialSeeAlsoRelationType = z.infer<typeof PartialSeeAlsoRelationSchema>;
