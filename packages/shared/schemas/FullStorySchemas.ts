import { z } from 'zod';
import { ChapterSchema } from './ChapterSchemas'; // Adjusted path
import { CharacterSchema } from './CharacterSchemas'; // Adjusted path
import { CharacterRelationSchema } from './CharacterRelationSchemas'; // Adjusted path
import { CharacterSceneSchema } from './CharacterSceneSchemas'; // Adjusted path
import { PlotSchema } from './PlotSchemas';
import { PlotSceneSchema } from './PlotSceneSchemas';
import { ChoiceSchema } from './ChoiceSchemas'; // Adjusted path
import { ChoiceCheckGroupSchema } from './ChoiceCheckGroupSchemas';
import { ChoiceCheckSchema } from './ChoiceCheckSchemas';
import { EffectSchema } from './EffectSchemas';
import { GalleryRelationSchema, GallerySchema } from './GallerySchemas'; // Adjusted path
import { ItemJourneySchema } from './ItemJourneySchemas'; // Adjusted path
import { ItemSchema } from './ItemSchemas'; // Adjusted path
import { LocationSchema } from './LocationSchemas'; // Adjusted path
import { LocationRelationSchema } from './LocationRelationSchemas';
import { NoteSchema } from './NoteSchemas'; // Adjusted path
import { SceneSchema } from './SceneSchemas'; // Adjusted path
import { StorySchema } from './StorySchemas'; // Adjusted path
import { SuggestionSchema } from './SuggestionSchemas'; // Adjusted path
import { TagRelationSchema } from './TagRelationSchemas'; // Adjusted path
import { TagSchema } from './TagSchemas'; // Adjusted path
import { WorldRuleSchema } from './WorldRuleSchemas'; // Adjusted path
import { NoteRelationSchema } from './NoteRelationSchemas';
import { ModeSchema } from './ModeSchemas';
import { StatRelationSchema, StatSchema, StatStrengthSchema } from './StatSchemas';
import { CURRENT_STORY_FORMAT_VERSION } from './StoryExportVersion';
import { StorySchemaFieldSchema } from './StorySchemaFieldSchemas';
import { AttributeValueSchema } from './AttributeValueSchemas';
import { FavoriteSchema } from './FavoriteSchemas';
import { CommentSchema } from './CommentSchemas';
import { SeeAlsoRelationSchema } from './SeeAlsoRelationSchemas';

// This schema defines the structure for a full story export/import.
// It includes the main story object and all its related entities as arrays.
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
  characterScenes: z.array(CharacterSceneSchema),
  // Introduzidos no formato V6; migrações anteriores fornecem listas vazias.
  plots: z.array(PlotSchema).optional(),
  plotScenes: z.array(PlotSceneSchema).optional(),
  galleryItems: z.array(GallerySchema),
  // Opcional para que pacotes gerados antes da galeria virar N:N continuem importáveis.
  galleryRelations: z.array(GalleryRelationSchema).optional(),
  items: z.array(ItemSchema).optional(),
  itemJourneys: z.array(ItemJourneySchema),
  // Opcionais para manter importáveis exports legados que antecedem esses recursos.
  storySchemaFields: z.array(StorySchemaFieldSchema).optional(),
  attributeValues: z.array(AttributeValueSchema).optional(),
  // Introduzido no formato V2; a migração V1 -> V2 fornece uma lista vazia quando ausente.
  favorites: z.array(FavoriteSchema).optional(),
  // Introduzidos no formato V3; migrações anteriores fornecem listas vazias.
  comments: z.array(CommentSchema).optional(),
  seeAlsoRelations: z.array(SeeAlsoRelationSchema).optional(),
  // Mesmo motivo: exports legados sem este recurso continuam importáveis.
  locationRelations: z.array(LocationRelationSchema).optional(),
  // Introduzidos no formato V4 (checks/effects de Choice); migrações anteriores fornecem listas vazias.
  choiceCheckGroups: z.array(ChoiceCheckGroupSchema).optional(),
  choiceChecks: z.array(ChoiceCheckSchema).optional(),
  effects: z.array(EffectSchema).optional(),
  // Introduzidos no formato V5 (sistema de status e modos); migrações anteriores fornecem
  // listas vazias.
  stats: z.array(StatSchema).optional(),
  statStrengths: z.array(StatStrengthSchema).optional(),
  statRelations: z.array(StatRelationSchema).optional(),
  modes: z.array(ModeSchema).optional(),
  serverLastOperationVersion: z.number().int().min(0), // New field for server's last operation version
  // Ausente em exports de antes deste campo existir - `migrateStoryExport` normaliza para
  // `CURRENT_STORY_FORMAT_VERSION` antes desta validação rodar, então o default aqui é só
  // uma rede de segurança para chamadas que pulem a migração.
  formatVersion: z.number().int().min(1).default(CURRENT_STORY_FORMAT_VERSION),
  // Add other entities as they are defined in the schema
});

export type FullStoryExportType = z.infer<typeof FullStoryExportSchema>;
