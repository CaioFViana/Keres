import { eq } from 'drizzle-orm';
import { db } from '@keres/db';
import { moments } from '@keres/db/src/schema';
import { Moment } from '@domain/entities/Moment';
import { IMomentRepository } from '@domain/repositories/IMomentRepository';

export class MomentRepository implements IMomentRepository {
  constructor() {
    console.log('MomentRepository constructor called.');
  }

  async findById(id: string): Promise<Moment | null> {
    console.log('MomentRepository.findById called.');
    try {
      const result = await db.select().from(moments).where(eq(moments.id, id)).limit(1);
      return result.length > 0 ? this.toDomain(result[0]) : null;
    } catch (error) {
      console.error('Error in MomentRepository.findById:', error);
      throw error;
    }
  }

  async findBySceneId(sceneId: string): Promise<Moment[]> {
    console.log('MomentRepository.findBySceneId called.');
    try {
      const results = await db.select().from(moments).where(eq(moments.sceneId, sceneId));
      return results.map(this.toDomain);
    } catch (error) {
      console.error('Error in MomentRepository.findBySceneId:', error);
      throw error;
    }
  }

  async save(momentData: Moment): Promise<void> {
    console.log('MomentRepository.save called.');
    try {
      await db.insert(moments).values(this.toPersistence(momentData));
    } catch (error) {
      console.error('Error in MomentRepository.save:', error);
      throw error;
    }
  }

  async update(momentData: Moment): Promise<void> {
    console.log('MomentRepository.update called.');
    try {
      await db.update(moments).set(this.toPersistence(momentData)).where(eq(moments.id, momentData.id));
    } catch (error) {
      console.error('Error in MomentRepository.update:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    console.log('MomentRepository.delete called.');
    try {
      await db.delete(moments).where(eq(moments.id, id));
    } catch (error) {
      console.error('Error in MomentRepository.delete:', error);
      throw error;
    }
  }

  private toDomain(data: typeof moments.$inferSelect): Moment {
    console.log('MomentRepository.toDomain called.');
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
    };
  }

  private toPersistence(momentData: Moment): typeof moments.$inferInsert {
    console.log('MomentRepository.toPersistence called.');
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
    };
  }
}
