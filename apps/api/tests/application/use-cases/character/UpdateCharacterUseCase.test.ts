import type { Character } from '@domain/entities/Character'
import type { Story } from '@domain/entities/Story'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

import { UpdateCharacterUseCase } from '@application/use-cases/character/UpdateCharacterUseCase'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

// Mock for IStoryRepository
const mockStoryRepository = {
  findById: vi.fn(),
  findByUserId: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

describe('UpdateCharacterUseCase', () => {
  let characterRepository: MockCharacterRepository
  let storyRepository: typeof mockStoryRepository
  let updateCharacterUseCase: UpdateCharacterUseCase

  beforeEach(() => {
    characterRepository = new MockCharacterRepository()
    storyRepository = mockStoryRepository
    updateCharacterUseCase = new UpdateCharacterUseCase(characterRepository, storyRepository)

    // Setup mock return values for dependencies
    mockStoryRepository.findById.mockImplementation((id: string, userId: string) => {
      if (id === 'story123' && userId === 'user123') {
        return Promise.resolve({
          id: 'story123',
          userId: 'user123',
          title: 'Test Story 1',
          type: 'linear',
        })
      }
      if (id === 'another_story' && userId === 'user123') {
        return Promise.resolve({
          id: 'another_story',
          userId: 'user123',
          title: 'Test Story 2',
          type: 'linear',
        })
      }
      return Promise.resolve(null)
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

    await expect(updateCharacterUseCase.execute('user123', updateDTO)).rejects.toThrow(
      'Character not found',
    )
  })

  it('should throw an error if character does not belong to the specified story', async () => {
    // Mock story to return a story not owned by the user
    mockStoryRepository.findById.mockImplementationOnce((storyId, userId) => {
      return null
    })

    const updateDTO = {
      id: 'char123',
      storyId: 'another_story', // This storyId is used to find the existing character's story
      name: 'New Name',
    }

    await expect(updateCharacterUseCase.execute('user123', updateDTO)).rejects.toThrow(
      'Story not found or not owned by user', // Updated error message
    )

    // Ensure the character was not updated
    const character = await characterRepository.findById('char123')
    expect(character?.name).toBe('Original Name')
  })
})
