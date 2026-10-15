import { z } from 'zod';

export const RouteSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string(),
  details: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateRouteDataSchema = RouteSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  name: z.string().trim().min(1, 'Route name cannot be empty'),
});

export const PartialRouteSchema = CreateRouteDataSchema.partial();
export type CreateRouteDataType = z.infer<typeof CreateRouteDataSchema>;
export type RouteType = z.infer<typeof RouteSchema>;

export const RouteStepSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  routeId: z.string(),
  position: z.number().int().positive(),
  sceneId: z.string(),
  selectedChoiceId: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateRouteStepDataSchema = RouteStepSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
});
export const PartialRouteStepSchema = CreateRouteStepDataSchema.partial();
export type CreateRouteStepDataType = z.infer<typeof CreateRouteStepDataSchema>;
export type RouteStepType = z.infer<typeof RouteStepSchema>;
