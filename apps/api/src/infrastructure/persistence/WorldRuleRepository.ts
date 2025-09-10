import type { WorldRule } from '@domain/entities/WorldRule'
import type { IWorldRuleRepository } from '@domain/repositories/IWorldRuleRepository'
import type { ListQueryParams, PaginatedResponse } from '@keres/shared'

import { db, story, worldRules } from '@infrastructure/db' // Import db and worldRules table
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm'

export class WorldRuleRepository implements IWorldRuleRepository {
  async findById(id: string): Promise<WorldRule | null> {
    try {
      const result = await db.select().from(worldRules).where(eq(worldRules.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in WorldRuleRepository.findById:', error)
      throw error
    }
  }

  async findByStoryId(storyId: string, query?: ListQueryParams): Promise<PaginatedResponse<WorldRule>> {
    try {
      let baseQuery = db.select().from(worldRules).where(eq(worldRules.storyId, storyId));

      // Define allowed filterable fields and their Drizzle column mappings
      const filterableFields = {
        title: worldRules.title,
        description: worldRules.description,
        isFavorite: worldRules.isFavorite,
        // Add other filterable fields here
      }

      // Generic filtering (Revised)
      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            const column = filterableFields[key as keyof typeof filterableFields];
            if (column) {
              baseQuery = baseQuery.where(
                and(eq(worldRules.storyId, storyId), eq(column, value)),
              );
            }
          }
        }
      }

      // Build the count query based on the same filters
      let countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(worldRules)
        .where(eq(worldRules.storyId, storyId)); // Start with the base where clause

      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            const column = filterableFields[key as keyof typeof filterableFields];
            if (column) {
              countQuery = countQuery.where(
                and(eq(worldRules.storyId, storyId), eq(column, value)),
              );
            }
          }
        }
      }

      const totalItemsResult = await countQuery;
      const totalItems = totalItemsResult[0].count;

      // Now apply sorting and pagination to the main query
      let finalQuery = baseQuery;

      // Sorting (Revised)
      const sortableFields = {
        title: worldRules.title,
        createdAt: worldRules.createdAt,
        updatedAt: worldRules.updatedAt,
        // Add other sortable fields here
      }
      if (query?.sort_by) {
        const sortColumn = sortableFields[query.sort_by as keyof typeof sortableFields];
        if (sortColumn) {
          if (query.order === 'desc') {
            finalQuery = finalQuery.orderBy(desc(sortColumn));
          } else {
            finalQuery = finalQuery.orderBy(asc(sortColumn));
          }
        }
      }

      // Pagination
      if (query?.limit) {
        finalQuery = finalQuery.limit(query.limit);
        if (query.page) {
          const offset = (query.page - 1) * query.limit;
          finalQuery = finalQuery.offset(offset);
        }
      }

      const results = await finalQuery;
      const items = results.map(this.toDomain);

      return { items, totalItems };
    } catch (error) {
      console.error('Error in WorldRuleRepository.findByStoryId:', error);
      throw error;
    }
  }

  async save(worldRuleData: WorldRule): Promise<void> {
    try {
      await db.insert(worldRules).values(this.toPersistence(worldRuleData))
    } catch (error) {
      console.error('Error in WorldRuleRepository.save:', error)
      throw error
    }
  }

  async update(worldRuleData: WorldRule, storyId: string): Promise<void> {
    try {
      await db
        .update(worldRules)
        .set(this.toPersistence(worldRuleData))
        .where(eq(worldRules.id, worldRuleData.id), eq(worldRules.storyId, storyId))
    } catch (error) {
      console.error('Error in WorldRuleRepository.update:', error)
      throw error
    }
  }

  async delete(id: string, storyId: string): Promise<void> {
    try {
      await db.delete(worldRules).where(eq(worldRules.id, id), eq(worldRules.storyId, storyId))
    } catch (error) {
      console.error('Error in WorldRuleRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof worldRules.$inferSelect): WorldRule {
    return {
      id: data.id,
      storyId: data.storyId,
      title: data.title,
      description: data.description,
      isFavorite: data.isFavorite,
      extraNotes: data.extraNotes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }

  private toPersistence(worldRuleData: WorldRule): typeof worldRules.$inferInsert {
    return {
      id: worldRuleData.id,
      storyId: worldRuleData.storyId,
      title: worldRuleData.title,
      description: worldRuleData.description,
      isFavorite: worldRuleData.isFavorite,
      extraNotes: worldRuleData.extraNotes,
      createdAt: worldRuleData.createdAt,
      updatedAt: worldRuleData.updatedAt,
    }
  }

  async search(query: string, userId: string): Promise<WorldRule[]> {
    try {
      const results = await db
        .select({ worldRules: worldRules })
        .from(worldRules)
        .innerJoin(story, eq(worldRules.storyId, story.id))
        .where(
          and(
            eq(story.userId, userId),
            or(
              like(worldRules.title, `%${query}%`),
              like(worldRules.description, `%${query}%`),
              like(worldRules.extraNotes, `%${query}%`),
            ),
          ),
        )
      return results.map((result: { worldRules: WorldRule }) => this.toDomain(result.worldRules))
    } catch (error) {
      console.error('Error in WorldRuleRepository.search:', error)
      throw error
    }
  }
}
