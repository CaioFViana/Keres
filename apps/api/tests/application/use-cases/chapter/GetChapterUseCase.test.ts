import type { Chapter } from '@domain/entities/Chapter'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Added

import { GetChapterUseCase } from '@application/use-cases/chapter/GetChapterUseCase'
import { beforeEach, describe, expect, it, vi } from 'vitest' // Added vi

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

// Mock for IStoryRepository
const mockStoryRepository = {
  findById: vi.fn(),
  findByUserId: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

describe('GetChapterUseCase', () => {
  let chapterRepository: MockChapterRepository
  let getChapterUseCase: GetChapterUseCase

  beforeEach(() => {
    chapterRepository = new MockChapterRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

    // Setup mock return values for dependencies
    mockStoryRepository.findById.mockResolvedValue({ id: 'story123', userId: 'user123', type: 'linear' }) // Default story for tests

    getChapterUseCase = new GetChapterUseCase(
      chapterRepository,
      mockStoryRepository, // Added
    )

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
    const chapterProfile = await getChapterUseCase.execute('user123', 'chapter123') // Pass userId

    expect(chapterProfile).toBeDefined()
    expect(chapterProfile?.id).toBe('chapter123')
    expect(chapterProfile?.name).toBe('Test Chapter')
  })

  it('should throw an error if chapter not found', async () => {
    // Mock chapterRepository.findById to return null for nonexistent chapter
    chapterRepository.findById.mockResolvedValue(null)

    await expect(getChapterUseCase.execute('user123', 'nonexistent')).rejects.toThrow('Chapter not found')
  })

  it('should throw an error if story not found or not owned by user', async () => {
    mockStoryRepository.findById.mockResolvedValue(null) // Mock story not found

    await expect(getChapterUseCase.execute('user123', 'chapter123')).rejects.toThrow(
      'Story not found or not owned by user',
    )
  })
})
