import { z } from 'zod';
import { ChapterSchema } from './ChapterSchemas';
import { CharacterSchema } from './CharacterSchemas';
import { ChapterAnchorSchema } from './ChapterAnchorSchemas';
import { StoryCalendarSchema } from './StoryCalendarSchemas';
import { StoryArcSchema } from './StoryArcSchemas';
import { BoardSchema } from './BoardSchemas';
import { LocationMapSchema } from './LocationMapSchemas';
import { CharacterRelationSchema } from './CharacterRelationSchemas';
import { CharacterSceneSchema } from './CharacterSceneSchemas';
import { PlotSchema } from './PlotSchemas';
import { PlotSceneSchema } from './PlotSceneSchemas';
import { RouteSchema, RouteStepSchema } from './RouteSchemas';
import { ChoiceSchema } from './ChoiceSchemas';
import { ChoiceCheckGroupSchema } from './ChoiceCheckGroupSchemas';
import { ChoiceCheckSchema } from './ChoiceCheckSchemas';
import { EffectSchema } from './EffectSchemas';
import { GalleryRelationSchema, GallerySchema } from './GallerySchemas';
import { ItemJourneySchema } from './ItemJourneySchemas';
import { ItemSchema } from './ItemSchemas';
import { LocationSchema } from './LocationSchemas';
import { LocationRelationSchema } from './LocationRelationSchemas';
import { NoteSchema } from './NoteSchemas';
import { SceneSchema } from './SceneSchemas';
import { StorySchema } from './StorySchemas';
import { SuggestionSchema } from './SuggestionSchemas';
import { TagRelationSchema } from './TagRelationSchemas';
import { TagSchema } from './TagSchemas';
import { WorldRuleSchema } from './WorldRuleSchemas';
import { NoteRelationSchema } from './NoteRelationSchemas';
import { ModeSchema } from './ModeSchemas';
import { StatRelationSchema, StatSchema, StatStrengthSchema } from './StatSchemas';
import { CURRENT_STORY_FORMAT_VERSION } from './StoryExportVersion';
import { StorySchemaFieldSchema } from './StorySchemaFieldSchemas';
import { AttributeValueSchema } from './AttributeValueSchemas';
import { FavoriteSchema } from './FavoriteSchemas';
import { CommentSchema } from './CommentSchemas';
import { SeeAlsoRelationSchema } from './SeeAlsoRelationSchemas';

/**
 * A portable story: the `story` row plus every related entity as an array, with the server's
 * `lastOperationVersion` and the package's `formatVersion`.
 *
 * Never parsed raw: `migrateStoryExport` runs first (both in the client and in the API) and fills
 * every collection a newer format added, so a required array means "present since format V1" and
 * an optional one means "introduced later" - each optional field below names its version. Adding a
 * collection without that treatment (migration + optional + version note) breaks imports of every
 * older package.
 */
export const FullStoryExportSchema = z.object({
  story: StorySchema,
  chapters: z.array(ChapterSchema),
  scenes: z.array(SceneSchema),
  choices: z.array(ChoiceSchema),
  characters: z.array(CharacterSchema),
  locations: z.array(LocationSchema),
  worldRules: z.array(WorldRuleSchema),
  notes: z.array(NoteSchema),
  noteRelations: z.array(NoteRelationSchema),
  tags: z.array(TagSchema),
  tagRelations: z.array(TagRelationSchema),
  suggestions: z.array(SuggestionSchema),
  characterRelations: z.array(CharacterRelationSchema),
  // Introduced in format V7; earlier migrations provide an empty list.
  chapterAnchors: z.array(ChapterAnchorSchema).optional(),
  // Introduced in format V8; earlier migrations provide an empty list.
  storyCalendars: z.array(StoryCalendarSchema).optional(),
  // Optional so packages from before Arcs remain importable.
  storyArcs: z.array(StoryArcSchema).optional(),
  // Optional so packages from before Boards remain importable (format bump waits for release).
  storyBoards: z.array(BoardSchema).optional(),
  // Optional so packages from before Location Maps remain importable.
  storyLocationMaps: z.array(LocationMapSchema).optional(),
  characterScenes: z.array(CharacterSceneSchema),
  // Introduced in format V6; earlier migrations provide empty lists.
  plots: z.array(PlotSchema).optional(),
  plotScenes: z.array(PlotSceneSchema).optional(),
  // Introduced in format V9; legacy packages have no authored routes.
  routes: z.array(RouteSchema).optional(),
  routeSteps: z.array(RouteStepSchema).optional(),
  galleryItems: z.array(GallerySchema),
  // Optional so packages generated before the gallery became N:N remain importable.
  galleryRelations: z.array(GalleryRelationSchema).optional(),
  items: z.array(ItemSchema).optional(),
  itemJourneys: z.array(ItemJourneySchema),
  // Optional to keep legacy exports predating these features importable.
  storySchemaFields: z.array(StorySchemaFieldSchema).optional(),
  attributeValues: z.array(AttributeValueSchema).optional(),
  // Introduced in format V2; the V1 -> V2 migration provides an empty list when absent.
  favorites: z.array(FavoriteSchema).optional(),
  // Introduced in format V3; earlier migrations provide empty lists.
  comments: z.array(CommentSchema).optional(),
  seeAlsoRelations: z.array(SeeAlsoRelationSchema).optional(),
  // Same reason: legacy exports without this feature remain importable.
  locationRelations: z.array(LocationRelationSchema).optional(),
  // Introduced in format V4 (Choice checks/effects); earlier migrations provide empty lists.
  choiceCheckGroups: z.array(ChoiceCheckGroupSchema).optional(),
  choiceChecks: z.array(ChoiceCheckSchema).optional(),
  effects: z.array(EffectSchema).optional(),
  // Introduced in format V5 (the stat system and modes); earlier migrations provide empty lists.
  stats: z.array(StatSchema).optional(),
  statStrengths: z.array(StatStrengthSchema).optional(),
  statRelations: z.array(StatRelationSchema).optional(),
  modes: z.array(ModeSchema).optional(),
  serverLastOperationVersion: z.number().int().min(0),
  // Absent from exports predating this field - `migrateStoryExport` normalises it to
  // `CURRENT_STORY_FORMAT_VERSION` before this validation runs, so the default here is only a safety
  // net for callers that skip the migration.
  formatVersion: z.number().int().min(1).default(CURRENT_STORY_FORMAT_VERSION),
  // Add other entities as they are defined in the schema
});

export type FullStoryExportType = z.infer<typeof FullStoryExportSchema>;
