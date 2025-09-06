import type { Location } from '@domain/entities/Location'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository'

import { GetLocationUseCase } from '@application/use-cases/location/GetLocationUseCase'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock for IStoryRepository
const mockStoryRepository = {
  findById: vi.fn(),
  findByUserId: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

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

describe('GetLocationUseCase', () => {
  let locationRepository: MockLocationRepository
  let getLocationUseCase: GetLocationUseCase

  beforeEach(() => {
    locationRepository = new MockLocationRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

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
      return Promise.resolve(null)
    })

    getLocationUseCase = new GetLocationUseCase(locationRepository, mockStoryRepository)

    // Pre-populate a location for testing
    locationRepository.save({
      id: 'loc123',
      storyId: 'story123',
      name: 'Test Location',
      description: 'A test description',
      climate: 'Temperate',
      culture: 'Mixed',
      politics: 'Democratic',
      isFavorite: false,
      extraNotes: 'Some notes',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should return a location profile for a valid ID', async () => {
    const locationProfile = await getLocationUseCase.execute('user123', 'loc123')

    expect(locationProfile).toBeDefined()
    expect(locationProfile?.id).toBe('loc123')
    expect(locationProfile?.name).toBe('Test Location')
  })

  it('should return null for an invalid location ID', async () => {
    await expect(getLocationUseCase.execute('user123', 'nonexistent')).rejects.toThrow(
      'Location not found',
    )
  })
})
