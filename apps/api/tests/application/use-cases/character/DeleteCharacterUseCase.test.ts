import type { Character } from '@domain/entities/Character'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Added

import { DeleteCharacterUseCase } from '@application/use-cases/character/DeleteCharacterUseCase'
import { beforeEach, describe, expect, it, vi } from 'vitest' // Added vi

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

describe('DeleteCharacterUseCase', () => {
  let characterRepository: MockCharacterRepository
  let deleteCharacterUseCase: DeleteCharacterUseCase

  beforeEach(() => {
    characterRepository = new MockCharacterRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

    // Setup mock return values for dependencies
    mockStoryRepository.findById.mockResolvedValue({ id: 'story123', userId: 'user123', type: 'linear' }) // Default story for tests

    deleteCharacterUseCase = new DeleteCharacterUseCase(
      characterRepository,
      mockStoryRepository, // Added
    )

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
    const deleted = await deleteCharacterUseCase.execute('user123', 'char123') // Pass userId
    expect(deleted).toBe(true)

    const character = await characterRepository.findById('char123')
    expect(character).toBeNull()
  })

  it('should throw an error if character not found', async () => {
    // Mock characterRepository.findById to return null for nonexistent character
    characterRepository.findById.mockResolvedValue(null)

    await expect(deleteCharacterUseCase.execute('user123', 'nonexistent_char')).rejects.toThrow('Character not found')
  })

  it('should throw an error if character does not belong to the specified story', async () => {
    // Mock story to return a story not owned by the user
    mockStoryRepository.findById.mockResolvedValue({ id: 'another_story', userId: 'another_user', type: 'linear' })

    await expect(deleteCharacterUseCase.execute('user123', 'char123')).rejects.toThrow(
      'Story not found or not owned by user',
    )

    // Ensure the character was not deleted
    const character = await characterRepository.findById('char123')
    expect(character).toBeDefined()
  })
})
