import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import { characters, CharacterSelect, tagRelations } from '../db/schema';
import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';

export interface CharacterService {
  getCharactersByStoryId(storyId: string, searchTerm?: string, tagFilterId?: string, sortBy?: string): Promise<CharacterSelect[]>;
  getCharacterCount(storyId?: string): Promise<number>;
}

export const createCharacterService = (db: AppDrizzleClient): CharacterService => {
  return {
    async getCharactersByStoryId(storyId, searchTerm, tagFilterId, sortBy): Promise<CharacterSelect[]> {
      let baseQuery = db.select({ character: characters }).from(characters); // Always select the character object

      let joinedQuery;
      if (tagFilterId) {
        // If a join is needed, create a new query chain for it
        joinedQuery = baseQuery
          .innerJoin(tagRelations, and(
            eq(characters.id, tagRelations.entityId),
            eq(tagRelations.entityType, 'Character'),
            eq(tagRelations.tagId, tagFilterId)
          ));
      } else {
        joinedQuery = baseQuery; // If no join, use the base query
      }

      let finalQuery = joinedQuery.where(eq(characters.storyId, storyId)).$dynamic();

      if (searchTerm) {
        finalQuery = finalQuery.where(ilike(characters.name, `%${searchTerm}%`));
      }

      switch (sortBy) {
        case 'name':
          finalQuery = finalQuery.orderBy(asc(characters.name));
          break;
        case 'createdAt':
          finalQuery = finalQuery.orderBy(asc(characters.createdAt));
          break;
        case 'updatedAt':
          finalQuery = finalQuery.orderBy(desc(characters.updatedAt));
          break;
        default:
          finalQuery = finalQuery.orderBy(asc(characters.name));
          break;
      }

      const result = await finalQuery.all();

      // Normalize the result to always return CharacterSelect[]
      // The initial select({ character: characters }) ensures 'row.character' is always CharacterSelect
      return result.map((row: any) => row.character as CharacterSelect);
    },

    async getCharacterCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(characters)
        .where(storyId ? eq(characters.storyId, storyId) : undefined)
        .get();
      return result?.count || 0;
    },
  };
};

