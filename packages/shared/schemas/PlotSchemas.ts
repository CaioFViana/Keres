import { z } from 'zod';

export const PlotSchema = z.object({
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

export const CreatePlotDataSchema = PlotSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  name: z.string().trim().min(1, 'Plot name cannot be empty'),
});

export const PartialPlotSchema = CreatePlotDataSchema.partial();

export type CreatePlotDataType = z.infer<typeof CreatePlotDataSchema>;
export type PlotType = z.infer<typeof PlotSchema>;
export type PartialPlotType = z.infer<typeof PartialPlotSchema>;
