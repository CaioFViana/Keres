import type { Story } from '@domain/entities/Story'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

import { CreateStoryUseCase } from '@application/use-cases/story/CreateStoryUseCase'
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

describe('CreateStoryUseCase', () => {
  let storyRepository: MockStoryRepository
  let createStoryUseCase: CreateStoryUseCase

  beforeEach(() => {
    storyRepository = new MockStoryRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

    createStoryUseCase = new CreateStoryUseCase(storyRepository)
  })

  it('should create a new story successfully', async () => {
    const storyDTO = {
      type: 'linear', // Added type
      title: 'My First Story',
      summary: 'A short summary.',
      genre: 'Fantasy',
      language: 'English',
      isFavorite: true,
      extraNotes: 'Some extra notes.',
    }

    const storyProfile = await createStoryUseCase.execute('user123', storyDTO) // Pass userId

    expect(storyProfile).toBeDefined()
    expect(storyProfile.title).toBe('My First Story')
    expect(storyProfile.userId).toBe('user123')
    expect(storyProfile.type).toBe('linear') // Added type assertion
    expect(storyProfile.id).toBeDefined()
    expect(storyProfile.isFavorite).toBe(true)

    const createdStory = await storyRepository.findById(storyProfile.id)
    expect(createdStory).toBeDefined()
    expect(createdStory?.title).toBe('My First Story')
  })

  it('should create a new story with default values for optional fields', async () => {
    const storyDTO = {
      title: 'Another Story',
    }

    const storyProfile = await createStoryUseCase.execute('user456', storyDTO) // Pass userId

    expect(storyProfile).toBeDefined()
    expect(storyProfile.title).toBe('Another Story')
    expect(storyProfile.type).toBe('linear') // Default type
    expect(storyProfile.summary).toBeNull()
    expect(storyProfile.genre).toBeNull()
    expect(storyProfile.language).toBeNull()
    expect(storyProfile.isFavorite).toBe(false)
    expect(storyProfile.extraNotes).toBeNull()
  })
})
