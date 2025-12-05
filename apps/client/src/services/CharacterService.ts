import { and, asc, count, desc, eq, ilike, sql } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import { characters, CharacterSelect, tagRelations, tags, TagSelect } from '../db/schema';

export type CharacterWithTags = CharacterSelect & { tags: TagSelect[] };

export interface CharacterService {
  getCharactersByStoryId(storyId: string, searchTerm?: string, tagFilterIds?: string[], sortBy?: string, sortDirection?: 'asc' | 'desc'): Promise<CharacterWithTags[]>;
  getCharacterCount(storyId?: string): Promise<number>;
  updateCharacter(characterId: string, updatedFields: Partial<Omit<CharacterSelect, 'id' | 'createdAt' | 'updatedAt' | 'version'>>): Promise<CharacterSelect>;
}

export const createCharacterService = (db: AppDrizzleClient): CharacterService => {
  return {
    async getCharactersByStoryId(storyId, searchTerm, tagFilterIds, sortBy, sortDirection): Promise<CharacterWithTags[]> {
      const whereConditions = [eq(characters.storyId, storyId)];
      const orderByConditions: any[] = [];

      if (searchTerm) {
        whereConditions.push(ilike(characters.name, `%${searchTerm}%`));
      }

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
        .$dynamic();

      if (tagFilterIds && tagFilterIds.length > 0) {
        baseQuery = baseQuery.where(
          sql`${characters.id} IN (
            SELECT ${tagRelations.entityId} FROM ${tagRelations}
            WHERE ${tagRelations.entityType} = 'Character'
            AND ${tagRelations.tagId} IN (${sql.join(tagFilterIds.map(id => sql`${id}`), sql`,`)})
          )`
        );
      }

      if (whereConditions.length > 0) {
        baseQuery = baseQuery.where(and(...whereConditions));
      }

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

    async updateCharacter(characterId: string, updatedFields: Partial<Omit<CharacterSelect, 'id' | 'createdAt' | 'updatedAt' | 'version'>>): Promise<CharacterSelect> {
      const [updatedCharacter] = await db
        .update(characters)
        .set({
          ...updatedFields,
          updatedAt: new Date(),
          version: sql`${characters.version} + 1`,
        })
        .where(eq(characters.id, characterId))
        .returning();

      if (!updatedCharacter) {
        throw new Error(`Character with ID ${characterId} not found.`);
      }

      return updatedCharacter;
    },
  };
};

