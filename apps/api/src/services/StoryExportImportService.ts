import { CURRENT_STORY_FORMAT_VERSION, FullStoryExportSchema, FullStoryExportType, migrateStoryExport, StoryExportVersionError } from '@keres/shared';
import { eq, sql } from 'drizzle-orm'; // Import sql for aggregate functions
import { ulid } from 'ulid'; // Import ulid for generating new IDs
import { db } from '../db';
import * as dbSchema from '../db/schema';
import { TierLimitExceededError, tierEnforcementService } from './TierEnforcementService';
import { AppError } from '../utils/errors';

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
        const locationRelations = await db.query.locationRelations.findMany({
            where: (locationRelations, { eq, and }) => and(eq(locationRelations.storyId, storyId), eq(locationRelations.isDeleted, false)),
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
        const galleryRelations = await db.query.galleryRelations.findMany({
            where: (galleryRelations, { eq, and }) => and(eq(galleryRelations.storyId, storyId), eq(galleryRelations.isDeleted, false)),
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
        const storySchemaFields = await db.query.storySchemaFields.findMany({
            where: (storySchemaFields, { eq, and }) => and(eq(storySchemaFields.storyId, storyId), eq(storySchemaFields.isDeleted, false)),
        });
        const attributeValues = await db.query.attributeValues.findMany({
            where: (attributeValues, { eq, and }) => and(eq(attributeValues.storyId, storyId), eq(attributeValues.isDeleted, false)),
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
            locationRelations,
            worldRules,
            notes,
            tags,
            suggestions,
            characterRelations,
            characterScenes,
            galleryItems,
            galleryRelations,
            items,
            itemJourneys,
            tagRelations,
            noteRelations,
            storySchemaFields,
            attributeValues,
            serverLastOperationVersion: serverLastOperationVersion,
            formatVersion: CURRENT_STORY_FORMAT_VERSION,
        });

        return fullStory;
    }

    async importStory(userId: string, fullStoryJSON: unknown, newStoryId?: string): Promise<string> {
        let migrated: unknown;
        try {
            migrated = migrateStoryExport(fullStoryJSON);
        } catch (err) {
            if (err instanceof StoryExportVersionError) {
                throw new AppError(422, err.message);
            }
            throw err;
        }
        const validatedFullStory = FullStoryExportSchema.parse(migrated);

        // Falha rápido antes de abrir a transação: importar uma história inteira e só
        // então recusar deixaria o usuário sem saber por que nada foi salvo, e gastaria
        // trabalho de banco à toa numa importação que já ia ser descartada.
        try {
            await tierEnforcementService.assertCanCreateStory(userId);
        } catch (error) {
            if (error instanceof TierLimitExceededError) {
                throw new AppError(403, error.message);
            }
            throw error;
        }

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

            // --- Locations ---
            // Antes de Scenes de propósito: toda Scene tem um locationId obrigatório, que
            // precisa já estar no idMap quando o bloco de Scenes rodar logo abaixo.
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

            // --- LocationRelations (Optional) ---
            // Depois de Locations de propósito: locationAId/locationBId precisam já estar no idMap.
            if (validatedFullStory.locationRelations && validatedFullStory.locationRelations.length > 0) {
                const newLocationRelationsData = validatedFullStory.locationRelations.map(original => {
                    const newId = ulid();
                    idMap.set(original.id, newId);
                    const mappedLocationAId = idMap.get(original.locationAId);
                    if (!mappedLocationAId) {
                        throw new Error(`Import Error: Location A ID ${original.locationAId} not found in ID map for location relation ${original.id}.`);
                    }
                    const mappedLocationBId = idMap.get(original.locationBId);
                    if (!mappedLocationBId) {
                        throw new Error(`Import Error: Location B ID ${original.locationBId} not found in ID map for location relation ${original.id}.`);
                    }
                    return {
                        ...original,
                        id: newId,
                        storyId: targetStoryId,
                        locationAId: mappedLocationAId,
                        locationBId: mappedLocationBId,
                        version: 1, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null,
                    };
                });
                await tx.insert(dbSchema.locationRelations).values(newLocationRelationsData);
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

            // Post-import cleanup for linear stories: Ensure only one isStart and isFinish
            if (validatedFullStory.story.type === 'linear') {
              const importedScenes = await tx.query.scenes.findMany({
                where: eq(dbSchema.scenes.storyId, targetStoryId),
                columns: { id: true, isStart: true, isFinish: true, version: true },
              });

              let firstIsStartFound = false;
              for (const scene of importedScenes) {
                if (scene.isStart && !firstIsStartFound) {
                  firstIsStartFound = true;
                } else if (scene.isStart && firstIsStartFound) {
                  // This is a duplicate isStart, unset it
                  await tx.update(dbSchema.scenes)
                    .set({ isStart: false, updatedAt: now, version: scene.version + 1 })
                    .where(eq(dbSchema.scenes.id, scene.id));
                }
              }

              let firstIsFinishFound = false;
              for (const scene of importedScenes) {
                if (scene.isFinish && !firstIsFinishFound) {
                  firstIsFinishFound = true;
                } else if (scene.isFinish && firstIsFinishFound) {
                  // This is a duplicate isFinish, unset it
                  await tx.update(dbSchema.scenes)
                    .set({ isFinish: false, updatedAt: now, version: scene.version + 1 })
                    .where(eq(dbSchema.scenes.id, scene.id));
                }
              }
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
                    character1Id: mappedCharacterId1,
                    character2Id: mappedCharacterId2,
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

            // --- ItemJourneys (Optional, map item ID, scene ID, and optional new owner character ID) ---
            if (validatedFullStory.itemJourneys && validatedFullStory.itemJourneys.length > 0) {
                const newItemJourneysData = validatedFullStory.itemJourneys.map(original => {
                    const newId = ulid();
                    idMap.set(original.id, newId);
                    const mappedItemId = idMap.get(original.itemId);
                    if (!mappedItemId) {
                        throw new Error(`Import Error: Item ID ${original.itemId} not found in ID map for item journey ${original.id}.`);
                    }
                    const mappedSceneId = idMap.get(original.sceneId);
                    if (!mappedSceneId) {
                        throw new Error(`Import Error: Scene ID ${original.sceneId} not found in ID map for item journey ${original.id}.`);
                    }
                    let mappedNewCharacterOwnerId: string | null = null;
                    if (original.newCharacterOwnerId) {
                        mappedNewCharacterOwnerId = idMap.get(original.newCharacterOwnerId) ?? null;
                        if (!mappedNewCharacterOwnerId) {
                            throw new Error(`Import Error: Character ID ${original.newCharacterOwnerId} not found in ID map for item journey ${original.id}.`);
                        }
                    }
                    return {
                        ...original,
                        id: newId,
                        storyId: targetStoryId,
                        itemId: mappedItemId,
                        sceneId: mappedSceneId,
                        newCharacterOwnerId: mappedNewCharacterOwnerId,
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

            // --- GalleryRelations (map gallery ID and owner ID) ---
            // Por último de propósito: o dono pode ser um Item, e os itens só entram no
            // mapa de IDs no bloco acima.
            if (validatedFullStory.galleryRelations && validatedFullStory.galleryRelations.length > 0) {
                const newGalleryRelationsData = validatedFullStory.galleryRelations.map(original => {
                    const newId = ulid();
                    idMap.set(original.id, newId);
                    const mappedGalleryId = idMap.get(original.galleryId);
                    if (!mappedGalleryId) {
                        throw new Error(`Import Error: Gallery ID ${original.galleryId} not found in ID map for gallery relation ${original.id}.`);
                    }
                    const mappedOwnerId = idMap.get(original.ownerId);
                    if (!mappedOwnerId) {
                        throw new Error(`Import Error: Owner ID ${original.ownerId} (${original.ownerType}) not found in ID map for gallery relation ${original.id}.`);
                    }

                    return {
                        ...original,
                        id: newId,
                        storyId: targetStoryId,
                        galleryId: mappedGalleryId,
                        ownerId: mappedOwnerId,
                        version: 1, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null,
                    };
                });
                await tx.insert(dbSchema.galleryRelations).values(newGalleryRelationsData);
            }

            // --- StorySchemaFields (Optional) ---
            // Só depende da Story - pode entrar em qualquer ponto do idMap, mas fica perto de
            // AttributeValues (que dependem dela) por clareza de leitura.
            if (validatedFullStory.storySchemaFields && validatedFullStory.storySchemaFields.length > 0) {
                const newStorySchemaFieldsData = validatedFullStory.storySchemaFields.map(original => {
                    const newId = ulid();
                    idMap.set(original.id, newId);
                    return {
                        ...original,
                        id: newId,
                        storyId: targetStoryId,
                        version: 1, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null,
                    };
                });
                await tx.insert(dbSchema.storySchemaFields).values(newStorySchemaFieldsData);
            }

            // --- AttributeValues (Optional) ---
            // Por último de propósito: entityId pode apontar pra qualquer um dos 7 tipos de
            // entidade suportados (Character/Location/Item/Scene/Chapter/Note/WorldRule), todos
            // já precisam estar no idMap, e fieldId depende do bloco de StorySchemaFields acima.
            if (validatedFullStory.attributeValues && validatedFullStory.attributeValues.length > 0) {
                const newAttributeValuesData = validatedFullStory.attributeValues.map(original => {
                    const newId = ulid();
                    idMap.set(original.id, newId);
                    const mappedFieldId = idMap.get(original.fieldId);
                    if (!mappedFieldId) {
                        throw new Error(`Import Error: Field ID ${original.fieldId} not found in ID map for attribute value ${original.id}.`);
                    }
                    const mappedEntityId = idMap.get(original.entityId);
                    if (!mappedEntityId) {
                        throw new Error(`Import Error: Entity ID ${original.entityId} (${original.entityType}) not found in ID map for attribute value ${original.id}.`);
                    }
                    return {
                        ...original,
                        id: newId,
                        storyId: targetStoryId,
                        fieldId: mappedFieldId,
                        entityId: mappedEntityId,
                        version: 1, createdAt: now, updatedAt: now, isDeleted: false, deletedAt: null,
                    };
                });
                await tx.insert(dbSchema.attributeValues).values(newAttributeValuesData);
            }
        });

        return targetStoryId;
    }
}
