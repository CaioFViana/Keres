import type { WorldRule } from '@domain/entities/WorldRule'
import type { IWorldRuleRepository } from '@domain/repositories/IWorldRuleRepository'
import type { ListQueryParams } from '@keres/shared'

import { db, worldRules, story } from '@keres/db' // Import db and worldRules table
import { and, eq, like, or } from 'drizzle-orm'

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

  async findByStoryId(storyId: string, query?: ListQueryParams): Promise<WorldRule[]> {
    try {
      let queryBuilder = db.select().from(worldRules).where(eq(worldRules.storyId, storyId))

      if (query?.isFavorite !== undefined) {
        queryBuilder = queryBuilder.where(
          and(eq(worldRules.storyId, storyId), eq(worldRules.isFavorite, query.isFavorite)),
        )
      }

      const results = await queryBuilder
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in WorldRuleRepository.findByStoryId:', error)
      throw error
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
      return results.map((result: {worldRules: WorldRule}) => this.toDomain(result.worldRules))
    } catch (error) {
      console.error('Error in WorldRuleRepository.search:', error)
      throw error
    }
  }
}
