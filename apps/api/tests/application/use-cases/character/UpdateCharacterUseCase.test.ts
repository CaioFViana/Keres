import type { Character } from '@domain/entities/Character'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { Story } from '@domain/entities/Story'

import { UpdateCharacterUseCase } from '@application/use-cases/character/UpdateCharacterUseCase'
import { beforeEach, describe, expect, it } from 'vitest'

// Mock implementation
class MockCharacterRepository implements ICharacterRepository {
  private characters: Character[] = []

  async findById(id: string): Promise<Character | null> {
    return this.characters.find((character) => character.id === id) || null
  }

  async findByStoryId(storyId: string): Promise<Character[]> {
    return this.characters.filter((character) => character.storyId === storyId)
  }

  async save(character: Character): Promise<void> {
    this.characters.push(character)
  }

  async update(character: Character): Promise<void> {
    const index = this.characters.findIndex((c) => c.id === character.id)
    if (index !== -1) {
      this.characters[index] = character
    }
  }

  async delete(id: string): Promise<void> {
    this.characters = this.characters.filter((character) => character.id !== id)
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

describe('UpdateCharacterUseCase', () => {
  let characterRepository: MockCharacterRepository
  let storyRepository: MockStoryRepository
  let updateCharacterUseCase: UpdateCharacterUseCase

  beforeEach(() => {
    characterRepository = new MockCharacterRepository()
    storyRepository = new MockStoryRepository()
    updateCharacterUseCase = new UpdateCharacterUseCase(characterRepository, storyRepository)

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
      id: 'another_story',
      userId: 'user123',
      title: 'Test Story 2',
      type: 'linear',
      summary: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Pre-populate a character for testing
    characterRepository.save({
      id: 'char123',
      storyId: 'story123',
      name: 'Original Name',
      gender: 'Male',
      race: 'Human',
      subrace: null,
      personality: 'Original Personality',
      motivation: null,
      qualities: null,
      weaknesses: null,
      biography: null,
      plannedTimeline: null,
      isFavorite: false,
      extraNotes: 'Original Notes',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should update an existing character successfully', async () => {
    const updateDTO = {
      id: 'char123',
      storyId: 'story123',
      name: 'Updated Name',
      gender: 'Female',
      isFavorite: true,
    }

    const updatedCharacter = await updateCharacterUseCase.execute('user123', updateDTO)

    expect(updatedCharacter).toBeDefined()
    expect(updatedCharacter?.name).toBe('Updated Name')
    expect(updatedCharacter?.gender).toBe('Female')
    expect(updatedCharacter?.isFavorite).toBe(true)
    expect(updatedCharacter?.personality).toBe('Original Personality') // Should remain unchanged
  })

  it('should throw an error if character not found', async () => {
    const updateDTO = {
      id: 'nonexistent_char',
      storyId: 'story123',
      name: 'New Name',
    }

    await expect(updateCharacterUseCase.execute('user123', updateDTO)).rejects.toThrow('Character not found')
  })

  it('should throw an error if character does not belong to the specified story', async () => {
    const updateDTO = {
      id: 'char123',
      storyId: 'another_story',
      name: 'New Name',
    }

    await expect(updateCharacterUseCase.execute('user123', updateDTO)).rejects.toThrow('Character does not belong to the specified story')

    // Ensure the character was not updated
    const character = await characterRepository.findById('char123')
    expect(character?.name).toBe('Original Name')
  })
})