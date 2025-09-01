import type { Story } from '@domain/entities/Story'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

import { DeleteStoryUseCase } from '@application/use-cases/story/DeleteStoryUseCase'
import { beforeEach, describe, expect, it } from 'vitest'

// Mock implementation
class MockStoryRepository implements IStoryRepository {
  private stories: Story[] = []

  async findById(id: string): Promise<Story | null> {
    return this.stories.find((story) => story.id === id) || null
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
    const deleted = await deleteStoryUseCase.execute('story123', 'user123')
    expect(deleted).toBe(true)

    const story = await storyRepository.findById('story123')
    expect(story).toBeNull()
  })

  it('should return false if story not found', async () => {
    const deleted = await deleteStoryUseCase.execute('nonexistent_story', 'user123')
    expect(deleted).toBe(false)
  })
})
