import type { Story } from '@domain/entities/Story'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

import { GetStoryUseCase } from '@application/use-cases/story/GetStoryUseCase'
import { beforeEach, describe, expect, it, vi } from 'vitest' // Added vi

// Mock implementation
class MockStoryRepository implements IStoryRepository {
  private stories: Story[] = []

  async findById(id: string, userId?: string): Promise<Story | null> {
    const story = this.stories.find((s) => s.id === id)
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

describe('GetStoryUseCase', () => {
  let storyRepository: MockStoryRepository
  let getStoryUseCase: GetStoryUseCase

  beforeEach(() => {
    storyRepository = new MockStoryRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

    getStoryUseCase = new GetStoryUseCase(storyRepository)

    // Pre-populate a story for testing
    storyRepository.save({
      id: 'story123',
      userId: 'user123',
      title: 'Test Story',
      summary: 'A summary',
      genre: 'Fantasy',
      language: 'English',
      isFavorite: false,
      extraNotes: 'Notes',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should return a story profile for a valid ID', async () => {
    const storyProfile = await getStoryUseCase.execute('user123', 'story123') // Pass userId

    expect(storyProfile).toBeDefined()
    expect(storyProfile?.id).toBe('story123')
    expect(storyProfile?.title).toBe('Test Story')
  })

  it('should return null for an invalid story ID', async () => {
    const storyProfile = await getStoryUseCase.execute('user123', 'nonexistent') // Pass userId

    expect(storyProfile).toBeNull()
  })

  it('should throw an error if story not found or not owned by user', async () => {
    // Mock story to return a story not owned by the user
    storyRepository.save({
      id: 'story456',
      userId: 'another_user',
      title: 'Another Story',
      type: 'linear',
      summary: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await expect(getStoryUseCase.execute('user123', 'story456')).rejects.toThrow(
      'Story not found or not owned by user',
    )
  })
})
