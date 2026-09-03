import { z } from 'zod';

// PostgreSQL `integer` is the narrowest persistence target; keeping this bound in the shared
// contract prevents a local SQLite value from becoming impossible to synchronize later.
const SceneTimingValueSchema = z
  .number()
  .int('Scene timing must be a whole number')
  .finite('Scene timing must be finite')
  .min(-2147483648)
  .max(2147483647)
  .nullable();

/** Calendar coordinates stay syntactically valid even when a later calendar edit makes them out of bounds. */
const CalendarDateOverrideSchema = z
  .string()
  .regex(/^-?\d{1,}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Use YYYY-MM-DDTHH:mm')
  .nullable()
  .default(null);

export const SceneSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  /**
   * Which container this scene is told in. Null is a fragment: it exists, it is listed under
   * "Unchaptered", and it does not occupy a slot in any chapter's 1..N.
   */
  chapterId: z.string().nullable(),
  /**
   * Where the scene happens, when it happens anywhere in particular.
   *
   * Nullable since format V7: an era, a war, a rumour heard in three cities is a scene with no
   * single place, and requiring one was Keres deciding something about the story on the writer's
   * behalf - see `FEATURE_LANDSCAPE.md` section 2.1.
   */
  locationId: z.string().nullable(),
  name: z.string(),
  index: z.number(),
  summary: z.string().nullable(),
  gap: SceneTimingValueSchema,
  gapType: z.string().nullable(),
  calendarDateOverride: CalendarDateOverrideSchema,
  calendarDateOverrideCalendarId: z.string().nullable().default(null),
  duration: SceneTimingValueSchema,
  durationType: z.string().nullable(),
  isFinish: z.boolean(),
  isStart: z.boolean(),

  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateSceneDataSchema = SceneSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  name: z.string().min(1, 'Scene name cannot be empty'),
  // 1..N within the chapter, like the chapter index: it is what the API requires when reordering, and
  // accepting 0 here is what left creation and reordering with incompatible contracts.
  index: z.number().int().min(1, 'Index must be a positive integer starting from 1'),
  isFavorite: z.boolean().default(false),
  isStart: z.boolean().default(false),
  isFinish: z.boolean().default(false),
});

export const PartialSceneSchema = CreateSceneDataSchema.partial();

export type CreateSceneDataType = z.infer<typeof CreateSceneDataSchema>;
export type SceneType = z.infer<typeof SceneSchema>;
export type PartialSceneType = z.infer<typeof PartialSceneSchema>;
