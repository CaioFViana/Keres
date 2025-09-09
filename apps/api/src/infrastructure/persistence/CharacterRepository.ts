import type { Character } from '@domain/entities/Character'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { ListQueryParams } from '@keres/shared'

import { characters, characterTags, db, story } from '@keres/db' // Import db and characters table
import { and, asc, desc, eq, inArray, like, or } from 'drizzle-orm'

export class CharacterRepository implements ICharacterRepository {
  async findById(id: string): Promise<Character | null> {
    try {
      const result = await db.select().from(characters).where(eq(characters.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in CharacterRepository.findById:', error)
      throw error
    }
  }

  async findByStoryId(storyId: string, query?: ListQueryParams): Promise<Character[]> {
    try {
      let queryBuilder = db.select().from(characters).where(eq(characters.storyId, storyId))

      // Define allowed filterable fields and their Drizzle column mappings
      const filterableFields = {
        name: characters.name,
        gender: characters.gender,
        race: characters.race,
        subrace: characters.subrace,
        isFavorite: characters.isFavorite,
        // Add other filterable fields here
      }

      // Define allowed sortable fields and their Drizzle column mappings
      const sortableFields = {
        name: characters.name,
        createdAt: characters.createdAt,
        updatedAt: characters.updatedAt,
        // Add other sortable fields here
      }

      if (query?.hasTags) {
        const tagIds = query.hasTags.split(',')
        queryBuilder = queryBuilder
          .leftJoin(characterTags, eq(characters.id, characterTags.characterId))
          .where(and(eq(characters.storyId, storyId), inArray(characterTags.tagId, tagIds)))
      }

      // Generic filtering (Revised)
      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.prototype.hasOwnProperty.call(query.filter, key)) {
            const value = query.filter[key]
            const column = filterableFields[key as keyof typeof filterableFields]
            if (column) {
              queryBuilder = queryBuilder.where(and(eq(characters.storyId, storyId), eq(column, value)))
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
      console.error('Error in CharacterRepository.findByStoryId:', error)
      throw error
    }
  }

  // New findByIds method
  async findByIds(ids: string[]): Promise<Character[]> {
    try {
      if (ids.length === 0) {
        return []
      }
      const results = await db.select().from(characters).where(inArray(characters.id, ids))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in CharacterRepository.findByIds:', error)
      throw error
    }
  }

  async save(characterData: Character): Promise<void> {
    try {
      await db.insert(characters).values(this.toPersistence(characterData))
    } catch (error) {
      console.error('Error in CharacterRepository.save:', error)
      throw error
    }
  }

  async saveMany(charactersData: Character[]): Promise<void> {
    try {
      if (charactersData.length === 0) {
        return
      }
      const persistenceData = charactersData.map(this.toPersistence)
      await db.insert(characters).values(persistenceData)
    } catch (error) {
      console.error('Error in CharacterRepository.saveMany:', error)
      throw error
    }
  }

  async update(characterData: Character, storyId: string): Promise<void> {
    try {
      await db
        .update(characters)
        .set(this.toPersistence(characterData))
        .where(eq(characters.id, characterData.id), eq(characters.storyId, storyId))
    } catch (error) {
      console.error('Error in CharacterRepository.update:', error)
      throw error
    }
  }

  async updateMany(charactersData: Character[]): Promise<void> {
    try {
      if (charactersData.length === 0) {
        return
      }
      await db.transaction(async (tx) => {
        for (const characterData of charactersData) {
          await tx
            .update(characters)
            .set(this.toPersistence(characterData))
            .where(eq(characters.id, characterData.id))
        }
      })
    } catch (error) {
      console.error('Error in CharacterRepository.updateMany:', error)
      throw error
    }
  }

  async delete(id: string, storyId: string): Promise<void> {
    try {
      await db.delete(characters).where(eq(characters.id, id), eq(characters.storyId, storyId))
    } catch (error) {
      console.error('Error in CharacterRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof characters.$inferSelect): Character {
    return {
      id: data.id,
      storyId: data.storyId,
      name: data.name,
      gender: data.gender,
      race: data.race,
      subrace: data.subrace,
      description: data.description,
      personality: data.personality,
      motivation: data.motivation,
      qualities: data.qualities,
      weaknesses: data.weaknesses,
      biography: data.biography,
      plannedTimeline: data.plannedTimeline,
      isFavorite: data.isFavorite,
      extraNotes: data.extraNotes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }

  private toPersistence(characterData: Character): typeof characters.$inferInsert {
    return {
      id: characterData.id,
      storyId: characterData.storyId,
      name: characterData.name,
      gender: characterData.gender,
      race: characterData.race,
      subrace: characterData.subrace,
      personality: characterData.personality,
      motivation: characterData.motivation,
      qualities: characterData.qualities,
      weaknesses: characterData.weaknesses,
      biography: characterData.biography,
      plannedTimeline: characterData.plannedTimeline,
      isFavorite: characterData.isFavorite,
      extraNotes: characterData.extraNotes,
      createdAt: characterData.createdAt,
      updatedAt: characterData.updatedAt,
    }
  }

  async search(query: string, userId: string): Promise<Character[]> {
    try {
      const results = await db
        .select({ characters: characters })
        .from(characters)
        .innerJoin(story, eq(characters.storyId, story.id))
        .where(
          and(
            eq(story.userId, userId),
            or(
              like(characters.name, `%${query}%`),
              like(characters.description, `%${query}%`),
              like(characters.personality, `%${query}%`),
              like(characters.biography, `%${query}%`),
              like(characters.extraNotes, `%${query}%`),
            ),
          ),
        )
      return results.map((result: {characters: Character}) => this.toDomain(result.characters))
    } catch (error) {
      console.error('Error in CharacterRepository.search:', error)
      throw error
    }
  }
}
