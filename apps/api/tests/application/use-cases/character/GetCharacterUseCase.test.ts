import type { Character } from '@domain/entities/Character'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Added

import { GetCharacterUseCase } from '@application/use-cases/character/GetCharacterUseCase'
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

describe('GetCharacterUseCase', () => {
  let characterRepository: MockCharacterRepository
  let getCharacterUseCase: GetCharacterUseCase

  beforeEach(() => {
    characterRepository = new MockCharacterRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

    // Setup mock return values for dependencies
    mockStoryRepository.findById.mockResolvedValue({ id: 'story123', userId: 'user123', type: 'linear' }) // Default story for tests

    getCharacterUseCase = new GetCharacterUseCase(
      characterRepository,
      mockStoryRepository, // Added
    )

    // Pre-populate a character for testing
    characterRepository.save({
      id: 'char123',
      storyId: 'story123',
      name: 'Test Character',
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

  it('should return a character profile for a valid ID', async () => {
    const characterProfile = await getCharacterUseCase.execute('user123', 'char123') // Pass userId

    expect(characterProfile).toBeDefined()
    expect(characterProfile?.id).toBe('char123')
    expect(characterProfile?.name).toBe('Test Character')
  })

  it('should throw an error if character not found', async () => {
    const emptyCharacterRepository = new MockCharacterRepository()
    const getUseCaseWithEmptyRepo = new GetCharacterUseCase(
      emptyCharacterRepository,
      mockStoryRepository,
    )

    await expect(getUseCaseWithEmptyRepo.execute('user123', 'nonexistent')).rejects.toThrow('Character not found')
  })

  it('should throw an error if story not found or not owned by user', async () => {
    mockStoryRepository.findById.mockResolvedValue(null) // Mock story not found

    await expect(getCharacterUseCase.execute('user123', 'char123')).rejects.toThrow(
      'Story not found or not owned by user',
    )
  })
})
