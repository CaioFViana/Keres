import type { Story } from '@domain/entities/Story'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

import { DeleteStoryUseCase } from '@application/use-cases/story/DeleteStoryUseCase'
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

describe('DeleteStoryUseCase', () => {
  let storyRepository: MockStoryRepository
  let deleteStoryUseCase: DeleteStoryUseCase

  beforeEach(() => {
    storyRepository = new MockStoryRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

    deleteStoryUseCase = new DeleteStoryUseCase(storyRepository)

    // Pre-populate a story for testing
    storyRepository.save({
      id: 'story123',
      userId: 'user123',
      title: 'Story to Delete',
      summary: 'Summary',
      genre: 'Fantasy',
      language: 'English',
      isFavorite: false,
      extraNotes: 'Notes',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should delete an existing story successfully', async () => {
    const deleted = await deleteStoryUseCase.execute('user123', 'story123') // Pass userId
    expect(deleted).toBe(true)

    const story = await storyRepository.findById('story123')
    expect(story).toBeNull()
  })

  it('should return false if story not found', async () => {
    const deleted = await deleteStoryUseCase.execute('user123', 'nonexistent_story') // Pass userId
    expect(deleted).toBe(false)
  })

  it('should return false if story does not belong to the specified user', async () => {
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

    const deleted = await deleteStoryUseCase.execute('user123', 'story456') // Try to delete a story not owned by user123
    expect(deleted).toBe(false)

    // Ensure the story was not deleted
    const story = await storyRepository.findById('story456')
    expect(story).toBeDefined()
  })
})
