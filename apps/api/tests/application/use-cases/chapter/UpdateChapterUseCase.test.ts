import type { Chapter } from '@domain/entities/Chapter'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository'

import { UpdateChapterUseCase } from '@application/use-cases/chapter/UpdateChapterUseCase'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock for IStoryRepository
const mockStoryRepository = {
  findById: vi.fn(),
  findByUserId: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

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

describe('UpdateChapterUseCase', () => {
  let chapterRepository: MockChapterRepository
  let updateChapterUseCase: UpdateChapterUseCase

  beforeEach(() => {
    chapterRepository = new MockChapterRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

    // Setup mock return values for dependencies
    mockStoryRepository.findById.mockImplementation((id: string, userId: string) => {
      if (id === 'story123' && userId === 'user123') {
        return Promise.resolve({ id: 'story123', userId: 'user123', title: 'Test Story 1', type: 'linear' })
      }
      if (id === 'another_story' && userId === 'user123') {
        return Promise.resolve({ id: 'another_story', userId: 'user123', title: 'Test Story 2', type: 'linear' })
      }
      return Promise.resolve(null)
    })

    updateChapterUseCase = new UpdateChapterUseCase(chapterRepository, mockStoryRepository) // Pass mockStoryRepository

    // Pre-populate a chapter for testing
    chapterRepository.save({
      id: 'chapter123',
      storyId: 'story123',
      name: 'Original Chapter Name',
      index: 1,
      summary: 'Original Summary',
      isFavorite: false,
      extraNotes: 'Original Notes',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should update an existing chapter successfully', async () => {
    const updateDTO = {
      id: 'chapter123',
      storyId: 'story123',
      name: 'Updated Chapter Name',
      index: 2,
      isFavorite: true,
    }

    const updatedChapter = await updateChapterUseCase.execute(updateDTO)

    expect(updatedChapter).toBeDefined()
    expect(updatedChapter?.name).toBe('Updated Chapter Name')
    expect(updatedChapter?.index).toBe(2)
    expect(updatedChapter?.isFavorite).toBe(true)
    expect(updatedChapter?.summary).toBe('Original Summary') // Should remain unchanged
  })

  it('should return null if chapter not found', async () => {
    const updateDTO = {
      id: 'nonexistent_chapter',
      storyId: 'story123',
      name: 'New Name',
    }

    const updatedChapter = await updateChapterUseCase.execute(updateDTO)

    expect(updatedChapter).toBeNull()
  })

  it('should return null if chapter does not belong to the specified story', async () => {
    const updateDTO = {
      id: 'chapter123',
      storyId: 'another_story',
      name: 'New Name',
    }

    const updatedChapter = await updateChapterUseCase.execute(updateDTO)

    expect(updatedChapter).toBeNull()

    // Ensure the chapter was not updated
    const chapter = await chapterRepository.findById('chapter123')
    expect(chapter?.name).toBe('Original Chapter Name')
  })
})
