import { eq, or } from 'drizzle-orm';
import { db, relations } from '@keres/db'; // Import db and relations table
import { Relation } from '@domain/entities/Relation';
import { IRelationRepository } from '@domain/repositories/IRelationRepository';

export class RelationRepository implements IRelationRepository {
  constructor() {
    console.log('RelationRepository constructor called.');
  }

  async findById(id: string): Promise<Relation | null> {
    console.log('RelationRepository.findById called.');
    try {
      const result = await db.select().from(relations).where(eq(relations.id, id)).limit(1);
      return result.length > 0 ? this.toDomain(result[0]) : null;
    } catch (error) {
      console.error('Error in RelationRepository.findById:', error);
      throw error;
    }
  }

  async findByCharId(charId: string): Promise<Relation[]> {
    console.log('RelationRepository.findByCharId called.');
    try {
      const results = await db.select().from(relations).where(or(eq(relations.charIdSource, charId), eq(relations.charIdTarget, charId)));
      return results.map(this.toDomain);
    } catch (error) {
      console.error('Error in RelationRepository.findByCharId:', error);
      throw error;
    }
  }

  async save(relationData: Relation): Promise<void> {
    console.log('RelationRepository.save called.');
    try {
      await db.insert(relations).values(this.toPersistence(relationData));
    } catch (error) {
      console.error('Error in RelationRepository.save:', error);
      throw error;
    }
  }

  async update(relationData: Relation): Promise<void> {
    console.log('RelationRepository.update called.');
    try {
      await db.update(relations).set(this.toPersistence(relationData)).where(eq(relations.id, relationData.id));
    } catch (error) {
      console.error('Error in RelationRepository.update:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    console.log('RelationRepository.delete called.');
    try {
      await db.delete(relations).where(eq(relations.id, id));
    } catch (error) {
      console.error('Error in RelationRepository.delete:', error);
      throw error;
    }
  }

  private toDomain(data: typeof relations.$inferSelect): Relation {
    console.log('RelationRepository.toDomain called.');
    return {
      id: data.id,
      charIdSource: data.charIdSource,
      charIdTarget: data.charIdTarget,
      sceneId: data.sceneId,
      momentId: data.momentId,
      summary: data.summary,
      isFavorite: data.isFavorite,
      extraNotes: data.extraNotes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  private toPersistence(relationData: Relation): typeof relations.$inferInsert {
    console.log('RelationRepository.toPersistence called.');
    return {
      id: relationData.id,
      charIdSource: relationData.charIdSource,
      charIdTarget: relationData.charIdTarget,
      sceneId: relationData.sceneId,
      momentId: relationData.momentId,
      summary: relationData.summary,
      isFavorite: relationData.isFavorite,
      extraNotes: relationData.extraNotes,
      createdAt: relationData.createdAt,
      updatedAt: relationData.updatedAt,
    };
  }
}