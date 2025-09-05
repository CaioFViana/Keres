import type { Chapter } from '@domain/entities/Chapter'
import type { Story } from '@domain/entities/Story'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

import { GetChaptersByStoryIdUseCase } from '@application/use-cases/chapter/GetChaptersByStoryIdUseCase'
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

class MockStoryRepository implements IStoryRepository {
  private stories: Story[] = []

  async findById(id: string, userId?: string): Promise<Story | null> {
    const story = this.stories.find((story) => story.id === id)
    if (story && userId && story.userId !== userId) {
      return null // Story found but doesn't belong to the user
    }
    return story || null
  }

  async findByUserId(userId: string): Promise<Story[]> {
    return this.stories.filter((story) => story.userId === userId)
  }

  async save(story: Story): Promise<void> {
    this.stories.push(story)
  }

  async update(story: Story): Promise<void> {
    const index = this.stories.findIndex((s) => s.id === story.id)
    if (index !== -1) {
      this.stories[index] = story
    }
  }

  async delete(id: string): Promise<void> {
    this.stories = this.stories.filter((story) => story.id !== id)
  }
}

describe('GetChaptersByStoryIdUseCase', () => {
  let chapterRepository: MockChapterRepository
  let storyRepository: MockStoryRepository
  let getChaptersByStoryIdUseCase: GetChaptersByStoryIdUseCase

  beforeEach(() => {
    chapterRepository = new MockChapterRepository()
    storyRepository = new MockStoryRepository()
    getChaptersByStoryIdUseCase = new GetChaptersByStoryIdUseCase(
      chapterRepository,
      storyRepository,
    )

    // Pre-populate stories for testing
    storyRepository.save({
      id: 'story123',
      userId: 'user123',
      title: 'Test Story 1',
      type: 'linear',
      summary: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    storyRepository.save({
      id: 'story456',
      userId: 'user123',
      title: 'Test Story 2',
      type: 'linear',
      summary: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

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
    })
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
    })
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
    })
  })

  it('should return all chapters for a given story ID', async () => {
    const chapters = await getChaptersByStoryIdUseCase.execute('user123', 'story123')

    expect(chapters).toBeDefined()
    expect(chapters.length).toBe(2)
    expect(chapters[0].name).toBe('Chapter 1')
    expect(chapters[1].name).toBe('Chapter 2')
  })

  it('should throw an error if the story is not found or not owned by the user', async () => {
    await expect(
      getChaptersByStoryIdUseCase.execute('user123', 'nonexistent_story'),
    ).rejects.toThrow('Story not found or not owned by user')
  })
})
