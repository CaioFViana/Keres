import type { Character } from '@domain/entities/Character'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'

import { UpdateCharacterUseCase } from '@application/use-cases/UpdateCharacterUseCase'
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

describe('UpdateCharacterUseCase', () => {
  let characterRepository: MockCharacterRepository
  let updateCharacterUseCase: UpdateCharacterUseCase

  beforeEach(() => {
    characterRepository = new MockCharacterRepository()
    updateCharacterUseCase = new UpdateCharacterUseCase(characterRepository)

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

    const updatedCharacter = await updateCharacterUseCase.execute(updateDTO)

    expect(updatedCharacter).toBeDefined()
    expect(updatedCharacter?.name).toBe('Updated Name')
    expect(updatedCharacter?.gender).toBe('Female')
    expect(updatedCharacter?.isFavorite).toBe(true)
    expect(updatedCharacter?.personality).toBe('Original Personality') // Should remain unchanged
  })

  it('should return null if character not found', async () => {
    const updateDTO = {
      id: 'nonexistent_char',
      storyId: 'story123',
      name: 'New Name',
    }

    const updatedCharacter = await updateCharacterUseCase.execute(updateDTO)

    expect(updatedCharacter).toBeNull()
  })

  it('should return null if character does not belong to the specified story', async () => {
    const updateDTO = {
      id: 'char123',
      storyId: 'another_story',
      name: 'New Name',
    }

    const updatedCharacter = await updateCharacterUseCase.execute(updateDTO)

    expect(updatedCharacter).toBeNull()

    // Ensure the character was not updated
    const character = await characterRepository.findById('char123')
    expect(character?.name).toBe('Original Name')
  })
})
