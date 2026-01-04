import { FullStoryExportSchema, FullStoryExportType } from '@keres/shared';
import { eq, sql } from 'drizzle-orm'; // Import sql for aggregate functions
import { ulid } from 'ulid'; // Import ulid for generating new IDs
import { db } from '../db';
import * as dbSchema from '../db/schema';

export class StoryExportImportService {
    async exportStory(storyId: string): Promise<FullStoryExportType> { // storyId type should be string
        // Fetch the main story
        const story = await db.query.stories.findFirst({
            where: (stories, { eq }) => eq(stories.id, storyId),
        });

        if (!story) {
            throw new Error(`Story with ID ${storyId} not found.`);
        }

        // Fetch all related entities
        const chapters = await db.query.chapters.findMany({
            where: (chapters, { eq, and }) => and(eq(chapters.storyId, storyId), eq(chapters.isDeleted, false)),
        });
        const scenes = await db.query.scenes.findMany({
            where: (scenes, { eq, and }) => and(eq(scenes.storyId, storyId), eq(scenes.isDeleted, false)),
        });
        const choices = await db.query.choices.findMany({
            where: (choices, { eq, and }) => and(eq(choices.storyId, storyId), eq(choices.isDeleted, false)),
        });
        const characters = await db.query.characters.findMany({
            where: (characters, { eq, and }) => and(eq(characters.storyId, storyId), eq(characters.isDeleted, false)),
        });
        const locations = await db.query.locations.findMany({
            where: (locations, { eq, and }) => and(eq(locations.storyId, storyId), eq(locations.isDeleted, false)),
        });
        const worldRules = await db.query.worldRules.findMany({
            where: (worldRules, { eq, and }) => and(eq(worldRules.storyId, storyId), eq(worldRules.isDeleted, false)),
        });
        const notes = await db.query.notes.findMany({
            where: (notes, { eq, and }) => and(eq(notes.storyId, storyId), eq(notes.isDeleted, false)),
        });
        const tags = await db.query.tags.findMany({
            where: (tags, { eq, and }) => and(eq(tags.storyId, storyId), eq(tags.isDeleted, false)),
        });
        const suggestions = await db.query.suggestions.findMany({
            where: (suggestions, { eq, and }) => and(eq(suggestions.storyId, storyId), eq(suggestions.isDeleted, false)),
        });
        const characterRelations = await db.query.characterRelations.findMany({
            where: (characterRelations, { eq, and }) => and(eq(characterRelations.storyId, storyId), eq(characterRelations.isDeleted, false)),
        });
        const characterScenes = await db.query.characterScenes.findMany({
            where: (characterScenes, { eq, and }) => and(eq(characterScenes.storyId, storyId), eq(characterScenes.isDeleted, false)),
        });
        const galleryItems = await db.query.galleries.findMany({
            where: (galleries, { eq, and }) => and(eq(galleries.storyId, storyId), eq(galleries.isDeleted, false)),
        });
        const items = await db.query.items.findMany({
            where: (items, { eq, and }) => and(eq(items.storyId, storyId), eq(items.isDeleted, false)),
        });
        const itemJourneys = await db.query.itemJourneys.findMany({
            where: (itemJourneys, { eq, and }) => and(eq(itemJourneys.storyId, storyId), eq(itemJourneys.isDeleted, false)),
        });
        const tagRelations = await db.query.tagRelations.findMany({
            where: (tagRelations, { eq, and }) => and(eq(tagRelations.storyId, storyId), eq(tagRelations.isDeleted, false)),
        });
        const noteRelations = await db.query.noteRelations.findMany({ 
            where: (noteRelations, { eq, and }) => and(eq(noteRelations.storyId, storyId), eq(noteRelations.isDeleted, false)),
        });

        // Query for the maximum operationVersion for this story
        const latestOperation = await db.select({
            version: sql<number>`max(${dbSchema.operationLog.operationVersion})`.as('maxVersion'),
        })
        .from(dbSchema.operationLog)
        .where(eq(dbSchema.operationLog.storyId, storyId))
        .execute()
        .then(res => res[0]);

        const serverLastOperationVersion = latestOperation?.version || 1; // Default to 1 if no operations found


        const fullStory = FullStoryExportSchema.parse({
            story,
            chapters,
            scenes,
            choices,
            characters,
            locations,
            worldRules,
            notes,
            tags,
            suggestions,
            characterRelations,
            characterScenes,
            galleryItems,
            items,
            itemJourneys,
            tagRelations,
            noteRelations,
            serverLastOperationVersion: serverLastOperationVersion,
        });

        return fullStory;
    }

