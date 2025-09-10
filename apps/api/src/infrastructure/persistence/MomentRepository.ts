import type { Moment } from '@domain/entities/Moment'
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'
import type { ListQueryParams, PaginatedResponse } from '@keres/shared'

import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm' // Import sql
import { chapters, moments, scenes, story } from '@infrastructure/db/schema' // Import tables from the new schema location
import { db } from '@infrastructure/db'

export class MomentRepository implements IMomentRepository {
  async findById(id: string): Promise<Moment | null> {
    try {
      const result = await db.select().from(moments).where(eq(moments.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in MomentRepository.findById:', error)
      throw error
    }
  }

  // New findByIds method
  async findByIds(ids: string[]): Promise<Moment[]> {
    try {
      if (ids.length === 0) {
        return []
      }
      const results = await db.select().from(moments).where(inArray(moments.id, ids))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in MomentRepository.findByIds:', error)
      throw error
    }
  }

  async findBySceneId(sceneId: string, query?: ListQueryParams): Promise<PaginatedResponse<Moment>> {
    try {
      let baseQuery = db.select().from(moments).where(eq(moments.sceneId, sceneId));

      // Define allowed filterable fields and their Drizzle column mappings
      const filterableFields = {
        name: moments.name,
        summary: moments.summary,
        location: moments.location,
        isFavorite: moments.isFavorite,
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
                and(eq(moments.sceneId, sceneId), eq(column, value)),
              );
            }
          }
        }
      }

      // Build the count query based on the same filters
      let countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(moments)
        .where(eq(moments.sceneId, sceneId)); // Start with the base where clause

      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            const column = filterableFields[key as keyof typeof filterableFields];
            if (column) {
              countQuery = countQuery.where(
                and(eq(moments.sceneId, sceneId), eq(column, value)),
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
        name: moments.name,
        index: moments.index,
        createdAt: moments.createdAt,
        updatedAt: moments.updatedAt,
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
      console.error('Error in MomentRepository.findBySceneId:', error);
      throw error;
    }
  }

  async save(momentData: Moment): Promise<void> {
    try {
      await db.insert(moments).values(this.toPersistence(momentData))
    } catch (error) {
      console.error('Error in MomentRepository.save:', error)
      throw error
    }
  }

  async saveMany(momentsData: Moment[]): Promise<void> {
    try {
      if (momentsData.length === 0) {
        return
      }
      const persistenceData = momentsData.map(this.toPersistence)
      await db.insert(moments).values(persistenceData)
    } catch (error) {
      console.error('Error in MomentRepository.saveMany:', error)
      throw error
    }
  }

  async update(momentData: Moment, sceneId: string): Promise<void> {
    try {
      await db
        .update(moments)
        .set(this.toPersistence(momentData))
        .where(eq(moments.id, momentData.id), eq(moments.sceneId, sceneId))
    } catch (error) {
      console.error('Error in MomentRepository.update:', error)
      throw error
    }
  }

  async updateMany(momentsData: Moment[]): Promise<void> {
    try {
      if (momentsData.length === 0) {
        return
      }
      await db.transaction(async (tx: any) => {
        for (const momentData of momentsData) {
          await tx
            .update(moments)
            .set(this.toPersistence(momentData))
            .where(eq(moments.id, momentData.id))
        }
      })
    } catch (error) {
      console.error('Error in MomentRepository.updateMany:', error)
      throw error
    }
  }

  async delete(id: string, sceneId: string): Promise<void> {
    try {
      await db.delete(moments).where(eq(moments.id, id), eq(moments.sceneId, sceneId))
    } catch (error) {
      console.error('Error in MomentRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof moments.$inferSelect): Moment {
    return {
      id: data.id,
      sceneId: data.sceneId,
      name: data.name,
      location: data.location,
      index: data.index,
      summary: data.summary,
      isFavorite: data.isFavorite,
      extraNotes: data.extraNotes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }

  private toPersistence(momentData: Moment): typeof moments.$inferInsert {
    return {
      id: momentData.id,
      sceneId: momentData.sceneId,
      name: momentData.name,
      location: momentData.location,
      index: momentData.index,
      summary: momentData.summary,
      isFavorite: momentData.isFavorite,
      extraNotes: momentData.extraNotes,
      createdAt: momentData.createdAt,
      updatedAt: momentData.updatedAt,
    }
  }

  async search(query: string, userId: string): Promise<Moment[]> {
    try {
      const results = await db
        .select({ moments: moments })
        .from(moments)
        .innerJoin(scenes, eq(moments.sceneId, scenes.id))
        .innerJoin(chapters, eq(scenes.chapterId, chapters.id))
        .innerJoin(story, eq(chapters.storyId, story.id))
        .where(
          and(
            eq(story.userId, userId),
            or(
              like(moments.name, `%${query}%`),
              like(moments.summary, `%${query}%`),
              like(moments.location, `%${query}%`),
              like(moments.extraNotes, `%${query}%`),
            ),
          ),
        )
      return results.map((result: { moments: Moment }) => result.moments)
    } catch (error) {
      console.error('Error in MomentRepository.search:', error)
      throw error
    }
  }
}
