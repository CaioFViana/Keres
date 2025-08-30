import { describe, it, expect, beforeEach } from 'vitest';
import { GetChaptersByStoryIdUseCase } from '@application/use-cases/GetChaptersByStoryIdUseCase';
import { IChapterRepository } from '@domain/repositories/IChapterRepository';
import { Chapter } from '@domain/entities/Chapter';

// Mock implementation
class MockChapterRepository implements IChapterRepository {
  private chapters: Chapter[] = [];

  async findById(id: string): Promise<Chapter | null> {
    return this.chapters.find(chapter => chapter.id === id) || null;
  }

  async findByStoryId(storyId: string): Promise<Chapter[]> {
    return this.chapters.filter(chapter => chapter.storyId === storyId);
  }

  async save(chapter: Chapter): Promise<void> {
    this.chapters.push(chapter);
  }

  async update(chapter: Chapter): Promise<void> {
    const index = this.chapters.findIndex(c => c.id === chapter.id);
    if (index !== -1) {
      this.chapters[index] = chapter;
    }
  }

  async delete(id: string): Promise<void> {
    this.chapters = this.chapters.filter(chapter => chapter.id !== id);
  }
}

describe('GetChaptersByStoryIdUseCase', () => {
  let chapterRepository: MockChapterRepository;
  let getChaptersByStoryIdUseCase: GetChaptersByStoryIdUseCase;

  beforeEach(() => {
    chapterRepository = new MockChapterRepository();
    getChaptersByStoryIdUseCase = new GetChaptersByStoryIdUseCase(chapterRepository);

    // Pre-populate chapters for testing
    chapterRepository.save({
      id: 'chapter1',
      storyId: 'story123',
      name: 'Chapter 1',
      index: 1,
      summary: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    chapterRepository.save({
      id: 'chapter2',
      storyId: 'story123',
      name: 'Chapter 2',
      index: 2,
      summary: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    chapterRepository.save({
      id: 'chapter3',
      storyId: 'story456',
      name: 'Chapter 3',
      index: 1,
      summary: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('should return all chapters for a given story ID', async () => {
    const chapters = await getChaptersByStoryIdUseCase.execute('story123');

    expect(chapters).toBeDefined();
    expect(chapters.length).toBe(2);
    expect(chapters[0].name).toBe('Chapter 1');
    expect(chapters[1].name).toBe('Chapter 2');
  });

  it('should return an empty array if no chapters found for the story ID', async () => {
    const chapters = await getChaptersByStoryIdUseCase.execute('nonexistent_story');

    expect(chapters).toBeDefined();
    expect(chapters.length).toBe(0);
  });
});
