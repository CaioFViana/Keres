import type { Suggestion } from '@domain/entities/Suggestion'
import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'

import { db, suggestions } from '@keres/db' // Import db and suggestions table
import { and, eq } from 'drizzle-orm'

export class SuggestionRepository implements ISuggestionRepository {
  constructor() {}

  async findById(id: string): Promise<Suggestion | null> {
    try {
      const result = await db.select().from(suggestions).where(eq(suggestions.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in SuggestionRepository.findById:', error)
      throw error
    }
  }

  async findByUserId(userId: string): Promise<Suggestion[]> {
    try {
      const results = await db.select().from(suggestions).where(eq(suggestions.userId, userId))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in SuggestionRepository.findByUserId:', error)
      throw error
    }
  }

  async findByStoryId(storyId: string): Promise<Suggestion[]> {
    try {
      const results = await db.select().from(suggestions).where(eq(suggestions.storyId, storyId))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in SuggestionRepository.findByStoryId:', error)
      throw error
    }
  }

  async findByType(type: string): Promise<Suggestion[]> {
    try {
      const results = await db.select().from(suggestions).where(eq(suggestions.type, type))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in SuggestionRepository.findByType:', error)
      throw error
    }
  }

  async findByUserAndType(userId: string, type: string): Promise<Suggestion[]> {
    try {
      const results = await db
        .select()
        .from(suggestions)
        .where(and(eq(suggestions.userId, userId), eq(suggestions.type, type)))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in SuggestionRepository.findByUserAndType:', error)
      throw error
    }
  }

  async findByStoryAndType(storyId: string, type: string): Promise<Suggestion[]> {
    try {
      const results = await db
        .select()
        .from(suggestions)
        .where(and(eq(suggestions.storyId, storyId), eq(suggestions.type, type)))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in SuggestionRepository.findByStoryAndType:', error)
      throw error
    }
  }

  async save(suggestionData: Suggestion): Promise<void> {
    try {
      await db.insert(suggestions).values(this.toPersistence(suggestionData))
    } catch (error) {
      console.error('Error in SuggestionRepository.save:', error)
      throw error
    }
  }

  async update(
    suggestionData: Suggestion,
    userId: string,
    scope: string,
    storyId: string | null,
  ): Promise<void> {
    try {
      const conditions = [eq(suggestions.id, suggestionData.id), eq(suggestions.userId, userId)]

      if (scope === 'story') {
        if (storyId) {
          conditions.push(eq(suggestions.storyId, storyId))
        } else {
          // This case should ideally be caught by the use case, but as a safeguard
          conditions.push(eq(suggestions.storyId, null as any)) // Ensure it never matches
        }
      } else if (scope === 'global') {
        conditions.push(eq(suggestions.storyId, null as any))
      }

      await db
        .update(suggestions)
        .set(this.toPersistence(suggestionData))
        .where(and(...conditions))
    } catch (error) {
      console.error('Error in SuggestionRepository.update:', error)
      throw error
    }
  }

  async delete(id: string, userId: string, scope: string, storyId: string | null): Promise<void> {
    try {
      const conditions = [eq(suggestions.id, id), eq(suggestions.userId, userId)]

      if (scope === 'story') {
        if (storyId) {
          conditions.push(eq(suggestions.storyId, storyId))
        } else {
          // This case should ideally be caught by the use case, but as a safeguard
          conditions.push(eq(suggestions.storyId, null as any)) // Ensure it never matches
        }
      } else if (scope === 'global') {
        conditions.push(eq(suggestions.storyId, null as any))
      }

      await db.delete(suggestions).where(and(...conditions))
    } catch (error) {
      console.error('Error in SuggestionRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof suggestions.$inferSelect): Suggestion {
    return {
      id: data.id,
      userId: data.userId,
      scope: data.scope as 'global' | 'story', // Type assertion for enum
      storyId: data.storyId,
      type: data.type,
      value: data.value,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }

  private toPersistence(suggestionData: Suggestion): typeof suggestions.$inferInsert {
    return {
      id: suggestionData.id,
      userId: suggestionData.userId,
      scope: suggestionData.scope,
      storyId: suggestionData.storyId,
      type: suggestionData.type,
      value: suggestionData.value,
      createdAt: suggestionData.createdAt,
      updatedAt: suggestionData.updatedAt,
    }
  }
}
