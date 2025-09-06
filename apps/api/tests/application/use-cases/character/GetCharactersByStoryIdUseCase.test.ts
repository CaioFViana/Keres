import type { Character } from '@domain/entities/Character'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Added

import { GetCharactersByStoryIdUseCase } from '@application/use-cases/character/GetCharactersByStoryIdUseCase'
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

describe('GetCharactersByStoryIdUseCase', () => {
  let characterRepository: MockCharacterRepository
  let getCharactersByStoryIdUseCase: GetCharactersByStoryIdUseCase

  beforeEach(() => {
    characterRepository = new MockCharacterRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

    // Setup mock return values for dependencies
    mockStoryRepository.findById.mockResolvedValue({
      id: 'story123',
      userId: 'user123',
      type: 'linear',
    }) // Default story for tests

    getCharactersByStoryIdUseCase = new GetCharactersByStoryIdUseCase(
      characterRepository,
      mockStoryRepository, // Added
    )

    // Pre-populate characters for testing
    characterRepository.save({
      id: 'char1',
      storyId: 'story123',
      name: 'Character 1',
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
    characterRepository.save({
      id: 'char2',
      storyId: 'story123',
      name: 'Character 2',
      gender: 'Female',
      race: 'Elf',
      subrace: null,
      personality: null,
      motivation: null,
      qualities: null,
      weaknesses: null,
      biography: null,
      plannedTimeline: null,
      isFavorite: true,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    characterRepository.save({
      id: 'char3',
      storyId: 'story456',
      name: 'Character 3',
      gender: 'Other',
      race: 'Dwarf',
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

  it('should return all characters for a given story ID', async () => {
    const characters = await getCharactersByStoryIdUseCase.execute('user123', 'story123') // Pass userId

    expect(characters).toBeDefined()
    expect(characters.length).toBe(2)
    expect(characters[0].name).toBe('Character 1')
    expect(characters[1].name).toBe('Character 2')
  })

  it('should return an empty array if no characters found for the story ID', async () => {
    const characters = await getCharactersByStoryIdUseCase.execute('user123', 'nonexistent_story') // Pass userId

    expect(characters).toBeDefined()
    expect(characters.length).toBe(0)
  })

  it('should throw an error if story not found or not owned by user', async () => {
    mockStoryRepository.findById.mockResolvedValue(null) // Mock story not found

    await expect(
      getCharactersByStoryIdUseCase.execute('user123', 'nonexistent_story'),
    ).rejects.toThrow('Story not found or not owned by user')
  })
})
