import { and, asc, count, desc, eq, inArray, or, sql, SQL } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import { CharacterInsert, characters, CharacterSelect, tagRelations, tags, TagSelect } from '../db/schema'; // Import CharacterInsert and stories
import { entityEventEmitter } from '../utils/EventEmitter'; // Import characterEventEmitter
import { getChangedFields } from '../utils/diffUtils'; // Import getChangedFields
import { Create, prepareNewEntityData } from '../utils/entityUtils'; // Import Create and prepareNewEntityData
import { getUserIdForOperation, recordLocalOperation } from '../utils/syncUtils'; // Import recordLocalOperation and getUserIdForOperation
import { createServerService } from './ServerService'; // Import ServerService and createServerService

export type CharacterWithTags = CharacterSelect & { tags: TagSelect[] };

export type FavoriteFilterState = 'all' | 'favorite' | 'not-favorite';

export interface CharacterService {
  getCharactersByStoryId(storyId: string, searchTerm?: string, tagFilterIds?: string[], favoriteFilterState?: FavoriteFilterState, sortBy?: string, sortDirection?: 'asc' | 'desc'): Promise<CharacterWithTags[]>;
  getCharacterCount(storyId?: string): Promise<number>;
  createCharacter(currentUserId: string, characterData: Create<CharacterInsert>): Promise<CharacterSelect>; // Add createCharacter
  updateCharacter(currentUserId: string, characterId: string, updatedFields: Partial<Omit<CharacterSelect, 'id' | 'createdAt' | 'updatedAt' | 'version'>>): Promise<void>;
  deleteCharacter(currentUserId: string, characterId: string): Promise<void>; // Add deleteCharacter
  getById(characterId: string): Promise<CharacterSelect | undefined>;
}

