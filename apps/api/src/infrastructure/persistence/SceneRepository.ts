import type { Scene } from '@domain/entities/Scene'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'

import { db, scenes } from '@keres/db' // Import db and scenes table
import { eq } from 'drizzle-orm'

export class SceneRepository implements ISceneRepository {
  constructor() {}

  async findById(id: string): Promise<Scene | null> {
    try {
      const result = await db.select().from(scenes).where(eq(scenes.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in SceneRepository.findById:', error)
      throw error
    }
  }

  async findByChapterId(chapterId: string): Promise<Scene[]> {
    try {
      const results = await db.select().from(scenes).where(eq(scenes.chapterId, chapterId))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in SceneRepository.findByChapterId:', error)
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
}
