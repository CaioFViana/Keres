import type { Location } from '@domain/entities/Location'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Added

import { CreateLocationUseCase } from '@application/use-cases/location/CreateLocationUseCase'
import { beforeEach, describe, expect, it, vi } from 'vitest' // Added vi

// Mock implementation
class MockLocationRepository implements ILocationRepository {
  private locations: Location[] = []

  async findById(id: string): Promise<Location | null> {
    return this.locations.find((location) => location.id === id) || null
  }

  async findByStoryId(storyId: string): Promise<Location[]> {
    return this.locations.filter((location) => location.storyId === storyId)
  }

  async save(location: Location): Promise<void> {
    this.locations.push(location)
  }

  async update(location: Location): Promise<void> {
    const index = this.locations.findIndex((l) => l.id === location.id)
    if (index !== -1) {
      this.locations[index] = location
    }
  }

  async delete(id: string): Promise<void> {
    this.locations = this.locations.filter((location) => location.id !== id)
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

describe('CreateLocationUseCase', () => {
  let locationRepository: MockLocationRepository
  let createLocationUseCase: CreateLocationUseCase

  beforeEach(() => {
    locationRepository = new MockLocationRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

    // Setup mock return values for dependencies
    mockStoryRepository.findById.mockResolvedValue({
      id: 'story123',
      userId: 'user123',
      type: 'linear',
    }) // Default story for tests

    createLocationUseCase = new CreateLocationUseCase(
      locationRepository,
      mockStoryRepository, // Added
    )
  })

  it('should create a new location successfully', async () => {
    const locationDTO = {
      storyId: 'story123',
      name: 'Forest',
      description: 'A dense forest.',
      climate: 'Temperate',
      culture: 'Elven',
      politics: 'Neutral',
      isFavorite: true,
      extraNotes: 'Some extra notes.',
    }

    const locationProfile = await createLocationUseCase.execute('user123', locationDTO) // Pass userId

    expect(locationProfile).toBeDefined()
    expect(locationProfile.name).toBe('Forest')
    expect(locationProfile.storyId).toBe('story123')
    expect(locationProfile.id).toBeDefined()
    expect(locationProfile.isFavorite).toBe(true)

    const createdLocation = await locationRepository.findById(locationProfile.id)
    expect(createdLocation).toBeDefined()
    expect(createdLocation?.name).toBe('Forest')
  })

  it('should create a new location with default values for optional fields', async () => {
    const locationDTO = {
      storyId: 'story456',
      name: 'Mountain',
    }

    const locationProfile = await createLocationUseCase.execute('user123', locationDTO) // Pass userId

    expect(locationProfile).toBeDefined()
    expect(locationProfile.name).toBe('Mountain')
    expect(locationProfile.description).toBeNull()
    expect(locationProfile.climate).toBeNull()
    expect(locationProfile.culture).toBeNull()
    expect(locationProfile.politics).toBeNull()
    expect(locationProfile.isFavorite).toBe(false)
    expect(locationProfile.extraNotes).toBeNull()
  })

  it('should throw an error if story not found or not owned by user', async () => {
    mockStoryRepository.findById.mockResolvedValue(null) // Mock story not found

    const locationDTO = {
      storyId: 'nonexistent_story',
      name: 'Desert',
    }

    await expect(createLocationUseCase.execute('user123', locationDTO)).rejects.toThrow(
      'Story not found or not owned by user',
    )
  })
})
