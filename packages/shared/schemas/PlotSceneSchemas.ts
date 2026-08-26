import { z } from 'zod';
import { PLOT_SCENE_NOTE_MAX_LENGTH } from '../entities/PlotScene';

const plotSceneNoteSchema = z
  .string()
  .trim()
  .min(1, 'Plot-scene note cannot be empty')
  .max(
    PLOT_SCENE_NOTE_MAX_LENGTH,
    `Plot-scene note must be ${PLOT_SCENE_NOTE_MAX_LENGTH} characters or fewer`,
  )
  .refine((value) => !/[\r\n]/.test(value), 'Plot-scene note must be a single line');

export const PlotSceneSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  plotId: z.string(),
  sceneId: z.string(),
  note: plotSceneNoteSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreatePlotSceneDataSchema = PlotSceneSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
});

export const PartialPlotSceneSchema = CreatePlotSceneDataSchema.partial();

export type CreatePlotSceneDataType = z.infer<typeof CreatePlotSceneDataSchema>;
export type PlotSceneType = z.infer<typeof PlotSceneSchema>;
export type PartialPlotSceneType = z.infer<typeof PartialPlotSceneSchema>;
