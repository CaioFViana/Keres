import type { Story } from '@domain/entities/Story'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { ListQueryParams, PaginatedResponse } from '@keres/shared'

import { db, story } from '@infrastructure/db' // Import db and stories table
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'

export class StoryRepository implements IStoryRepository {
  async findById(id: string, userId: string): Promise<Story | null> {
    try {
      const result = await db
        .select()
        .from(story)
        .where(eq(story.id, id), eq(story.userId, userId))
        .limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in StoryRepository.findById:', error)
      throw error
    }
  }

  async findByUserId(userId: string, query?: ListQueryParams): Promise<PaginatedResponse<Story>> {
    try {
      let baseQuery = db.select().from(story).where(eq(story.userId, userId))

      // Apply isFavorite filter directly
      if (query?.isFavorite !== undefined) {
        baseQuery = baseQuery.where(and(eq(story.userId, userId), eq(story.isFavorite, query.isFavorite)))
      }

      // Apply filters based on specific keys
      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key]
            switch (key) {
              case 'title':
                baseQuery = baseQuery.where(and(eq(story.userId, userId), ilike(story.title, `%${value}%`)))
                break
              case 'type':
                baseQuery = baseQuery.where(and(eq(story.userId, userId), eq(story.type, value)))
                break
              case 'summary':
                baseQuery = baseQuery.where(and(eq(story.userId, userId), ilike(story.summary, `%${value}%`)))
                break
              case 'genre':
                baseQuery = baseQuery.where(and(eq(story.userId, userId), ilike(story.genre, `%${value}%`)))
                break
              case 'language':
                baseQuery = baseQuery.where(and(eq(story.userId, userId), eq(story.language, value)))
                break
              case 'extraNotes':
                baseQuery = baseQuery.where(and(eq(story.userId, userId), ilike(story.extraNotes, `%${value}%`)))
                break
              // Add other filterable fields here as needed
            }
          }
        }
      }

      // Build the count query based on the same filters
      let countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(story)
        .where(eq(story.userId, userId)) // Start with the base where clause

      // Apply isFavorite filter directly to count query
      if (query?.isFavorite !== undefined) {
        countQuery = countQuery.where(and(eq(story.userId, userId), eq(story.isFavorite, query.isFavorite)))
      }

      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key]
            switch (key) {
              case 'title':
                countQuery = countQuery.where(and(eq(story.userId, userId), ilike(story.title, `%${value}%`)))
                break
              case 'type':
                countQuery = countQuery.where(and(eq(story.userId, userId), eq(story.type, value)))
                break
              case 'summary':
                countQuery = countQuery.where(and(eq(story.userId, userId), ilike(story.summary, `%${value}%`)))
                break
              case 'genre':
                countQuery = countQuery.where(and(eq(story.userId, userId), ilike(story.genre, `%${value}%`)))
                break
              case 'language':
                countQuery = countQuery.where(and(eq(story.userId, userId), eq(story.language, value)))
                break
              case 'extraNotes':
                countQuery = countQuery.where(and(eq(story.userId, userId), ilike(story.extraNotes, `%${value}%`)))
                break
              // Add other filterable fields here as needed
            }
          }
        }
      }

      const totalItemsResult = await countQuery;
      const totalItems = totalItemsResult[0].count;

      // Now apply sorting and pagination to the main query
      let finalQuery = baseQuery;

      // Sorting
      const sortableFields = {
        title: story.title,
        createdAt: story.createdAt,
        updatedAt: story.updatedAt,
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
      console.error('Error in StoryRepository.findByUserId:', error);
      throw error;
    }
  }

  async save(storyData: Story): Promise<void> {
    try {
      await db.insert(story).values(this.toPersistence(storyData))
    } catch (error) {
      console.error('Error in StoryRepository.save:', error)
      throw error
    }
  }

  async update(storyData: Story, userId: string): Promise<void> {
    try {
      await db
        .update(story)
        .set(this.toPersistence(storyData))
        .where(eq(story.id, storyData.id), eq(story.userId, userId))
    } catch (error) {
      console.error('Error in StoryRepository.update:', error)
      throw error
    }
  }

  async delete(id: string, userId: string): Promise<void> {
    try {
      await db.delete(story).where(eq(story.id, id), eq(story.userId, userId))
    } catch (error) {
      console.error('Error in StoryRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof story.$inferSelect): Story {
    return {
      id: data.id,
      userId: data.userId,
      title: data.title,
      type: data.type === 'linear' ? data.type : 'branching',
      summary: data.summary,
      genre: data.genre,
      language: data.language,
      isFavorite: data.isFavorite,
      extraNotes: data.extraNotes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }

  private toPersistence(storyData: Story): typeof story.$inferInsert {
    return {
      id: storyData.id,
      userId: storyData.userId,
      title: storyData.title,
      type: storyData.type,
      summary: storyData.summary,
      genre: storyData.genre,
      language: storyData.language,
      isFavorite: storyData.isFavorite,
      extraNotes: storyData.extraNotes,
      createdAt: storyData.createdAt,
      updatedAt: storyData.updatedAt,
    }
  }

  async search(query: string, userId: string): Promise<Story[]> {
    try {
      const results = await db
        .select()
        .from(story)
        .where(
          and(
            eq(story.userId, userId),
            or(ilike(story.title, `%${query}%`), ilike(story.summary, `%${query}%`)),
          ),
        )
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in StoryRepository.search:', error)
      throw error
    }
  }
}
