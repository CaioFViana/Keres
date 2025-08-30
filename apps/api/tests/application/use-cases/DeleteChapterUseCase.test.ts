import { describe, it, expect, beforeEach } from 'vitest';
import { DeleteChapterUseCase } from '@application/use-cases/DeleteChapterUseCase';
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

describe('DeleteChapterUseCase', () => {
  let chapterRepository: MockChapterRepository;
  let deleteChapterUseCase: DeleteChapterUseCase;

  beforeEach(() => {
    chapterRepository = new MockChapterRepository();
    deleteChapterUseCase = new DeleteChapterUseCase(chapterRepository);

    // Pre-populate a chapter for testing
    chapterRepository.save({
      id: 'chapter123',
      storyId: 'story123',
      name: 'Chapter to Delete',
      index: 1,
      summary: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('should delete an existing chapter successfully', async () => {
    const deleted = await deleteChapterUseCase.execute('chapter123', 'story123');
    expect(deleted).toBe(true);

    const chapter = await chapterRepository.findById('chapter123');
    expect(chapter).toBeNull();
  });

  it('should return false if chapter not found', async () => {
    const deleted = await deleteChapterUseCase.execute('nonexistent_chapter', 'story123');
    expect(deleted).toBe(false);
  });

  it('should return false if chapter does not belong to the specified story', async () => {
    const deleted = await deleteChapterUseCase.execute('chapter123', 'another_story');
    expect(deleted).toBe(false);

    // Ensure the chapter was not deleted
    const chapter = await chapterRepository.findById('chapter123');
    expect(chapter).toBeDefined();
  });
});
