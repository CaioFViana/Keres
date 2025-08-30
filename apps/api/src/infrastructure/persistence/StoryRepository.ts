import { eq } from 'drizzle-orm';
import { db, stories } from '@keres/db'; // Import db and stories table
import { Story } from '@domain/entities/Story';
import { IStoryRepository } from '@domain/repositories/IStoryRepository';

export class StoryRepository implements IStoryRepository {
  constructor() {
    console.log('StoryRepository constructor called.');
  }

  async findById(id: string): Promise<Story | null> {
    console.log('StoryRepository.findById called.');
    try {
      const result = await db.select().from(stories).where(eq(stories.id, id)).limit(1);
      return result.length > 0 ? this.toDomain(result[0]) : null;
    } catch (error) {
      console.error('Error in StoryRepository.findById:', error);
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<Story[]> {
    console.log('StoryRepository.findByUserId called.');
    try {
      const results = await db.select().from(stories).where(eq(stories.userId, userId));
      return results.map(this.toDomain);
    } catch (error) {
      console.error('Error in StoryRepository.findByUserId:', error);
      throw error;
    }
  }

  async save(storyData: Story): Promise<void> {
    console.log('StoryRepository.save called.');
    try {
      await db.insert(stories).values(this.toPersistence(storyData));
    } catch (error) {
      console.error('Error in StoryRepository.save:', error);
      throw error;
    }
  }

  async update(storyData: Story): Promise<void> {
    console.log('StoryRepository.update called.');
    try {
      await db.update(stories).set(this.toPersistence(storyData)).where(eq(stories.id, storyData.id));
    } catch (error) {
      console.error('Error in StoryRepository.update:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    console.log('StoryRepository.delete called.');
    try {
      await db.delete(stories).where(eq(stories.id, id));
    } catch (error) {
      console.error('Error in StoryRepository.delete:', error);
      throw error;
    }
  }

  private toDomain(data: typeof stories.$inferSelect): Story {
    console.log('StoryRepository.toDomain called.');
    return {
      id: data.id,
      userId: data.userId,
      title: data.title,
      summary: data.summary,
      genre: data.genre,
      language: data.language,
      isFavorite: data.isFavorite,
      extraNotes: data.extraNotes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  private toPersistence(storyData: Story): typeof stories.$inferInsert {
    console.log('StoryRepository.toPersistence called.');
    return {
      id: storyData.id,
      userId: storyData.userId,
      title: storyData.title,
      summary: storyData.summary,
      genre: storyData.genre,
      language: storyData.language,
      isFavorite: storyData.isFavorite,
      extraNotes: storyData.extraNotes,
      createdAt: storyData.createdAt,
      updatedAt: storyData.updatedAt,
    };
  }
}