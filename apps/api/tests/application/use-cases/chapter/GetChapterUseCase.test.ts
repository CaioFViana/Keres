import type { Chapter } from '@domain/entities/Chapter'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository'

import { GetChapterUseCase } from '@application/use-cases/chapter/GetChapterUseCase'
import { beforeEach, describe, expect, it } from 'vitest'

// Mock implementation
class MockChapterRepository implements IChapterRepository {
  private chapters: Chapter[] = []

  async findById(id: string): Promise<Chapter | null> {
    return this.chapters.find((chapter) => chapter.id === id) || null
  }

  async findByStoryId(storyId: string): Promise<Chapter[]> {
    return this.chapters.filter((chapter) => chapter.storyId === storyId)
  }

  async save(chapter: Chapter): Promise<void> {
    this.chapters.push(chapter)
  }

  async update(chapter: Chapter): Promise<void> {
    const index = this.chapters.findIndex((c) => c.id === chapter.id)
    if (index !== -1) {
      this.chapters[index] = chapter
    }
  }

  async delete(id: string): Promise<void> {
    this.chapters = this.chapters.filter((chapter) => chapter.id !== id)
  }
}

describe('GetChapterUseCase', () => {
  let chapterRepository: MockChapterRepository
  let getChapterUseCase: GetChapterUseCase

  beforeEach(() => {
    chapterRepository = new MockChapterRepository()
    getChapterUseCase = new GetChapterUseCase(chapterRepository)

    // Pre-populate a chapter for testing
    chapterRepository.save({
      id: 'chapter123',
      storyId: 'story123',
      name: 'Test Chapter',
      index: 1,
      summary: 'A summary',
      isFavorite: false,
      extraNotes: 'Notes',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should return a chapter profile for a valid ID', async () => {
    const chapterProfile = await getChapterUseCase.execute('chapter123')

    expect(chapterProfile).toBeDefined()
    expect(chapterProfile?.id).toBe('chapter123')
    expect(chapterProfile?.name).toBe('Test Chapter')
  })

  it('should return null for an invalid chapter ID', async () => {
    const chapterProfile = await getChapterUseCase.execute('nonexistent')

    expect(chapterProfile).toBeNull()
  })
})
