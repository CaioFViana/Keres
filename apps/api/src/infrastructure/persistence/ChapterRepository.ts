import type { Chapter } from '@domain/entities/Chapter'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { ListQueryParams, PaginatedResponse } from '@keres/shared'

import { chapters, chapterTags, db, story } from '@infrastructure/db' // Import db and chapters table
import { and, asc, desc, eq, inArray, ilike, or, sql } from 'drizzle-orm'

export class ChapterRepository implements IChapterRepository {
  async findById(id: string): Promise<Chapter | null> {
    try {
      const result = db.select().from(chapters).where(eq(chapters.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in ChapterRepository.findById:', error)
      throw error
    }
  }

  async findByStoryId(storyId: string, query?: ListQueryParams): Promise<PaginatedResponse<Chapter>> {
    try {
      let baseQuery = db.select().from(chapters).where(eq(chapters.storyId, storyId));

      // Apply isFavorite filter directly
      if (query?.isFavorite !== undefined) {
        baseQuery = baseQuery.where(and(eq(chapters.storyId, storyId), eq(chapters.isFavorite, query.isFavorite)));
      }

      // Apply hasTags filter
      if (query?.hasTags) {
        const tagIds = query.hasTags.split(',');
        baseQuery = baseQuery
          .leftJoin(chapterTags, eq(chapters.id, chapterTags.chapterId))
          .where(and(eq(chapters.storyId, storyId), inArray(chapterTags.tagId, tagIds)));
      }

      // Apply generic filters
      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            switch (key) {
              case 'name':
                baseQuery = baseQuery.where(and(eq(chapters.storyId, storyId), ilike(chapters.name, `%${value}%`)));
                break;
              case 'summary':
                baseQuery = baseQuery.where(and(eq(chapters.storyId, storyId), ilike(chapters.summary, `%${value}%`)));
                break;
              case 'extraNotes':
                baseQuery = baseQuery.where(and(eq(chapters.storyId, storyId), ilike(chapters.extraNotes, `%${value}%`)));
                break;
              // Add other filterable fields here as needed
            }
          }
        }
      }

      // Build the count query based on the same filters
      // This requires rebuilding the query with only the necessary parts for counting
      let countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(chapters)
        .where(eq(chapters.storyId, storyId)); // Start with the base where clause

      // Apply isFavorite filter directly to count query
      if (query?.isFavorite !== undefined) {
        countQuery = countQuery.where(and(eq(chapters.storyId, storyId), eq(chapters.isFavorite, query.isFavorite)));
      }

      if (query?.hasTags) {
        const tagIds = query.hasTags.split(',');
        countQuery = countQuery
          .leftJoin(chapterTags, eq(chapters.id, chapterTags.chapterId))
          .where(and(eq(chapters.storyId, storyId), inArray(chapterTags.tagId, tagIds)));
      }

      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            switch (key) {
              case 'name':
                countQuery = countQuery.where(and(eq(chapters.storyId, storyId), ilike(chapters.name, `%${value}%`)));
                break;
              case 'summary':
                countQuery = countQuery.where(and(eq(chapters.storyId, storyId), ilike(chapters.summary, `%${value}%`)));
                break;
              case 'extraNotes':
                countQuery = countQuery.where(and(eq(chapters.storyId, storyId), ilike(chapters.extraNotes, `%${value}%`)));
                break;
              // Add other filterable fields here as needed
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
        name: chapters.name,
        index: chapters.index,
        createdAt: chapters.createdAt,
        updatedAt: chapters.updatedAt,
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
      console.error('Error in ChapterRepository.findByStoryId:', error)
      throw error
    }
  }

  async save(chapterData: Chapter): Promise<void> {
    try {
      await db.insert(chapters).values(this.toPersistence(chapterData))
    } catch (error) {
      console.error('Error in ChapterRepository.save:', error)
      throw error
    }
  }

  async update(chapterData: Chapter, storyId: string): Promise<void> {
    try {
      await db
        .update(chapters)
        .set(this.toPersistence(chapterData))
        .where(eq(chapters.id, chapterData.id), eq(chapters.storyId, storyId))
    } catch (error) {
      console.error('Error in ChapterRepository.update:', error)
      throw error
    }
  }

  async delete(id: string, storyId: string): Promise<void> {
    try {
      await db.delete(chapters).where(eq(chapters.id, id), eq(chapters.storyId, storyId))
    } catch (error) {
      console.error('Error in ChapterRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof chapters.$inferSelect): Chapter {
    return {
      id: data.id,
      storyId: data.storyId,
      name: data.name,
      index: data.index,
      summary: data.summary,
      isFavorite: data.isFavorite,
      extraNotes: data.extraNotes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }

  private toPersistence(chapterData: Chapter): typeof chapters.$inferInsert {
    return {
      id: chapterData.id,
      storyId: chapterData.storyId,
      name: chapterData.name,
      index: chapterData.index,
      summary: chapterData.summary,
      isFavorite: chapterData.isFavorite,
      extraNotes: chapterData.extraNotes,
      createdAt: chapterData.createdAt,
      updatedAt: chapterData.updatedAt,
    }
  }

  async search(query: string, userId: string): Promise<Chapter[]> {
    try {
      const results = await db
        .select({ chapters: chapters })
        .from(chapters)
        .innerJoin(story, eq(chapters.storyId, story.id))
        .where(
          and(
            eq(story.userId, userId),
            or(
              ilike(chapters.name, `%${query}%`),
              ilike(chapters.summary, `%${query}%`),
              ilike(chapters.extraNotes, `%${query}%`),
            ),
          ),
        )
      return results.map((result: { chapters: Chapter }) => this.toDomain(result.chapters))
    } catch (error) {
      console.error('Error in ChapterRepository.search:', error)
      throw error
    }
  }
}