export const createCharacterService = (db: AppDrizzleClient): CharacterService => {
  const serverService = createServerService(db); // Create serverService once
  return {
    async getCharactersByStoryId(storyId, searchTerm, tagFilterIds, favoriteFilterState, sortBy, sortDirection): Promise<CharacterWithTags[]> {
      const whereConditions = [eq(characters.storyId, storyId)];
      const orderByConditions: any[] = [];

      if (searchTerm) {
        whereConditions.push(or(
          sql`${characters.name} LIKE ${`%${searchTerm}%`} COLLATE NOCASE`,
          sql`${characters.title} LIKE ${`%${searchTerm}%`} COLLATE NOCASE`
        ) as SQL<boolean>);
      }

      if (tagFilterIds && tagFilterIds.length > 0) {
        const taggedCharacters = db
          .select({ entityId: tagRelations.entityId })
          .from(tagRelations)
          .where(and(
            eq(tagRelations.entityType, 'Character'),
            inArray(tagRelations.tagId, tagFilterIds)
          ));
        whereConditions.push(inArray(characters.id, taggedCharacters));
      }

      if (favoriteFilterState === 'favorite') {
        whereConditions.push(eq(characters.isFavorite, true));
      } else if (favoriteFilterState === 'not-favorite') {
        whereConditions.push(eq(characters.isFavorite, false));
      }

      const finalWhereConditions = and(...whereConditions);

      let baseQuery = db.select({
        character: characters,
        tag: tags,
      })
        .from(characters)
        .leftJoin(tagRelations, and(
          eq(characters.id, tagRelations.entityId),
          eq(tagRelations.entityType, 'Character')
        ))
        .leftJoin(tags, eq(tagRelations.tagId, tags.id))
        .where(finalWhereConditions) // Apply all conditions here
        .$dynamic();

      switch (sortBy) {
        case 'name':
          orderByConditions.push(sortDirection === 'desc' ? desc(characters.name) : asc(characters.name));
          break;
        case 'createdAt':
          orderByConditions.push(sortDirection === 'desc' ? desc(characters.createdAt) : asc(characters.createdAt));
          break;
        case 'updatedAt':
          orderByConditions.push(sortDirection === 'desc' ? desc(characters.updatedAt) : asc(characters.updatedAt));
          break;
        default:
          orderByConditions.push(asc(characters.name));
          break;
      }

      if (orderByConditions.length > 0) {
        baseQuery = baseQuery.orderBy(...orderByConditions);
      }

      const result = await baseQuery.all();

      const characterMap = new Map<string, CharacterWithTags>();

      for (const row of result) {
        if (row.character) {
          if (!characterMap.has(row.character.id)) {
            characterMap.set(row.character.id, { ...row.character, tags: [] });
          }
          if (row.tag) {
            if (!(row.tag as TagSelect).isDeleted) {
              characterMap.get(row.character.id)?.tags.push(row.tag as TagSelect);
            }
          }
        }
      }

      return Array.from(characterMap.values());
    },

    async getCharacterCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(characters)
        .where(storyId ? eq(characters.storyId, storyId) : undefined)
        .get();
      return result?.count || 0;
    },

    async createCharacter(currentUserId: string, characterData: Create<CharacterInsert>): Promise<CharacterSelect> {
      const newCharacter = prepareNewEntityData<CharacterInsert>(characterData);
      const result = await db.insert(characters).values(newCharacter).returning().get();

      const userIdToLog = await getUserIdForOperation(db, serverService, newCharacter.storyId, currentUserId);
      await recordLocalOperation(db, newCharacter.storyId, userIdToLog, 'create', 'Character', newCharacter.id, { ...result });
      entityEventEmitter.emit('character_changed', newCharacter.storyId, newCharacter.id);

      return result;
    },

    async updateCharacter(currentUserId: string, characterId: string, updatedFields: Partial<Omit<CharacterSelect, 'id' | 'createdAt' | 'updatedAt' | 'version'>>): Promise<void> {
      const oldCharacter = await db.query.characters.findFirst({ where: eq(characters.id, characterId) });
      if (!oldCharacter) {
        throw new Error(`Character with ID ${characterId} not found for update.`);
      }

      const [updatedCharacter] = await db.update(characters)
        .set({ ...updatedFields, updatedAt: new Date(), version: sql`${characters.version} + 1` })
        .where(eq(characters.id, characterId))
        .returning({ id: characters.id, storyId: characters.storyId, version: characters.version }); // Return relevant fields

      if (!updatedCharacter) {
        throw new Error(`Failed to update character ${characterId} or character not found.`);
      }

      const changedFields = getChangedFields(oldCharacter, { ...oldCharacter, ...updatedFields, version: updatedCharacter.version });

      const userIdToLog = await getUserIdForOperation(db, serverService, updatedCharacter.storyId, currentUserId);
      await recordLocalOperation(db, updatedCharacter.storyId, userIdToLog, 'update', 'Character', characterId, changedFields);
      entityEventEmitter.emit('character_changed', updatedCharacter.storyId, updatedCharacter.id); // Emit event after update
    },

    async deleteCharacter(currentUserId: string, characterId: string): Promise<void> {
      const characterToDelete = await db.query.characters.findFirst({ where: eq(characters.id, characterId) });
      if (!characterToDelete) {
        console.warn(`Attempted to delete non-existent character ${characterId}.`);
        return;
      }

      const [updatedCharacter] = await db.update(characters)
        .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date(), version: sql`${characters.version} + 1` })
        .where(eq(characters.id, characterId))
        .returning({ id: characters.id, storyId: characters.storyId, isDeleted: characters.isDeleted, version: characters.version });

      if (!updatedCharacter) {
        throw new Error(`Failed to delete character ${characterId} or character not found.`);
      }

      const changedFields = {
        id: updatedCharacter.id,
        isDeleted: updatedCharacter.isDeleted,
        version: updatedCharacter.version,
      };

      const userIdToLog = await getUserIdForOperation(db, serverService, updatedCharacter.storyId, currentUserId);
      await recordLocalOperation(db, updatedCharacter.storyId, userIdToLog, 'delete', 'Character', characterId, changedFields);
      entityEventEmitter.emit('character_changed', updatedCharacter.storyId, updatedCharacter.id); // Emit event after delete
    },

    async getById(characterId: string): Promise<CharacterSelect | undefined> {
        const character = await db.query.characters.findFirst({
            where: eq(characters.id, characterId),
        });
        return character;
    },
  };
};