import type { WorldRule } from '@domain/entities/WorldRule'
import type { IWorldRuleRepository } from '@domain/repositories/IWorldRuleRepository'

import { db, worldRules } from '@keres/db' // Import db and worldRules table
import { eq } from 'drizzle-orm'

export class WorldRuleRepository implements IWorldRuleRepository {
  constructor() {
    console.log('WorldRuleRepository constructor called.')
  }

  async findById(id: string): Promise<WorldRule | null> {
    console.log('WorldRuleRepository.findById called.')
    try {
      const result = await db.select().from(worldRules).where(eq(worldRules.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in WorldRuleRepository.findById:', error)
      throw error
    }
  }

  async findByStoryId(storyId: string): Promise<WorldRule[]> {
    console.log('WorldRuleRepository.findByStoryId called.')
    try {
      const results = await db.select().from(worldRules).where(eq(worldRules.storyId, storyId))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in WorldRuleRepository.findByStoryId:', error)
      throw error
    }
  }

  async save(worldRuleData: WorldRule): Promise<void> {
    console.log('WorldRuleRepository.save called.')
    try {
      await db.insert(worldRules).values(this.toPersistence(worldRuleData))
    } catch (error) {
      console.error('Error in WorldRuleRepository.save:', error)
      throw error
    }
  }

  async update(worldRuleData: WorldRule): Promise<void> {
    console.log('WorldRuleRepository.update called.')
    try {
      await db
        .update(worldRules)
        .set(this.toPersistence(worldRuleData))
        .where(eq(worldRules.id, worldRuleData.id))
    } catch (error) {
      console.error('Error in WorldRuleRepository.update:', error)
      throw error
    }
  }

  async delete(id: string): Promise<void> {
    console.log('WorldRuleRepository.delete called.')
    try {
      await db.delete(worldRules).where(eq(worldRules.id, id))
    } catch (error) {
      console.error('Error in WorldRuleRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof worldRules.$inferSelect): WorldRule {
    console.log('WorldRuleRepository.toDomain called.')
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
    console.log('WorldRuleRepository.toPersistence called.')
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
}
