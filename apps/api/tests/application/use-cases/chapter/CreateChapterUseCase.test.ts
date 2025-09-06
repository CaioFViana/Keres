import type { Chapter } from '@domain/entities/Chapter'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Added

import { CreateChapterUseCase } from '@application/use-cases/chapter/CreateChapterUseCase'
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

describe('CreateChapterUseCase', () => {
  let chapterRepository: MockChapterRepository
  let createChapterUseCase: CreateChapterUseCase

  beforeEach(() => {
    chapterRepository = new MockChapterRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

    // Setup mock return values for dependencies
    mockStoryRepository.findById.mockResolvedValue({
      id: 'story123',
      userId: 'user123',
      type: 'linear',
    }) // Default story for tests

    createChapterUseCase = new CreateChapterUseCase(
      chapterRepository,
      mockStoryRepository, // Added
    )
  })

  it('should create a new chapter successfully', async () => {
    const chapterDTO = {
      storyId: 'story123',
      name: 'Chapter 1',
      index: 1,
      summary: 'A summary.',
      isFavorite: true,
      extraNotes: 'Some extra notes.',
    }

    const chapterProfile = await createChapterUseCase.execute('user123', chapterDTO) // Pass userId

    expect(chapterProfile).toBeDefined()
    expect(chapterProfile.name).toBe('Chapter 1')
    expect(chapterProfile.storyId).toBe('story123')
    expect(chapterProfile.id).toBeDefined()
    expect(chapterProfile.isFavorite).toBe(true)

    const createdChapter = await chapterRepository.findById(chapterProfile.id)
    expect(createdChapter).toBeDefined()
    expect(createdChapter?.name).toBe('Chapter 1')
  })

  it('should create a new chapter with default values for optional fields', async () => {
    const chapterDTO = {
      storyId: 'story456',
      name: 'Chapter 2',
      index: 2,
    }

    const chapterProfile = await createChapterUseCase.execute('user123', chapterDTO) // Pass userId

    expect(chapterProfile).toBeDefined()
    expect(chapterProfile.name).toBe('Chapter 2')
    expect(chapterProfile.summary).toBeNull()
    expect(chapterProfile.isFavorite).toBe(false)
    expect(chapterProfile.extraNotes).toBeNull()
  })

  it('should throw an error if story not found or not owned by user', async () => {
    mockStoryRepository.findById.mockResolvedValue(null) // Mock story not found

    const chapterDTO = {
      storyId: 'nonexistent_story',
      name: 'Chapter 3',
      index: 3,
    }

    await expect(createChapterUseCase.execute('user123', chapterDTO)).rejects.toThrow(
      'Story not found or not owned by user',
    )
  })
})
