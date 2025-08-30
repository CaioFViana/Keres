import { eq } from 'drizzle-orm';
import { db } from '@keres/db';
import { scenes } from '@keres/db/src/schema';
import { Scene } from '@domain/entities/Scene';
import { ISceneRepository } from '@domain/repositories/ISceneRepository';

export class SceneRepository implements ISceneRepository {
  constructor() {
    console.log('SceneRepository constructor called.');
  }

  async findById(id: string): Promise<Scene | null> {
    console.log('SceneRepository.findById called.');
    try {
      const result = await db.select().from(scenes).where(eq(scenes.id, id)).limit(1);
      return result.length > 0 ? this.toDomain(result[0]) : null;
    } catch (error) {
      console.error('Error in SceneRepository.findById:', error);
      throw error;
    }
  }

  async findByChapterId(chapterId: string): Promise<Scene[]> {
    console.log('SceneRepository.findByChapterId called.');
    try {
      const results = await db.select().from(scenes).where(eq(scenes.chapterId, chapterId));
      return results.map(this.toDomain);
    } catch (error) {
      console.error('Error in SceneRepository.findByChapterId:', error);
      throw error;
    }
  }

  async save(sceneData: Scene): Promise<void> {
    console.log('SceneRepository.save called.');
    try {
      await db.insert(scenes).values(this.toPersistence(sceneData));
    } catch (error) {
      console.error('Error in SceneRepository.save:', error);
      throw error;
    }
  }

  async update(sceneData: Scene): Promise<void> {
    console.log('SceneRepository.update called.');
    try {
      await db.update(scenes).set(this.toPersistence(sceneData)).where(eq(scenes.id, sceneData.id));
    } catch (error) {
      console.error('Error in SceneRepository.update:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    console.log('SceneRepository.delete called.');
    try {
      await db.delete(scenes).where(eq(scenes.id, id));
    } catch (error) {
      console.error('Error in SceneRepository.delete:', error);
      throw error;
    }
  }

  private toDomain(data: typeof scenes.$inferSelect): Scene {
    console.log('SceneRepository.toDomain called.');
    return {
      id: data.id,
      chapterId: data.chapterId,
      name: data.name,
      index: data.index,
      summary: data.summary,
      gap: data.gap,
      duration: data.duration,
      isFavorite: data.isFavorite,
      extraNotes: data.extraNotes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  private toPersistence(sceneData: Scene): typeof scenes.$inferInsert {
    console.log('SceneRepository.toPersistence called.');
    return {
      id: sceneData.id,
      chapterId: sceneData.chapterId,
      name: sceneData.name,
      index: sceneData.index,
      summary: sceneData.summary,
      gap: sceneData.gap,
      duration: sceneData.duration,
      isFavorite: sceneData.isFavorite,
      extraNotes: sceneData.extraNotes,
      createdAt: sceneData.createdAt,
      updatedAt: sceneData.updatedAt,
    };
  }
}
