import { z } from 'zod';
import { ChapterSchema } from './ChapterSchemas'; // Adjusted path
import { CharacterSchema } from './CharacterSchemas'; // Adjusted path
import { CharacterRelationSchema } from './CharacterRelationSchemas'; // Adjusted path
import { CharacterSceneSchema } from './CharacterSceneSchemas'; // Adjusted path
import { ChoiceSchema } from './ChoiceSchemas'; // Adjusted path
import { GallerySchema } from './GallerySchemas'; // Adjusted path
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
    tags: z.array(TagSchema),
    suggestions: z.array(SuggestionSchema),
    characterRelations: z.array(CharacterRelationSchema),
    characterScenes: z.array(CharacterSceneSchema),
    galleryItems: z.array(GallerySchema),
    items: z.array(ItemSchema).optional(),
    itemJourneys: z.array(ItemJourneySchema),
    tagRelations: z.array(TagRelationSchema),
    serverLastOperationVersion: z.number().int().min(0), // New field for server's last operation version
    // Add other entities as they are defined in the schema
});

export type FullStoryExportType = z.infer<typeof FullStoryExportSchema>;
