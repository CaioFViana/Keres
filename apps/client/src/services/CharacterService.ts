import { and, asc, count, desc, eq, ilike, sql } from 'drizzle-orm'; // Import sql
import { AppDrizzleClient } from '../db';
import { characters, CharacterSelect, tagRelations, TagSelect, tags } from '../db/schema';
// Removed SQLiteTableWithColumns as it's not directly used here and might cause type issues

export type CharacterWithTags = CharacterSelect & { tags: TagSelect[] };

export interface CharacterService {
  getCharactersByStoryId(storyId: string, searchTerm?: string, tagFilterIds?: string[], sortBy?: string, sortDirection?: 'asc' | 'desc'): Promise<CharacterWithTags[]>;
  getCharacterCount(storyId?: string): Promise<number>;
}

export const createCharacterService = (db: AppDrizzleClient): CharacterService => {
  return {
    async getCharactersByStoryId(storyId, searchTerm, tagFilterIds, sortBy, sortDirection): Promise<CharacterWithTags[]> {
      const whereConditions = [eq(characters.storyId, storyId)];
      const orderByConditions: any[] = []; // Explicitly type as any[] for now due to Drizzle's orderBy types

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
        .leftJoin(tags, eq(tagRelations.tagId, tags.id)) // Add this missing join
        .$dynamic(); // Add .$dynamic() here

      // Apply tag filter using a subquery if tagFilterIds are provided
      if (tagFilterIds && tagFilterIds.length > 0) {
        baseQuery = baseQuery.where(
          sql`${characters.id} IN (
            SELECT ${tagRelations.entityId} FROM ${tagRelations}
            WHERE ${tagRelations.entityType} = 'Character'
            AND ${tagRelations.tagId} IN (${sql.join(tagFilterIds.map(id => sql`${id}`), sql`,`)})
          )`
        );
      }

      // Apply general where conditions
      if (whereConditions.length > 0) {
        // Need to be careful here: `baseQuery.where` should accept an array of conditions
        // Drizzle's `where` method typically accepts a single condition or an `and`/`or` of conditions.
        // Let's use `and()` to combine them.
        baseQuery = baseQuery.where(and(...whereConditions));
      }


      // Sort conditions
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
        // Drizzle's orderBy expects a list of expressions, not an array spread if the type isn't compatible.
        // It's safer to explicitly chain if there's only one, or use a helper if multiple.
        // For now, let's keep it simple and assume a single primary order.
        baseQuery = baseQuery.orderBy(...orderByConditions);
      }


      const result = await baseQuery.all();

      const characterMap = new Map<string, CharacterWithTags>();

      for (const row of result) {
        if (row.character) {
          if (!characterMap.has(row.character.id)) {
            characterMap.set(row.character.id, { ...row.character, tags: [] });
          }
          if (row.tag) { // Check if tag exists
            if (!(row.tag as TagSelect).isDeleted) { // Explicitly cast to TagSelect to access isDeleted
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
  };
};

