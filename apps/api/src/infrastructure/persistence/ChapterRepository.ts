import type { Chapter } from '@domain/entities/Chapter'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { ListQueryParams } from '@keres/shared'

import { chapters, chapterTags, db, story } from '@keres/db' // Import db and chapters table
import { and, asc, desc, eq, inArray, like, or } from 'drizzle-orm'

export class ChapterRepository implements IChapterRepository {
  async findById(id: string): Promise<Chapter | null> {
    try {
      const result = await db.select().from(chapters).where(eq(chapters.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in ChapterRepository.findById:', error)
      throw error
    }
  }

  async findByStoryId(storyId: string, query?: ListQueryParams): Promise<Chapter[]> {
    try {
      let queryBuilder = db.select().from(chapters).where(eq(chapters.storyId, storyId))

      // Define allowed filterable fields and their Drizzle column mappings
      const filterableFields = {
        name: chapters.name,
        summary: chapters.summary,
        isFavorite: chapters.isFavorite,
        // Add other filterable fields here
      }

      // Define allowed sortable fields and their Drizzle column mappings
      const sortableFields = {
        name: chapters.name,
        index: chapters.index,
        createdAt: chapters.createdAt,
        updatedAt: chapters.updatedAt,
        // Add other sortable fields here
      }

      if (query?.hasTags) {
        const tagIds = query.hasTags.split(',')
        queryBuilder = queryBuilder
          .leftJoin(chapterTags, eq(chapters.id, chapterTags.chapterId))
          .where(and(eq(chapters.storyId, storyId), inArray(chapterTags.tagId, tagIds)))
      }

      // Generic filtering (Revised)
      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key]
            const column = filterableFields[key as keyof typeof filterableFields]
            if (column) {
              queryBuilder = queryBuilder.where(
                and(eq(chapters.storyId, storyId), eq(column, value)),
              )
            }
          }
        }
      }

      // Sorting (Revised)
      if (query?.sort_by) {
        const sortColumn = sortableFields[query.sort_by as keyof typeof sortableFields]
        if (sortColumn) {
          if (query.order === 'desc') {
            queryBuilder = queryBuilder.orderBy(desc(sortColumn))
          } else {
            queryBuilder = queryBuilder.orderBy(asc(sortColumn))
          }
        }
      }

      // Pagination
      if (query?.limit) {
        queryBuilder = queryBuilder.limit(query.limit)
        if (query.page) {
          const offset = (query.page - 1) * query.limit
          queryBuilder = queryBuilder.offset(offset)
        }
      }

      const results = await queryBuilder
      return results.map(this.toDomain)
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
              like(chapters.name, `%${query}%`),
              like(chapters.summary, `%${query}%`),
              like(chapters.extraNotes, `%${query}%`),
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
