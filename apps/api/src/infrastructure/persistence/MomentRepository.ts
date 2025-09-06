import type { Moment } from '@domain/entities/Moment'
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'
import type { ListQueryParams } from '@keres/shared'

import { db, moments } from '@keres/db' // Import db and moments table
import { and, eq } from 'drizzle-orm'

export class MomentRepository implements IMomentRepository {
  async findById(id: string): Promise<Moment | null> {
    try {
      const result = await db.select().from(moments).where(eq(moments.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in MomentRepository.findById:', error)
      throw error
    }
  }

  async findBySceneId(sceneId: string, query?: ListQueryParams): Promise<Moment[]> {
    try {
      let queryBuilder = db.select().from(moments).where(eq(moments.sceneId, sceneId))

      if (query?.isFavorite !== undefined) {
        queryBuilder = queryBuilder.where(
          and(eq(moments.sceneId, sceneId), eq(moments.isFavorite, query.isFavorite)),
        )
      }

      const results = await queryBuilder
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in MomentRepository.findBySceneId:', error)
      throw error
    }
  }

  async save(momentData: Moment): Promise<void> {
    try {
      await db.insert(moments).values(this.toPersistence(momentData))
    } catch (error) {
      console.error('Error in MomentRepository.save:', error)
      throw error
    }
  }

  async update(momentData: Moment, sceneId: string): Promise<void> {
    try {
      await db
        .update(moments)
        .set(this.toPersistence(momentData))
        .where(eq(moments.id, momentData.id), eq(moments.sceneId, sceneId))
    } catch (error) {
      console.error('Error in MomentRepository.update:', error)
      throw error
    }
  }

  async delete(id: string, sceneId: string): Promise<void> {
    try {
      await db.delete(moments).where(eq(moments.id, id), eq(moments.sceneId, sceneId))
    } catch (error) {
      console.error('Error in MomentRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof moments.$inferSelect): Moment {
    return {
      id: data.id,
      sceneId: data.sceneId,
      name: data.name,
      location: data.location,
      index: data.index,
      summary: data.summary,
      isFavorite: data.isFavorite,
      extraNotes: data.extraNotes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }

  private toPersistence(momentData: Moment): typeof moments.$inferInsert {
    return {
      id: momentData.id,
      sceneId: momentData.sceneId,
      name: momentData.name,
      location: momentData.location,
      index: momentData.index,
      summary: momentData.summary,
      isFavorite: momentData.isFavorite,
      extraNotes: momentData.extraNotes,
      createdAt: momentData.createdAt,
      updatedAt: momentData.updatedAt,
    }
  }
}
