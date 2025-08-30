import type { Character } from '@domain/entities/Character'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'

import { DeleteCharacterUseCase } from '@application/use-cases/DeleteCharacterUseCase'
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

describe('DeleteCharacterUseCase', () => {
  let characterRepository: MockCharacterRepository
  let deleteCharacterUseCase: DeleteCharacterUseCase

  beforeEach(() => {
    characterRepository = new MockCharacterRepository()
    deleteCharacterUseCase = new DeleteCharacterUseCase(characterRepository)

    // Pre-populate a character for testing
    characterRepository.save({
      id: 'char123',
      storyId: 'story123',
      name: 'Character to Delete',
      gender: 'Male',
      race: 'Human',
      subrace: null,
      personality: null,
      motivation: null,
      qualities: null,
      weaknesses: null,
      biography: null,
      plannedTimeline: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should delete an existing character successfully', async () => {
    const deleted = await deleteCharacterUseCase.execute('char123', 'story123')
    expect(deleted).toBe(true)

    const character = await characterRepository.findById('char123')
    expect(character).toBeNull()
  })

  it('should return false if character not found', async () => {
    const deleted = await deleteCharacterUseCase.execute('nonexistent_char', 'story123')
    expect(deleted).toBe(false)
  })

  it('should return false if character does not belong to the specified story', async () => {
    const deleted = await deleteCharacterUseCase.execute('char123', 'another_story')
    expect(deleted).toBe(false)

    // Ensure the character was not deleted
    const character = await characterRepository.findById('char123')
    expect(character).toBeDefined()
  })
})
