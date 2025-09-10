import type { Scene } from '@domain/entities/Scene'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { ListQueryParams, PaginatedResponse } from '@keres/shared'

import { chapters, db, scenes, story } from '@infrastructure/db' // Import db and scenes table
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm'

export class SceneRepository implements ISceneRepository {
  async findById(id: string): Promise<Scene | null> {
    try {
      const result = await db.select().from(scenes).where(eq(scenes.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in SceneRepository.findById:', error)
      throw error
    }
  }

  async findByChapterId(chapterId: string, query?: ListQueryParams): Promise<PaginatedResponse<Scene>> {
    try {
      let baseQuery = db.select().from(scenes).where(eq(scenes.chapterId, chapterId));

      // Define allowed filterable fields and their Drizzle column mappings
      const filterableFields = {
        name: scenes.name,
        summary: scenes.summary,
        isFavorite: scenes.isFavorite,
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
                and(eq(scenes.chapterId, chapterId), eq(column, value)),
              );
            }
          }
        }
      }

      // Build the count query based on the same filters
      let countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(scenes)
        .where(eq(scenes.chapterId, chapterId)); // Start with the base where clause

      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            const column = filterableFields[key as keyof typeof filterableFields];
            if (column) {
              countQuery = countQuery.where(
                and(eq(scenes.chapterId, chapterId), eq(column, value)),
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
        name: scenes.name,
        index: scenes.index,
        createdAt: scenes.createdAt,
        updatedAt: scenes.updatedAt,
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
      console.error('Error in SceneRepository.findByChapterId:', error)
      throw error
    }
  }

  async findByLocationId(locationId: string, query?: ListQueryParams): Promise<PaginatedResponse<Scene>> {
    try {
      let baseQuery = db.select().from(scenes).where(eq(scenes.locationId, locationId));

      // Define allowed filterable fields and their Drizzle column mappings
      const filterableFields = {
        name: scenes.name,
        summary: scenes.summary,
        isFavorite: scenes.isFavorite,
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
                and(eq(scenes.locationId, locationId), eq(column, value)),
              );
            }
          }
        }
      }

      // Build the count query based on the same filters
      let countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(scenes)
        .where(eq(scenes.locationId, locationId)); // Start with the base where clause

      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            const column = filterableFields[key as keyof typeof filterableFields];
            if (column) {
              countQuery = countQuery.where(
                and(eq(scenes.locationId, locationId), eq(column, value)),
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
        name: scenes.name,
        index: scenes.index,
        createdAt: scenes.createdAt,
        updatedAt: scenes.updatedAt,
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
      console.error('Error in SceneRepository.findByLocationId:', error)
      throw error
    }
  }

  async save(sceneData: Scene): Promise<void> {
    try {
      await db.insert(scenes).values(this.toPersistence(sceneData))
    } catch (error) {
      console.error('Error in SceneRepository.save:', error)
      throw error
    }
  }

  async update(sceneData: Scene, chapterId: string): Promise<void> {
    try {
      await db
        .update(scenes)
        .set(this.toPersistence(sceneData))
        .where(eq(scenes.id, sceneData.id), eq(scenes.chapterId, chapterId))
    } catch (error) {
      console.error('Error in SceneRepository.update:', error)
      throw error
    }
  }

  async delete(id: string, chapterId: string): Promise<void> {
    try {
      await db.delete(scenes).where(eq(scenes.id, id), eq(scenes.chapterId, chapterId))
    } catch (error) {
      console.error('Error in SceneRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof scenes.$inferSelect): Scene {
    return {
      id: data.id,
      chapterId: data.chapterId,
      name: data.name,
      index: data.index,
      locationId: data.locationId,
      summary: data.summary,
      gap: data.gap,
      duration: data.duration,
      isFavorite: data.isFavorite,
      extraNotes: data.extraNotes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }

  private toPersistence(sceneData: Scene): typeof scenes.$inferInsert {
    return {
      id: sceneData.id,
      chapterId: sceneData.chapterId,
      name: sceneData.name,
      index: sceneData.index,
      locationId: sceneData.locationId,
      summary: sceneData.summary,
      gap: sceneData.gap,
      duration: sceneData.duration,
      isFavorite: sceneData.isFavorite,
      extraNotes: sceneData.extraNotes,
      createdAt: sceneData.createdAt,
      updatedAt: sceneData.updatedAt,
    }
  }

  async search(query: string, userId: string): Promise<Scene[]> {
    try {
      const results = await db
        .select({ scenes: scenes })
        .from(scenes)
        .innerJoin(chapters, eq(scenes.chapterId, chapters.id))
        .innerJoin(story, eq(chapters.storyId, story.id))
        .where(
          and(
            eq(story.userId, userId),
            or(
              like(scenes.name, `%${query}%`),
              like(scenes.summary, `%${query}%`),
              like(scenes.extraNotes, `%${query}%`),
            ),
          ),
        )
      return results.map((result: { scenes: Scene }) => result.scenes)
    } catch (error) {
      console.error('Error in SceneRepository.search:', error)
      throw error
    }
  }
}
