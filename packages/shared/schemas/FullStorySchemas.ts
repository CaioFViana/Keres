import { z } from 'zod';
import { ChapterSchema } from './ChapterSchemas'; // Adjusted path
import { CharacterSchema } from './CharacterSchemas'; // Adjusted path
import { CharacterRelationSchema } from './CharacterRelationSchemas'; // Adjusted path
import { CharacterSceneSchema } from './CharacterSceneSchemas'; // Adjusted path
import { ChoiceSchema } from './ChoiceSchemas'; // Adjusted path
import { GalleryRelationSchema, GallerySchema } from './GallerySchemas'; // Adjusted path
import { ItemJourneySchema } from './ItemJourneySchemas'; // Adjusted path
import { ItemSchema } from './ItemSchemas'; // Adjusted path
import { LocationSchema } from './LocationSchemas'; // Adjusted path
import { NoteSchema } from './NoteSchemas'; // Adjusted path
import { SceneSchema } from './SceneSchemas'; // Adjusted path
import { StorySchema } from './StorySchemas'; // Adjusted path
import { SuggestionSchema } from './SuggestionSchemas'; // Adjusted path
import { TagRelationSchema } from './TagRelationSchemas'; // Adjusted path
import { TagSchema } from './TagSchemas'; // Adjusted path
import { WorldRuleSchema } from './WorldRuleSchemas'; // Adjusted path
import { NoteRelationSchema } from './NoteRelationSchemas';
import { CURRENT_STORY_FORMAT_VERSION } from './StoryExportVersion';

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
    galleryItems: z.array(GallerySchema),
    // Opcional para que pacotes gerados antes da galeria virar N:N continuem importáveis.
    galleryRelations: z.array(GalleryRelationSchema).optional(),
    items: z.array(ItemSchema).optional(),
    itemJourneys: z.array(ItemJourneySchema),
    serverLastOperationVersion: z.number().int().min(0), // New field for server's last operation version
    // Ausente em exports de antes deste campo existir - `migrateStoryExport` normaliza para
    // `CURRENT_STORY_FORMAT_VERSION` antes desta validação rodar, então o default aqui é só
    // uma rede de segurança para chamadas que pulem a migração.
    formatVersion: z.number().int().min(1).default(CURRENT_STORY_FORMAT_VERSION),
    // Add other entities as they are defined in the schema
});

export type FullStoryExportType = z.infer<typeof FullStoryExportSchema>;
