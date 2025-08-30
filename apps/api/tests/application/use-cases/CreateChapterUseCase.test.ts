import { describe, it, expect, beforeEach } from 'vitest';
import { CreateChapterUseCase } from '@application/use-cases/CreateChapterUseCase';
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

describe('CreateChapterUseCase', () => {
  let chapterRepository: MockChapterRepository;
  let createChapterUseCase: CreateChapterUseCase;

  beforeEach(() => {
    chapterRepository = new MockChapterRepository();
    createChapterUseCase = new CreateChapterUseCase(chapterRepository);
  });

  it('should create a new chapter successfully', async () => {
    const chapterDTO = {
      storyId: 'story123',
      name: 'Chapter 1',
      index: 1,
      summary: 'A summary.',
      isFavorite: true,
      extraNotes: 'Some extra notes.',
    };

    const chapterProfile = await createChapterUseCase.execute(chapterDTO);

    expect(chapterProfile).toBeDefined();
    expect(chapterProfile.name).toBe('Chapter 1');
    expect(chapterProfile.storyId).toBe('story123');
    expect(chapterProfile.id).toBeDefined();
    expect(chapterProfile.isFavorite).toBe(true);

    const createdChapter = await chapterRepository.findById(chapterProfile.id);
    expect(createdChapter).toBeDefined();
    expect(createdChapter?.name).toBe('Chapter 1');
  });

  it('should create a new chapter with default values for optional fields', async () => {
    const chapterDTO = {
      storyId: 'story456',
      name: 'Chapter 2',
      index: 2,
    };

    const chapterProfile = await createChapterUseCase.execute(chapterDTO);

    expect(chapterProfile).toBeDefined();
    expect(chapterProfile.name).toBe('Chapter 2');
    expect(chapterProfile.summary).toBeNull();
    expect(chapterProfile.isFavorite).toBe(false);
    expect(chapterProfile.extraNotes).toBeNull();
  });
});
