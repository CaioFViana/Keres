import type { Tag } from '@domain/entities/Tag'
import type { ITagRepository } from '@domain/repositories/ITagRepository'

import {
  chapters,
  chapterTags,
  characterTags,
  db,
  locations,
  locationTags,
  scenes,
  sceneTags,
  tags,
} from '@infrastructure/db'
import { and, asc, desc, eq, inArray, ilike, sql } from 'drizzle-orm'
import { ListQueryParams, PaginatedResponse } from '@keres/shared'

export class TagRepository implements ITagRepository {
  async findById(tagId: string): Promise<Tag | null> {
    try {
      const result = await db.select().from(tags).where(eq(tags.id, tagId)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in TagRepository.findById:', error)
      throw error
    }
  }

  async addTagToCharacter(characterId: string, tagId: string): Promise<void> {
    try {
      await db.insert(characterTags).values({ characterId, tagId })
    } catch (error) {
      console.error('Error in TagRepository.addTagToCharacter:', error)
      throw error
    }
  }

  async removeTagFromCharacter(characterId: string, tagId: string): Promise<void> {
    try {
      await db
        .delete(characterTags)
        .where(and(eq(characterTags.characterId, characterId), eq(characterTags.tagId, tagId)))
    } catch (error) {
      console.error('Error in TagRepository.removeTagFromCharacter:', error)
      throw error
    }
  }

  async addTagToLocation(locationId: string, tagId: string): Promise<void> {
    try {
      await db.insert(locationTags).values({ locationId, tagId })
    } catch (error) {
      console.error('Error in TagRepository.addTagToLocation:', error)
      throw error
    }
  }

  async removeTagFromLocation(locationId: string, tagId: string): Promise<void> {
    try {
      await db.delete(locationTags).where(and(eq(locations.id, locationId), eq(tags.id, tagId)))
    } catch (error) {
      console.error('Error in TagRepository.removeTagFromLocation:', error)
      throw error
    }
  }

  async addTagToChapter(chapterId: string, tagId: string): Promise<void> {
    try {
      await db.insert(chapterTags).values({ chapterId, tagId })
    } catch (error) {
      console.error('Error in TagRepository.addTagToChapter:', error)
      throw error
    }
  }

  async removeTagFromChapter(chapterId: string, tagId: string): Promise<void> {
    try {
      await db.delete(chapterTags).where(and(eq(chapters.id, chapterId), eq(tags.id, tagId)))
    } catch (error) {
      console.error('Error in TagRepository.removeTagFromChapter:', error)
      throw error
    }
  }

  async addTagToScene(sceneId: string, tagId: string): Promise<void> {
    try {
      await db.insert(sceneTags).values({ sceneId, tagId })
    } catch (error) {
      console.error('Error in TagRepository.addTagToScene:', error)
      throw error
    }
  }

  async removeTagFromScene(sceneId: string, tagId: string): Promise<void> {
    try {
      await db.delete(sceneTags).where(and(eq(scenes.id, sceneId), eq(tags.id, tagId)))
    } catch (error) {
      console.error('Error in TagRepository.removeTagFromScene:', error)
      throw error
    }
  }

  async findByStoryId(storyId: string, query?: ListQueryParams): Promise<PaginatedResponse<Tag>> {
    try {
      let baseQuery = db.select().from(tags).where(eq(tags.storyId, storyId));

      // Apply isFavorite filter directly
      if (query?.isFavorite !== undefined) {
        baseQuery = baseQuery.where(and(eq(tags.storyId, storyId), eq(tags.isFavorite, query.isFavorite)));
      }

      // Apply generic filters
      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            switch (key) {
              case 'name':
                baseQuery = baseQuery.where(and(eq(tags.storyId, storyId), ilike(tags.name, `%${value}%`)));
                break;
              case 'color':
                baseQuery = baseQuery.where(and(eq(tags.storyId, storyId), ilike(tags.color, `%${value}%`)));
                break;
              case 'extraNotes':
                baseQuery = baseQuery.where(and(eq(tags.storyId, storyId), ilike(tags.extraNotes, `%${value}%`)));
                break;
              // Add other filterable fields here as needed
            }
          }
        }
      }

      // Build the count query based on the same filters
      let countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(tags)
        .where(eq(tags.storyId, storyId)); // Start with the base where clause

      // Apply isFavorite filter directly to count query
      if (query?.isFavorite !== undefined) {
        countQuery = countQuery.where(and(eq(tags.storyId, storyId), eq(tags.isFavorite, query.isFavorite)));
      }

      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            switch (key) {
              case 'name':
                countQuery = countQuery.where(and(eq(tags.storyId, storyId), ilike(tags.name, `%${value}%`)));
                break;
              case 'color':
                countQuery = countQuery.where(and(eq(tags.storyId, storyId), ilike(tags.color, `%${value}%`)));
                break;
              case 'extraNotes':
                countQuery = countQuery.where(and(eq(tags.storyId, storyId), ilike(tags.extraNotes, `%${value}%`)));
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

      // Sorting
      const sortableFields = {
        name: tags.name,
        createdAt: tags.createdAt,
        updatedAt: tags.updatedAt,
        // Add other sortable fields here
      };
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
      console.error('Error in TagRepository.findByStoryId:', error);
      throw error;
    }
  }

  async deleteCharacterTagsByCharacterId(characterId: string): Promise<void> {
    try {
      await db.delete(characterTags).where(eq(characterTags.characterId, characterId));
    } catch (error) {
      console.error('Error in TagRepository.deleteCharacterTagsByCharacterId:', error);
      throw error;
    }
  }

  async deleteLocationTagsByLocationId(locationId: string): Promise<void> {
    try {
      await db.delete(locationTags).where(eq(locationTags.locationId, locationId));
    } catch (error) {
      console.error('Error in TagRepository.deleteLocationTagsByLocationId:', error);
      throw error;
    }
  }

  async deleteChapterTagsByChapterId(chapterId: string): Promise<void> {
    try {
      await db.delete(chapterTags).where(eq(chapterTags.chapterId, chapterId));
    } catch (error) {
      console.error('Error in TagRepository.deleteChapterTagsByChapterId:', error);
      throw error;
    }
  }

  async deleteSceneTagsBySceneId(sceneId: string): Promise<void> {
    try {
      await db.delete(sceneTags).where(eq(sceneTags.sceneId, sceneId));
    } catch (error) {
      console.error('Error in TagRepository.deleteSceneTagsBySceneId:', error);
      throw error;
    }
  }

  async delete(id: string, storyId: string): Promise<void> {
    try {
      await db.delete(tags).where(and(eq(tags.id, id), eq(tags.storyId, storyId)))
    } catch (error) {
      console.error('Error in TagRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof tags.$inferSelect): Tag {
    return {
      id: data.id,
      storyId: data.storyId,
      name: data.name,
      color: data.color,
      isFavorite: data.isFavorite,
      extraNotes: data.extraNotes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }
}
