import { z } from 'zod';
import { ChapterSchema } from './ChapterSchemas';
import { CharacterRelationSchema } from './CharacterRelationSchemas';
import { CharacterSceneSchema } from './CharacterSceneSchemas';
import { CharacterSchema } from './CharacterSchemas';
import { ChoiceSchema } from './ChoiceSchemas';
import { GallerySchema } from './GallerySchemas';
import { ItemJourneySchema } from './ItemJourneySchemas';
import { ItemSchema } from './ItemSchemas';
import { LocationSchema } from './LocationSchemas';
import { NoteSchema } from './NoteSchemas';
import { SceneSchema } from './SceneSchemas';
import { StorySchema } from './StorySchemas';
import { SuggestionSchema } from './SuggestionSchemas';
import { TagRelationSchema } from './TagRelationSchemas';
import { TagSchema } from './TagSchemas';
import { WorldRuleSchema } from './WorldRuleSchemas';

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
    // Add other entities as they are defined in the schema
});

export type FullStoryExportType = z.infer<typeof FullStoryExportSchema>;
