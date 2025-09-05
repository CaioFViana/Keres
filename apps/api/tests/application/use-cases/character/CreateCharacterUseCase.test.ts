import type { Character } from '@domain/entities/Character'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Added

import { CreateCharacterUseCase } from '@application/use-cases/character/CreateCharacterUseCase'
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

describe('CreateCharacterUseCase', () => {
  let characterRepository: MockCharacterRepository
  let createCharacterUseCase: CreateCharacterUseCase

  beforeEach(() => {
    characterRepository = new MockCharacterRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

    // Setup mock return values for dependencies
    mockStoryRepository.findById.mockResolvedValue({ id: 'story123', userId: 'user123', type: 'linear' }) // Default story for tests

    createCharacterUseCase = new CreateCharacterUseCase(
      characterRepository,
      mockStoryRepository, // Added
    )
  })

  it('should create a new character successfully', async () => {
    const characterDTO = {
      storyId: 'story123',
      name: 'Hero',
      gender: 'Male',
      race: 'Human',
      isFavorite: true,
    }

    const characterProfile = await createCharacterUseCase.execute('user123', characterDTO) // Pass userId

    expect(characterProfile).toBeDefined()
    expect(characterProfile.name).toBe('Hero')
    expect(characterProfile.storyId).toBe('story123')
    expect(characterProfile.id).toBeDefined()
    expect(characterProfile.isFavorite).toBe(true)

    const createdCharacter = await characterRepository.findById(characterProfile.id)
    expect(createdCharacter).toBeDefined()
    expect(createdCharacter?.name).toBe('Hero')
  })

  it('should create a new character with default values for optional fields', async () => {
    const characterDTO = {
      storyId: 'story456',
      name: 'Sidekick',
    }

    const characterProfile = await createCharacterUseCase.execute('user123', characterDTO) // Pass userId

    expect(characterProfile).toBeDefined()
    expect(characterProfile.name).toBe('Sidekick')
    expect(characterProfile.gender).toBeNull()
    expect(characterProfile.race).toBeNull()
    expect(characterProfile.isFavorite).toBe(false)
  })

  it('should throw an error if story not found or not owned by user', async () => {
    mockStoryRepository.findById.mockResolvedValue(null) // Mock story not found

    const characterDTO = {
      storyId: 'nonexistent_story',
      name: 'Villain',
    }

    await expect(createCharacterUseCase.execute('user123', characterDTO)).rejects.toThrow(
      'Story not found or not owned by user',
    )
  })
})