    async importStory(userId: string, fullStoryJSON: FullStoryExportType, newStoryId?: string): Promise<string> {
        const validatedFullStory = FullStoryExportSchema.parse(fullStoryJSON);

        // Determine the target story ID. If newStoryId is provided, use it. Otherwise, generate a new one.
        const targetStoryId = newStoryId || ulid();

        await db.transaction(async (tx) => {
            const now = new Date();

            // If newStoryId was provided, check if a story with this ID already exists for the user.
            // Overwriting is not allowed, so if it exists, throw an error.
            if (newStoryId) { // Only check if newStoryId was explicitly provided
                const existingStory = await tx.query.stories.findFirst({
                    where: (stories, { eq, and }) => and(
                        eq(stories.id, targetStoryId),
                        eq(stories.userId, userId)
                    ),
                });

                if (existingStory) {
                    throw new Error(`Story with ID ${targetStoryId} already exists for this user. Import not allowed as overwriting is disabled.`);
                }
            }

            // Map old IDs to new IDs for all entities to avoid conflicts and link correctly to the new story ID
            const idMap: Map<string, string> = new Map();
            idMap.set(validatedFullStory.story.id, targetStoryId); // Map old story ID to new story ID

            // --- Story ---
            const newStoryData = {
                ...validatedFullStory.story,
                id: targetStoryId,
                userId: userId, // Ensure story is owned by the importing user
                version: 1,
                createdAt: now,
                updatedAt: now,
                isDeleted: false,
                deletedAt: null,
            };
            await tx.insert(dbSchema.stories).values(newStoryData);

            // --- Chapters ---
            const newChaptersData = validatedFullStory.chapters.map(original => {
                const newId = ulid();
                idMap.set(original.id, newId);
                return {
                    ...original,
                    id: newId,
                    storyId: targetStoryId,
                    version: 1, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null,
                };
            });
            if (newChaptersData.length > 0) {
                await tx.insert(dbSchema.chapters).values(newChaptersData);
            }

            // --- Scenes ---
            const newScenesData = validatedFullStory.scenes.map(original => {
                const newId = ulid();
                idMap.set(original.id, newId);
                const mappedChapterId = idMap.get(original.chapterId);
                if (!mappedChapterId) {
                    throw new Error(`Import Error: Chapter ID ${original.chapterId} not found in ID map for scene ${original.id}.`);
                }
                const mappedLocationId = idMap.get(original.locationId); // Strict mapping
                if (!mappedLocationId) {
                    throw new Error(`Import Error: Location ID ${original.locationId} not found in ID map for scene ${original.id}.`);
                }
                return {
                    ...original,
                    id: newId,
                    storyId: targetStoryId,
                    chapterId: mappedChapterId,
                    locationId: mappedLocationId, // Use strictly mapped locationId
                    version: 1, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null,
                };
            });
            if (newScenesData.length > 0) {
                await tx.insert(dbSchema.scenes).values(newScenesData);
            }

            // --- Choices ---
            const newChoicesData = validatedFullStory.choices.map(original => {
                const newId = ulid();
                idMap.set(original.id, newId);
                const mappedSceneId = idMap.get(original.sceneId);
                if (!mappedSceneId) {
                    throw new Error(`Import Error: Scene ID ${original.sceneId} not found in ID map for choice ${original.id}.`);
                }
                const mappedNextSceneId = idMap.get(original.nextSceneId);
                if (!mappedNextSceneId) {
                    throw new Error(`Import Error: Next Scene ID ${original.nextSceneId} not found in ID map for choice ${original.id}.`);
                }
                return {
                    ...original,
                    id: newId,
                    storyId: targetStoryId,
                    sceneId: mappedSceneId,
                    nextSceneId: mappedNextSceneId,
                    version: 1, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null,
                };
            });
            if (newChoicesData.length > 0) {
                await tx.insert(dbSchema.choices).values(newChoicesData);
            }

            // --- Characters ---
            const newCharactersData = validatedFullStory.characters.map(original => {
                const newId = ulid();
                idMap.set(original.id, newId);
                return {
                    ...original,
                    id: newId,
                    storyId: targetStoryId,
                    version: 1, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null,
                };
            });
            if (newCharactersData.length > 0) {
                await tx.insert(dbSchema.characters).values(newCharactersData);
            }

            // --- Locations ---
            const newLocationsData = validatedFullStory.locations.map(original => {
                const newId = ulid();
                idMap.set(original.id, newId);
                return {
                    ...original,
                    id: newId,
                    storyId: targetStoryId,
                    version: 1, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null,
                };
            });
            if (newLocationsData.length > 0) {
                await tx.insert(dbSchema.locations).values(newLocationsData);
            }

            // --- WorldRules ---
            const newWorldRulesData = validatedFullStory.worldRules.map(original => {
                const newId = ulid();
                idMap.set(original.id, newId);
                return {
                    ...original,
                    id: newId,
                    storyId: targetStoryId,
                    version: 1, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null,
                };
            });
            if (newWorldRulesData.length > 0) {
                await tx.insert(dbSchema.worldRules).values(newWorldRulesData);
            }

            // --- Notes ---
            const newNotesData = validatedFullStory.notes.map(original => {
                const newId = ulid();
                idMap.set(original.id, newId);
                return {
                    ...original,
                    id: newId,
                    storyId: targetStoryId,
                    version: 1, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null,
                };
            });
            if (newNotesData.length > 0) {
                await tx.insert(dbSchema.notes).values(newNotesData);
            }

            // --- NoteRelations ---
            const newNoteRelationsData = validatedFullStory.noteRelations.map(original => {
                const newId = ulid();
                idMap.set(original.id, newId);
                const mappedNoteId = idMap.get(original.noteId);
                if (!mappedNoteId) {
                    throw new Error(`Import Error: Note ID ${original.noteId} not found in ID map for note relation ${original.id}.`);
                }
                const mappedRelationId = idMap.get(original.relationId);
                if (!mappedRelationId) {
                    throw new Error(`Import Error: Relation ID ${original.relationId} not found in ID map for note relation ${original.id}. This indicates a missing entity in export or an unhandled foreign key.`);
                }
                return {
                    ...original,
                    id: newId,
                    storyId: targetStoryId,
                    noteId: mappedNoteId,
                    relationId: mappedRelationId,
                    relationType: original.relationType,
                    version: 1, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null,
                };
            });
            if (newNoteRelationsData.length > 0) {
                await tx.insert(dbSchema.noteRelations).values(newNoteRelationsData);
            }

            // --- Tags ---
            const newTagsData = validatedFullStory.tags.map(original => {
                const newId = ulid();
                idMap.set(original.id, newId);
                return {
                    ...original,
                    id: newId,
                    storyId: targetStoryId,
                    version: 1, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null,
                };
            });
            if (newTagsData.length > 0) {
                await tx.insert(dbSchema.tags).values(newTagsData);
            }

            // --- Suggestions ---
            const newSuggestionsData = validatedFullStory.suggestions.map(original => {
                const newId = ulid();
                idMap.set(original.id, newId);
                return {
                    ...original,
                    id: newId,
                    storyId: targetStoryId,
                    version: 1, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null,
                };
            });
            if (newSuggestionsData.length > 0) {
                await tx.insert(dbSchema.suggestions).values(newSuggestionsData);
            }

            // --- CharacterRelations ---
            const newCharacterRelationsData = validatedFullStory.characterRelations.map(original => {
                const newId = ulid();
                idMap.set(original.id, newId);
                const mappedCharacterId1 = idMap.get(original.character1Id);
                if (!mappedCharacterId1) {
                    throw new Error(`Import Error: Character ID 1 ${original.character1Id} not found in ID map for character relation ${original.id}.`);
                }
                const mappedCharacterId2 = idMap.get(original.character2Id);
                if (!mappedCharacterId2) {
                    throw new Error(`Import Error: Character ID 2 ${original.character2Id} not found in ID map for character relation ${original.id}.`);
                }
                return {
                    ...original,
                    id: newId,
                    storyId: targetStoryId,
                    characterId1: mappedCharacterId1,
                    characterId2: mappedCharacterId2,
                    version: 1, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null,
                };
            });
            if (newCharacterRelationsData.length > 0) {
                await tx.insert(dbSchema.characterRelations).values(newCharacterRelationsData);
            }

            // --- CharacterScenes ---
            const newCharacterScenesData = validatedFullStory.characterScenes.map(original => {
                const newId = ulid();
                idMap.set(original.id, newId);
                const mappedCharacterId = idMap.get(original.characterId);
                if (!mappedCharacterId) {
                    throw new Error(`Import Error: Character ID ${original.characterId} not found in ID map for character scene ${original.id}.`);
                }
                const mappedSceneId = idMap.get(original.sceneId);
                if (!mappedSceneId) {
                    throw new Error(`Import Error: Scene ID ${original.sceneId} not found in ID map for character scene ${original.id}.`);
                }
                return {
                    ...original,
                    id: newId,
                    storyId: targetStoryId,
                    characterId: mappedCharacterId,
                    sceneId: mappedSceneId,
                    version: 1, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null,
                };
            });
            if (newCharacterScenesData.length > 0) {
                await tx.insert(dbSchema.characterScenes).values(newCharacterScenesData);
            }

            // --- GalleryItems ---
            const newGalleryItemsData = validatedFullStory.galleryItems.map(original => {
                const newId = ulid();
                idMap.set(original.id, newId);
                return {
                    ...original,
                    id: newId,
                    storyId: targetStoryId,
                    version: 1, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null,
                };
            });
            if (newGalleryItemsData.length > 0) {
                await tx.insert(dbSchema.galleries).values(newGalleryItemsData);
            }

            // --- Items (Optional) ---
            if (validatedFullStory.items && validatedFullStory.items.length > 0) {
                const newItemsData = validatedFullStory.items.map(original => {
                    const newId = ulid();
                    idMap.set(original.id, newId);
                    return {
                        ...original,
                        id: newId,
                        storyId: targetStoryId,
                        version: 1, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null,
                    };
                });
                await tx.insert(dbSchema.items).values(newItemsData);
            }

            // --- ItemJourneys (Optional, map item ID) ---
            if (validatedFullStory.itemJourneys && validatedFullStory.itemJourneys.length > 0) {
                const newItemJourneysData = validatedFullStory.itemJourneys.map(original => {
                    const newId = ulid();
                    idMap.set(original.id, newId);
                    const mappedItemId = idMap.get(original.itemId);
                    if (!mappedItemId) {
                        throw new Error(`Import Error: Item ID ${original.itemId} not found in ID map for item journey ${original.id}.`);
                    }
                    return {
                        ...original,
                        id: newId,
                        storyId: targetStoryId,
                        itemId: mappedItemId,
                        version: 1, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null,
                    };
                });
                await tx.insert(dbSchema.itemJourneys).values(newItemJourneysData);
            }

            // --- TagRelations (Optional, map relation ID and tag ID) ---
            if (validatedFullStory.tagRelations && validatedFullStory.tagRelations.length > 0) {
                const newTagRelationsData = validatedFullStory.tagRelations.map(original => {
                    const newId = ulid();
                    idMap.set(original.id, newId);
                    const mappedTagId = idMap.get(original.tagId);
                    if (!mappedTagId) {
                        throw new Error(`Import Error: Tag ID ${original.tagId} not found in ID map for tag relation ${original.id}.`);
                    }
                    const mappedRelationId = idMap.get(original.relationId); // Corrected property name
                    if (!mappedRelationId) {
                        throw new Error(`Import Error: Relation ID ${original.relationId} not found in ID map for tag relation ${original.id}. This indicates a missing entity in export or an unhandled foreign key.`);
                    }

                    return {
                        ...original,
                        id: newId,
                        storyId: targetStoryId,
                        tagId: mappedTagId,
                        relationId: mappedRelationId, // Use mapped relationId
                        version: 1, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null,
                    };
                });
                await tx.insert(dbSchema.tagRelations).values(newTagRelationsData);
            }
        });

        return targetStoryId;
    }
}
