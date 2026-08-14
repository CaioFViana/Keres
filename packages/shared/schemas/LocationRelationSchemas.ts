import { z } from 'zod';
import { LOCATION_RELATION_TYPES } from '../metadata/LocationRelationType';

export const LocationRelationSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  locationAId: z.string(),
  locationBId: z.string(),
  relationType: z.enum(LOCATION_RELATION_TYPES),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateLocationRelationDataSchema = LocationRelationSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
})
  .extend({
    locationAId: z.string().min(1, 'Location A ID cannot be empty'),
    locationBId: z.string().min(1, 'Location B ID cannot be empty'),
  })
  .refine((data) => data.locationAId !== data.locationBId, {
    message: 'Location A ID and Location B ID cannot be identical.',
    path: ['locationBId'],
  });

export const PartialLocationRelationSchema = LocationRelationSchema.partial().refine(
  (data) => {
    if (data.locationAId && data.locationBId) {
      return data.locationAId !== data.locationBId;
    }
    return true; // If only one or neither is present, defer this check to full schema or handler
  },
  {
    message: 'Location A ID and Location B ID cannot be identical.',
    path: ['locationBId'],
  },
);

export type CreateLocationRelationDataType = z.infer<typeof CreateLocationRelationDataSchema>;
export type LocationRelationSchemaType = z.infer<typeof LocationRelationSchema>;
export type PartialLocationRelationType = z.infer<typeof PartialLocationRelationSchema>;
