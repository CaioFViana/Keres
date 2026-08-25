import type {
  FullStoryExportType} from '@keres/shared';
import {
  AttributeType,
  CURRENT_STORY_FORMAT_VERSION,
  FullStoryExportSchema,
  migrateStoryExport,
  StoryExportVersionError,
} from '@keres/shared';
import { eq, sql } from 'drizzle-orm'; // Import sql for aggregate functions
import { ulid } from 'ulid'; // Import ulid for generating new IDs
import { db } from '../db';
import * as dbSchema from '../db/schema';
import { TierLimitExceededError, tierEnforcementService } from './TierEnforcementService';
import { AppError } from '../utils/errors';

export class StoryExportImportService {
  async exportStory(storyId: string, userId?: string): Promise<FullStoryExportType> {
    // storyId type should be string
    // Fetch the main story
    const story = await db.query.stories.findFirst({
      where: (stories, { eq }) => eq(stories.id, storyId),
    });

    if (!story) {
      throw new Error(`Story with ID ${storyId} not found.`);
    }

    // Fetch all related entities
    const chapters = await db.query.chapters.findMany({
      where: (chapters, { eq, and }) =>
        and(eq(chapters.storyId, storyId), eq(chapters.isDeleted, false)),
    });
    const scenes = await db.query.scenes.findMany({
      where: (scenes, { eq, and }) => and(eq(scenes.storyId, storyId), eq(scenes.isDeleted, false)),
    });
    const choices = await db.query.choices.findMany({
      where: (choices, { eq, and }) =>
        and(eq(choices.storyId, storyId), eq(choices.isDeleted, false)),
    });
    const choiceCheckGroups = await db.query.choiceCheckGroups.findMany({
      where: (choiceCheckGroups, { eq, and }) =>
        and(eq(choiceCheckGroups.storyId, storyId), eq(choiceCheckGroups.isDeleted, false)),
    });
    const choiceChecks = await db.query.choiceChecks.findMany({
      where: (choiceChecks, { eq, and }) =>
        and(eq(choiceChecks.storyId, storyId), eq(choiceChecks.isDeleted, false)),
    });
    const effects = await db.query.effects.findMany({
      where: (effects, { eq, and }) =>
        and(eq(effects.storyId, storyId), eq(effects.isDeleted, false)),
    });
    const characters = await db.query.characters.findMany({
      where: (characters, { eq, and }) =>
        and(eq(characters.storyId, storyId), eq(characters.isDeleted, false)),
    });
    const locations = await db.query.locations.findMany({
      where: (locations, { eq, and }) =>
        and(eq(locations.storyId, storyId), eq(locations.isDeleted, false)),
    });
    const locationRelations = await db.query.locationRelations.findMany({
      where: (locationRelations, { eq, and }) =>
        and(eq(locationRelations.storyId, storyId), eq(locationRelations.isDeleted, false)),
    });
    const worldRules = await db.query.worldRules.findMany({
      where: (worldRules, { eq, and }) =>
        and(eq(worldRules.storyId, storyId), eq(worldRules.isDeleted, false)),
    });
    const notes = await db.query.notes.findMany({
      where: (notes, { eq, and }) => and(eq(notes.storyId, storyId), eq(notes.isDeleted, false)),
    });
    const tags = await db.query.tags.findMany({
      where: (tags, { eq, and }) => and(eq(tags.storyId, storyId), eq(tags.isDeleted, false)),
    });
    const suggestions = await db.query.suggestions.findMany({
      where: (suggestions, { eq, and }) =>
        and(eq(suggestions.storyId, storyId), eq(suggestions.isDeleted, false)),
    });
    const characterRelations = await db.query.characterRelations.findMany({
      where: (characterRelations, { eq, and }) =>
        and(eq(characterRelations.storyId, storyId), eq(characterRelations.isDeleted, false)),
    });
    const characterScenes = await db.query.characterScenes.findMany({
      where: (characterScenes, { eq, and }) =>
        and(eq(characterScenes.storyId, storyId), eq(characterScenes.isDeleted, false)),
    });
    const plots = await db.query.plots.findMany({
      where: (plots, { eq, and }) => and(eq(plots.storyId, storyId), eq(plots.isDeleted, false)),
    });
    const plotScenes = await db.query.plotScenes.findMany({
      where: (plotScenes, { eq, and }) =>
        and(eq(plotScenes.storyId, storyId), eq(plotScenes.isDeleted, false)),
    });
    const galleryItems = await db.query.galleries.findMany({
      where: (galleries, { eq, and }) =>
        and(eq(galleries.storyId, storyId), eq(galleries.isDeleted, false)),
    });
    const galleryRelations = await db.query.galleryRelations.findMany({
      where: (galleryRelations, { eq, and }) =>
        and(eq(galleryRelations.storyId, storyId), eq(galleryRelations.isDeleted, false)),
    });
    const items = await db.query.items.findMany({
      where: (items, { eq, and }) => and(eq(items.storyId, storyId), eq(items.isDeleted, false)),
    });
    const itemJourneys = await db.query.itemJourneys.findMany({
      where: (itemJourneys, { eq, and }) =>
        and(eq(itemJourneys.storyId, storyId), eq(itemJourneys.isDeleted, false)),
    });
    const tagRelations = await db.query.tagRelations.findMany({
      where: (tagRelations, { eq, and }) =>
        and(eq(tagRelations.storyId, storyId), eq(tagRelations.isDeleted, false)),
    });
    const noteRelations = await db.query.noteRelations.findMany({
      where: (noteRelations, { eq, and }) =>
        and(eq(noteRelations.storyId, storyId), eq(noteRelations.isDeleted, false)),
    });
    const storySchemaFields = await db.query.storySchemaFields.findMany({
      where: (storySchemaFields, { eq, and }) =>
        and(eq(storySchemaFields.storyId, storyId), eq(storySchemaFields.isDeleted, false)),
    });
    const attributeValues = await db.query.attributeValues.findMany({
      where: (attributeValues, { eq, and }) =>
        and(eq(attributeValues.storyId, storyId), eq(attributeValues.isDeleted, false)),
    });
    const comments = await db.query.comments.findMany({
      where: (comments, { eq, and }) =>
        and(eq(comments.storyId, storyId), eq(comments.isDeleted, false)),
    });
    const stats = await db.query.stats.findMany({
      where: (stats, { eq, and }) => and(eq(stats.storyId, storyId), eq(stats.isDeleted, false)),
    });
    const statStrengths = await db.query.statStrengths.findMany({
      where: (statStrengths, { eq, and }) =>
        and(eq(statStrengths.storyId, storyId), eq(statStrengths.isDeleted, false)),
    });
    const statRelations = await db.query.statRelations.findMany({
      where: (statRelations, { eq, and }) =>
        and(eq(statRelations.storyId, storyId), eq(statRelations.isDeleted, false)),
    });
    const modes = await db.query.modes.findMany({
      where: (modes, { eq, and }) => and(eq(modes.storyId, storyId), eq(modes.isDeleted, false)),
    });
    const seeAlsoRelations = await db.query.seeAlsoRelations.findMany({
      where: (relations, { eq, and }) =>
        and(eq(relations.storyId, storyId), eq(relations.isDeleted, false)),
    });
    const favorites = userId
      ? await db.query.favorites.findMany({
          where: (favorites, { eq, and }) =>
            and(
              eq(favorites.storyId, storyId),
              ...(story.favoriteBehavior === 'individual_public'
                ? []
                : [eq(favorites.userId, userId)]),
              eq(favorites.isDeleted, false),
            ),
        })
      : [];

    // Query for the maximum operationVersion for this story
    const latestOperation = await db
      .select({
        version: sql<number>`max(${dbSchema.operationLog.operationVersion})`.as('maxVersion'),
      })
      .from(dbSchema.operationLog)
      .where(eq(dbSchema.operationLog.storyId, storyId))
      .execute()
      .then((res) => res[0]);

    const serverLastOperationVersion = latestOperation?.version || 1; // Default to 1 if no operations found

    const fullStory = FullStoryExportSchema.parse({
      story,
      chapters,
      scenes,
      choices,
      choiceCheckGroups,
      choiceChecks,
      effects,
      characters,
      locations,
      locationRelations,
      worldRules,
      notes,
      tags,
      suggestions,
      characterRelations,
      characterScenes,
      plots,
      plotScenes,
      galleryItems,
      galleryRelations,
      items,
      itemJourneys,
      tagRelations,
      noteRelations,
      storySchemaFields,
      attributeValues,
      favorites,
      comments,
      seeAlsoRelations,
      stats,
      statStrengths,
      statRelations,
      modes,
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
      if (newStoryId) {
        // Only check if newStoryId was explicitly provided
        const existingStory = await tx.query.stories.findFirst({
          where: (stories, { eq, and }) =>
            and(eq(stories.id, targetStoryId), eq(stories.userId, userId)),
        });

        if (existingStory) {
          throw new Error(
            `Story with ID ${targetStoryId} already exists for this user. Import not allowed as overwriting is disabled.`,
          );
        }
      }

      // Map old IDs to new IDs for all entities to avoid conflicts and link correctly to the new story ID
      const idMap: Map<string, string> = new Map();
      idMap.set(validatedFullStory.story.id, targetStoryId); // Map old story ID to new story ID

      /**
       * `newStoryId` only ever comes from `uploadNewStoryToServer` (see the client's
       * `/stories/import?storyId=` call, and this route's own doc comment) - the client's
       * one-time "link a story I built fully offline to a server" flow. From that moment
       * on the client keeps referencing every entity in that story by its *local* ID
       * forever. Previously only the story row itself preserved its ID here; every child
       * entity below got a fresh server-generated ULID that the client never learned
       * about, so any later operation referencing that entity by its original local ID
       * (e.g. a GalleryRelation pointing at a Character) would permanently fail with
       * "not found" - not a transient race, a structural ID mismatch with no retry that
       * could ever fix it. When `newStoryId` is absent (download/duplicate from another
       * server), fresh IDs are still generated as before - that path has no client
       * expecting IDs to match.
       */
      const preserveIds = !!newStoryId;
      const nextId = (originalId: string): string => (preserveIds ? originalId : ulid());

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
      const newChaptersData = validatedFullStory.chapters.map((original) => {
        const newId = nextId(original.id);
        idMap.set(original.id, newId);
        return {
          ...original,
          id: newId,
          storyId: targetStoryId,
          version: 1,
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          deletedAt: null,
        };
      });
      if (newChaptersData.length > 0) {
        await tx.insert(dbSchema.chapters).values(newChaptersData);
      }

      // --- Locations ---
      // Antes de Scenes de propósito: toda Scene tem um locationId obrigatório, que
      // precisa já estar no idMap quando o bloco de Scenes rodar logo abaixo.
      const newLocationsData = validatedFullStory.locations.map((original) => {
        const newId = nextId(original.id);
        idMap.set(original.id, newId);
        return {
          ...original,
          id: newId,
          storyId: targetStoryId,
          version: 1,
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          deletedAt: null,
        };
      });
      if (newLocationsData.length > 0) {
        await tx.insert(dbSchema.locations).values(newLocationsData);
      }

      // --- LocationRelations (Optional) ---
      // Depois de Locations de propósito: locationAId/locationBId precisam já estar no idMap.
      if (validatedFullStory.locationRelations && validatedFullStory.locationRelations.length > 0) {
        const newLocationRelationsData = validatedFullStory.locationRelations.map((original) => {
          const newId = nextId(original.id);
          idMap.set(original.id, newId);
          const mappedLocationAId = idMap.get(original.locationAId);
          if (!mappedLocationAId) {
            throw new Error(
              `Import Error: Location A ID ${original.locationAId} not found in ID map for location relation ${original.id}.`,
            );
          }
          const mappedLocationBId = idMap.get(original.locationBId);
          if (!mappedLocationBId) {
            throw new Error(
              `Import Error: Location B ID ${original.locationBId} not found in ID map for location relation ${original.id}.`,
            );
          }
          return {
            ...original,
            id: newId,
            storyId: targetStoryId,
            locationAId: mappedLocationAId,
            locationBId: mappedLocationBId,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            deletedAt: null,
          };
        });
        await tx.insert(dbSchema.locationRelations).values(newLocationRelationsData);
      }

      // --- Scenes ---
      const newScenesData = validatedFullStory.scenes.map((original) => {
        const newId = nextId(original.id);
        idMap.set(original.id, newId);
        const mappedChapterId = idMap.get(original.chapterId);
        if (!mappedChapterId) {
          throw new Error(
            `Import Error: Chapter ID ${original.chapterId} not found in ID map for scene ${original.id}.`,
          );
        }
        const mappedLocationId = idMap.get(original.locationId); // Strict mapping
        if (!mappedLocationId) {
          throw new Error(
            `Import Error: Location ID ${original.locationId} not found in ID map for scene ${original.id}.`,
          );
        }
        return {
          ...original,
          id: newId,
          storyId: targetStoryId,
          chapterId: mappedChapterId,
          locationId: mappedLocationId, // Use strictly mapped locationId
          version: 1,
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          deletedAt: null,
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
            await tx
              .update(dbSchema.scenes)
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
            await tx
              .update(dbSchema.scenes)
              .set({ isFinish: false, updatedAt: now, version: scene.version + 1 })
              .where(eq(dbSchema.scenes.id, scene.id));
          }
        }
      }

      // --- Choices ---
      const newChoicesData = validatedFullStory.choices.map((original) => {
        const newId = nextId(original.id);
        idMap.set(original.id, newId);
        const mappedSceneId = idMap.get(original.sceneId);
        if (!mappedSceneId) {
          throw new Error(
            `Import Error: Scene ID ${original.sceneId} not found in ID map for choice ${original.id}.`,
          );
        }
        const mappedNextSceneId = idMap.get(original.nextSceneId);
        if (!mappedNextSceneId) {
          throw new Error(
            `Import Error: Next Scene ID ${original.nextSceneId} not found in ID map for choice ${original.id}.`,
          );
        }
        return {
          ...original,
          id: newId,
          storyId: targetStoryId,
          sceneId: mappedSceneId,
          nextSceneId: mappedNextSceneId,
          version: 1,
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          deletedAt: null,
        };
      });
      if (newChoicesData.length > 0) {
        await tx.insert(dbSchema.choices).values(newChoicesData);
      }

      // --- Characters ---
      const newCharactersData = validatedFullStory.characters.map((original) => {
        const newId = nextId(original.id);
        idMap.set(original.id, newId);
        return {
          ...original,
          id: newId,
          storyId: targetStoryId,
          version: 1,
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          deletedAt: null,
        };
      });
      if (newCharactersData.length > 0) {
        await tx.insert(dbSchema.characters).values(newCharactersData);
      }

      // --- WorldRules ---
      const newWorldRulesData = validatedFullStory.worldRules.map((original) => {
        const newId = nextId(original.id);
        idMap.set(original.id, newId);
        return {
          ...original,
          id: newId,
          storyId: targetStoryId,
          version: 1,
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          deletedAt: null,
        };
      });
      if (newWorldRulesData.length > 0) {
        await tx.insert(dbSchema.worldRules).values(newWorldRulesData);
      }

      // --- Notes ---
      const newNotesData = validatedFullStory.notes.map((original) => {
        const newId = nextId(original.id);
        idMap.set(original.id, newId);
        return {
          ...original,
          id: newId,
          storyId: targetStoryId,
          version: 1,
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          deletedAt: null,
        };
      });
      if (newNotesData.length > 0) {
        await tx.insert(dbSchema.notes).values(newNotesData);
      }

      // --- NoteRelations ---
      const newNoteRelationsData = validatedFullStory.noteRelations.map((original) => {
        const newId = nextId(original.id);
        idMap.set(original.id, newId);
        const mappedNoteId = idMap.get(original.noteId);
        if (!mappedNoteId) {
          throw new Error(
            `Import Error: Note ID ${original.noteId} not found in ID map for note relation ${original.id}.`,
          );
        }
        const mappedRelationId = idMap.get(original.relationId);
        if (!mappedRelationId) {
          throw new Error(
            `Import Error: Relation ID ${original.relationId} not found in ID map for note relation ${original.id}. This indicates a missing entity in export or an unhandled foreign key.`,
          );
        }
        return {
          ...original,
          id: newId,
          storyId: targetStoryId,
          noteId: mappedNoteId,
          relationId: mappedRelationId,
          relationType: original.relationType,
          version: 1,
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          deletedAt: null,
        };
      });
      if (newNoteRelationsData.length > 0) {
        await tx.insert(dbSchema.noteRelations).values(newNoteRelationsData);
      }

      // --- Tags ---
      const newTagsData = validatedFullStory.tags.map((original) => {
        const newId = nextId(original.id);
        idMap.set(original.id, newId);
        return {
          ...original,
          id: newId,
          storyId: targetStoryId,
          version: 1,
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          deletedAt: null,
        };
      });
      if (newTagsData.length > 0) {
        await tx.insert(dbSchema.tags).values(newTagsData);
      }

      // --- Suggestions ---
      const newSuggestionsData = validatedFullStory.suggestions.map((original) => {
        const newId = nextId(original.id);
        idMap.set(original.id, newId);
        return {
          ...original,
          id: newId,
          storyId: targetStoryId,
          version: 1,
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          deletedAt: null,
        };
      });
      if (newSuggestionsData.length > 0) {
        await tx.insert(dbSchema.suggestions).values(newSuggestionsData);
      }

      // --- CharacterRelations ---
      const newCharacterRelationsData = validatedFullStory.characterRelations.map((original) => {
        const newId = nextId(original.id);
        idMap.set(original.id, newId);
        const mappedCharacterId1 = idMap.get(original.character1Id);
        if (!mappedCharacterId1) {
          throw new Error(
            `Import Error: Character ID 1 ${original.character1Id} not found in ID map for character relation ${original.id}.`,
          );
        }
        const mappedCharacterId2 = idMap.get(original.character2Id);
        if (!mappedCharacterId2) {
          throw new Error(
            `Import Error: Character ID 2 ${original.character2Id} not found in ID map for character relation ${original.id}.`,
          );
        }
        return {
          ...original,
          id: newId,
          storyId: targetStoryId,
          character1Id: mappedCharacterId1,
          character2Id: mappedCharacterId2,
          version: 1,
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          deletedAt: null,
        };
      });
      if (newCharacterRelationsData.length > 0) {
        await tx.insert(dbSchema.characterRelations).values(newCharacterRelationsData);
      }

      // --- CharacterScenes ---
      const newCharacterScenesData = validatedFullStory.characterScenes.map((original) => {
        const newId = nextId(original.id);
        idMap.set(original.id, newId);
        const mappedCharacterId = idMap.get(original.characterId);
        if (!mappedCharacterId) {
          throw new Error(
            `Import Error: Character ID ${original.characterId} not found in ID map for character scene ${original.id}.`,
          );
        }
        const mappedSceneId = idMap.get(original.sceneId);
        if (!mappedSceneId) {
          throw new Error(
            `Import Error: Scene ID ${original.sceneId} not found in ID map for character scene ${original.id}.`,
          );
        }
        return {
          ...original,
          id: newId,
          storyId: targetStoryId,
          characterId: mappedCharacterId,
          sceneId: mappedSceneId,
          version: 1,
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          deletedAt: null,
        };
      });
      if (newCharacterScenesData.length > 0) {
        await tx.insert(dbSchema.characterScenes).values(newCharacterScenesData);
      }

      // --- Plots ---
      const newPlotsData = (validatedFullStory.plots ?? []).map((original) => {
        const newId = nextId(original.id);
        idMap.set(original.id, newId);
        return {
          ...original,
          id: newId,
          storyId: targetStoryId,
          version: 1,
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          deletedAt: null,
        };
      });
      if (newPlotsData.length > 0) await tx.insert(dbSchema.plots).values(newPlotsData);

      // --- PlotScenes ---
      const newPlotScenesData = (validatedFullStory.plotScenes ?? []).map((original) => {
        const newId = nextId(original.id);
        const plotId = idMap.get(original.plotId);
        const sceneId = idMap.get(original.sceneId);
        if (!plotId || !sceneId)
          throw new Error(`Import Error: plot or scene missing for plot-scene ${original.id}.`);
        return {
          ...original,
          id: newId,
          storyId: targetStoryId,
          plotId,
          sceneId,
          version: 1,
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          deletedAt: null,
        };
      });
      if (newPlotScenesData.length > 0)
        await tx.insert(dbSchema.plotScenes).values(newPlotScenesData);

      // --- GalleryItems ---
      const newGalleryItemsData = validatedFullStory.galleryItems.map((original) => {
        const newId = nextId(original.id);
        idMap.set(original.id, newId);
        return {
          ...original,
          id: newId,
          storyId: targetStoryId,
          version: 1,
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          deletedAt: null,
        };
      });
      if (newGalleryItemsData.length > 0) {
        await tx.insert(dbSchema.galleries).values(newGalleryItemsData);
      }

      // --- Items (Optional) ---
      if (validatedFullStory.items && validatedFullStory.items.length > 0) {
        const newItemsData = validatedFullStory.items.map((original) => {
          const newId = nextId(original.id);
          idMap.set(original.id, newId);
          return {
            ...original,
            id: newId,
            storyId: targetStoryId,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            deletedAt: null,
          };
        });
        await tx.insert(dbSchema.items).values(newItemsData);
      }

      // --- ChoiceCheckGroups (Optional, map choice ID) ---
      // Depois de Choices de propósito: choiceId precisa já estar no idMap.
      if (validatedFullStory.choiceCheckGroups && validatedFullStory.choiceCheckGroups.length > 0) {
        const newChoiceCheckGroupsData = validatedFullStory.choiceCheckGroups.map((original) => {
          const newId = nextId(original.id);
          idMap.set(original.id, newId);
          const mappedChoiceId = idMap.get(original.choiceId);
          if (!mappedChoiceId) {
            throw new Error(
              `Import Error: Choice ID ${original.choiceId} not found in ID map for choice check group ${original.id}.`,
            );
          }
          return {
            ...original,
            id: newId,
            storyId: targetStoryId,
            choiceId: mappedChoiceId,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            deletedAt: null,
          };
        });
        await tx.insert(dbSchema.choiceCheckGroups).values(newChoiceCheckGroupsData);
      }

      // --- ChoiceChecks (Optional, map group ID, and optional scene/item IDs) ---
      // Depois de ChoiceCheckGroups, Scenes e Items de propósito: groupId/sceneId/itemId
      // precisam já estar no idMap.
      if (validatedFullStory.choiceChecks && validatedFullStory.choiceChecks.length > 0) {
        const newChoiceChecksData = validatedFullStory.choiceChecks.map((original) => {
          const newId = nextId(original.id);
          idMap.set(original.id, newId);
          const mappedGroupId = idMap.get(original.groupId);
          if (!mappedGroupId) {
            throw new Error(
              `Import Error: Group ID ${original.groupId} not found in ID map for choice check ${original.id}.`,
            );
          }
          let mappedSceneId: string | null = null;
          if (original.sceneId) {
            mappedSceneId = idMap.get(original.sceneId) ?? null;
            if (!mappedSceneId) {
              throw new Error(
                `Import Error: Scene ID ${original.sceneId} not found in ID map for choice check ${original.id}.`,
              );
            }
          }
          let mappedItemId: string | null = null;
          if (original.itemId) {
            mappedItemId = idMap.get(original.itemId) ?? null;
            if (!mappedItemId) {
              throw new Error(
                `Import Error: Item ID ${original.itemId} not found in ID map for choice check ${original.id}.`,
              );
            }
          }
          return {
            ...original,
            id: newId,
            storyId: targetStoryId,
            groupId: mappedGroupId,
            sceneId: mappedSceneId,
            itemId: mappedItemId,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            deletedAt: null,
          };
        });
        await tx.insert(dbSchema.choiceChecks).values(newChoiceChecksData);
      }

      // --- Effects (Optional, map polymorphic entity ID via entityType, and optional item ID) ---
      // Depois de Scenes, Choices e Items de propósito: entityId (Scene ou Choice) e
      // itemId precisam já estar no idMap.
      if (validatedFullStory.effects && validatedFullStory.effects.length > 0) {
        const newEffectsData = validatedFullStory.effects.map((original) => {
          const newId = nextId(original.id);
          idMap.set(original.id, newId);
          const mappedEntityId = idMap.get(original.entityId);
          if (!mappedEntityId) {
            throw new Error(
              `Import Error: Entity ID ${original.entityId} (${original.entityType}) not found in ID map for effect ${original.id}.`,
            );
          }
          let mappedItemId: string | null = null;
          if (original.itemId) {
            mappedItemId = idMap.get(original.itemId) ?? null;
            if (!mappedItemId) {
              throw new Error(
                `Import Error: Item ID ${original.itemId} not found in ID map for effect ${original.id}.`,
              );
            }
          }
          return {
            ...original,
            id: newId,
            storyId: targetStoryId,
            entityId: mappedEntityId,
            itemId: mappedItemId,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            deletedAt: null,
          };
        });
        await tx.insert(dbSchema.effects).values(newEffectsData);
      }

      // --- ItemJourneys (Optional, map item ID, scene ID, and optional new owner character ID) ---
      if (validatedFullStory.itemJourneys && validatedFullStory.itemJourneys.length > 0) {
        const newItemJourneysData = validatedFullStory.itemJourneys.map((original) => {
          const newId = nextId(original.id);
          idMap.set(original.id, newId);
          const mappedItemId = idMap.get(original.itemId);
          if (!mappedItemId) {
            throw new Error(
              `Import Error: Item ID ${original.itemId} not found in ID map for item journey ${original.id}.`,
            );
          }
          const mappedSceneId = idMap.get(original.sceneId);
          if (!mappedSceneId) {
            throw new Error(
              `Import Error: Scene ID ${original.sceneId} not found in ID map for item journey ${original.id}.`,
            );
          }
          let mappedNewCharacterOwnerId: string | null = null;
          if (original.newCharacterOwnerId) {
            mappedNewCharacterOwnerId = idMap.get(original.newCharacterOwnerId) ?? null;
            if (!mappedNewCharacterOwnerId) {
              throw new Error(
                `Import Error: Character ID ${original.newCharacterOwnerId} not found in ID map for item journey ${original.id}.`,
              );
            }
          }
          return {
            ...original,
            id: newId,
            storyId: targetStoryId,
            itemId: mappedItemId,
            sceneId: mappedSceneId,
            newCharacterOwnerId: mappedNewCharacterOwnerId,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            deletedAt: null,
          };
        });
        await tx.insert(dbSchema.itemJourneys).values(newItemJourneysData);
      }

      // --- TagRelations (Optional, map relation ID and tag ID) ---
      if (validatedFullStory.tagRelations && validatedFullStory.tagRelations.length > 0) {
        const newTagRelationsData = validatedFullStory.tagRelations.map((original) => {
          const newId = nextId(original.id);
          idMap.set(original.id, newId);
          const mappedTagId = idMap.get(original.tagId);
          if (!mappedTagId) {
            throw new Error(
              `Import Error: Tag ID ${original.tagId} not found in ID map for tag relation ${original.id}.`,
            );
          }
          const mappedRelationId = idMap.get(original.relationId); // Corrected property name
          if (!mappedRelationId) {
            throw new Error(
              `Import Error: Relation ID ${original.relationId} not found in ID map for tag relation ${original.id}. This indicates a missing entity in export or an unhandled foreign key.`,
            );
          }

          return {
            ...original,
            id: newId,
            storyId: targetStoryId,
            tagId: mappedTagId,
            relationId: mappedRelationId, // Use mapped relationId
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            deletedAt: null,
          };
        });
        await tx.insert(dbSchema.tagRelations).values(newTagRelationsData);
      }

      // --- GalleryRelations (map gallery ID and owner ID) ---
      // Por último de propósito: o dono pode ser um Item, e os itens só entram no
      // mapa de IDs no bloco acima.
      if (validatedFullStory.galleryRelations && validatedFullStory.galleryRelations.length > 0) {
        const newGalleryRelationsData = validatedFullStory.galleryRelations.map((original) => {
          const newId = nextId(original.id);
          idMap.set(original.id, newId);
          const mappedGalleryId = idMap.get(original.galleryId);
          if (!mappedGalleryId) {
            throw new Error(
              `Import Error: Gallery ID ${original.galleryId} not found in ID map for gallery relation ${original.id}.`,
            );
          }
          const mappedOwnerId = idMap.get(original.ownerId);
          if (!mappedOwnerId) {
            throw new Error(
              `Import Error: Owner ID ${original.ownerId} (${original.ownerType}) not found in ID map for gallery relation ${original.id}.`,
            );
          }

          return {
            ...original,
            id: newId,
            storyId: targetStoryId,
            galleryId: mappedGalleryId,
            ownerId: mappedOwnerId,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            deletedAt: null,
          };
        });
        await tx.insert(dbSchema.galleryRelations).values(newGalleryRelationsData);
      }

      // --- StorySchemaFields (Optional) ---
      // Só depende da Story - pode entrar em qualquer ponto do idMap, mas fica perto de
      // AttributeValues (que dependem dela) por clareza de leitura.
      if (validatedFullStory.storySchemaFields && validatedFullStory.storySchemaFields.length > 0) {
        const newStorySchemaFieldsData = validatedFullStory.storySchemaFields.map((original) => {
          const newId = nextId(original.id);
          idMap.set(original.id, newId);
          return {
            ...original,
            id: newId,
            storyId: targetStoryId,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            deletedAt: null,
          };
        });
        await tx.insert(dbSchema.storySchemaFields).values(newStorySchemaFieldsData);
      }

      // Attribute values of entity fields store another entity's ID. Those IDs
      // belong to the source export, so remap them just like other references.
      // Missing targets are intentionally preserved as dangling references by
      // clearing the value instead of aborting the whole import.
      const entityFieldIds = new Set(
        (validatedFullStory.storySchemaFields ?? [])
          .filter((field) => field.type === AttributeType.ENTITY)
          .map((field) => field.id),
      );

      // --- AttributeValues (Optional) ---
      // Por último de propósito: entityId pode apontar pra qualquer um dos 7 tipos de
      // entidade suportados (Character/Location/Item/Scene/Chapter/Note/WorldRule), todos
      // já precisam estar no idMap, e fieldId depende do bloco de StorySchemaFields acima.
      if (validatedFullStory.attributeValues && validatedFullStory.attributeValues.length > 0) {
        const newAttributeValuesData = validatedFullStory.attributeValues.map((original) => {
          const newId = nextId(original.id);
          idMap.set(original.id, newId);
          const mappedFieldId = idMap.get(original.fieldId);
          if (!mappedFieldId) {
            throw new Error(
              `Import Error: Field ID ${original.fieldId} not found in ID map for attribute value ${original.id}.`,
            );
          }
          const mappedEntityId = idMap.get(original.entityId);
          if (!mappedEntityId) {
            throw new Error(
              `Import Error: Entity ID ${original.entityId} (${original.entityType}) not found in ID map for attribute value ${original.id}.`,
            );
          }
          const value =
            entityFieldIds.has(original.fieldId) && original.value
              ? (idMap.get(original.value) ?? null)
              : original.value;
          return {
            ...original,
            id: newId,
            storyId: targetStoryId,
            fieldId: mappedFieldId,
            entityId: mappedEntityId,
            value,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            deletedAt: null,
          };
        });
        await tx.insert(dbSchema.attributeValues).values(newAttributeValuesData);
      }

      if (validatedFullStory.seeAlsoRelations && validatedFullStory.seeAlsoRelations.length > 0) {
        const newSeeAlsoRelationsData = validatedFullStory.seeAlsoRelations.map((original) => {
          const entityAId = idMap.get(original.entityAId);
          const entityBId = idMap.get(original.entityBId);
          if (!entityAId || !entityBId) {
            throw new Error(
              `Import Error: See-also relation ${original.id} references an entity absent from the export.`,
            );
          }
          return {
            ...original,
            id: nextId(original.id),
            storyId: targetStoryId,
            entityAId,
            entityBId,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            deletedAt: null,
          };
        });
        await tx.insert(dbSchema.seeAlsoRelations).values(newSeeAlsoRelationsData);
      }

      if (validatedFullStory.comments && validatedFullStory.comments.length > 0) {
        const newCommentsData = validatedFullStory.comments.map((original) => {
          const entityId = idMap.get(original.entityId);
          const fieldId = original.fieldId ? idMap.get(original.fieldId) : null;
          if (!entityId) {
            throw new Error(
              `Import Error: Comment ${original.id} references an entity absent from the export.`,
            );
          }
          if (original.fieldId && !fieldId) {
            throw new Error(
              `Import Error: Comment ${original.id} references a custom field absent from the export.`,
            );
          }
          return {
            ...original,
            id: nextId(original.id),
            storyId: targetStoryId,
            entityId,
            fieldId,
            // Comentários importados pertencem ao usuário que importou, como os
            // Favorites: o autor de outro servidor pode nem existir neste banco.
            authorUserId: userId,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            deletedAt: null,
          };
        });
        await tx.insert(dbSchema.comments).values(newCommentsData);
      }

      // --- Sistema de status ---
      // Ordem obrigatória: Stat e Mode antes de StatStrength/StatRelation, que os referenciam.
      if (validatedFullStory.stats && validatedFullStory.stats.length > 0) {
        const newStatsData = validatedFullStory.stats.map((original) => {
          const newId = nextId(original.id);
          idMap.set(original.id, newId);
          return {
            ...original,
            id: newId,
            storyId: targetStoryId,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            deletedAt: null,
          };
        });
        await tx.insert(dbSchema.stats).values(newStatsData);
      }

      if (validatedFullStory.modes && validatedFullStory.modes.length > 0) {
        const newModesData = validatedFullStory.modes.map((original) => {
          const newId = nextId(original.id);
          idMap.set(original.id, newId);
          const characterId = idMap.get(original.characterId);
          if (!characterId) {
            throw new Error(
              `Import Error: Mode ${original.id} references a character absent from the export.`,
            );
          }
          return {
            ...original,
            id: newId,
            storyId: targetStoryId,
            characterId,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            deletedAt: null,
          };
        });
        await tx.insert(dbSchema.modes).values(newModesData);
      }

      if (validatedFullStory.statStrengths && validatedFullStory.statStrengths.length > 0) {
        const newStatStrengthsData = validatedFullStory.statStrengths.map((original) => {
          const newId = nextId(original.id);
          idMap.set(original.id, newId);
          // statId nulo é a escada padrão da história, que não referencia stat nenhum.
          const statId = original.statId ? idMap.get(original.statId) : null;
          if (original.statId && !statId) {
            throw new Error(
              `Import Error: Stat tier ${original.id} references a stat absent from the export.`,
            );
          }
          return {
            ...original,
            id: newId,
            storyId: targetStoryId,
            statId: statId ?? null,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            deletedAt: null,
          };
        });
        await tx.insert(dbSchema.statStrengths).values(newStatStrengthsData);
      }

      if (validatedFullStory.statRelations && validatedFullStory.statRelations.length > 0) {
        const newStatRelationsData = validatedFullStory.statRelations.map((original) => {
          const characterId = idMap.get(original.characterId);
          const statId = idMap.get(original.statId);
          const modeId = original.modeId ? idMap.get(original.modeId) : null;
          if (!characterId || !statId || (original.modeId && !modeId)) {
            throw new Error(
              `Import Error: Stat value ${original.id} references an entity absent from the export.`,
            );
          }
          return {
            ...original,
            id: nextId(original.id),
            storyId: targetStoryId,
            characterId,
            statId,
            modeId: modeId ?? null,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            deletedAt: null,
          };
        });
        await tx.insert(dbSchema.statRelations).values(newStatRelationsData);
      }

      if (validatedFullStory.favorites && validatedFullStory.favorites.length > 0) {
        const newFavoritesData = validatedFullStory.favorites.map((original) => {
          const mappedEntityId = idMap.get(original.entityId);
          if (!mappedEntityId) {
            throw new Error(
              `Import Error: Entity ID ${original.entityId} (${original.entityType}) not found for favorite ${original.id}.`,
            );
          }
          return {
            ...original,
            id: nextId(original.id),
            storyId: targetStoryId,
            entityId: mappedEntityId,
            userId,
            version: 1,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            deletedAt: null,
          };
        });
        await tx.insert(dbSchema.favorites).values(newFavoritesData);
      }
    });

    return targetStoryId;
  }
}
