import type { Location } from '@domain/entities/Location'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository'

import { UpdateLocationUseCase } from '@application/use-cases/location/UpdateLocationUseCase'
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

  async update(location: Location, storyId: string): Promise<void> {
    const index = this.locations.findIndex((l) => l.id === location.id && l.storyId === storyId)
    if (index !== -1) {
      this.locations[index] = location
    }
  }

  async delete(id: string): Promise<void> {
    this.locations = this.locations.filter((location) => location.id !== id)
  }
}

describe('UpdateLocationUseCase', () => {
  let locationRepository: MockLocationRepository
  let updateLocationUseCase: UpdateLocationUseCase

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

    updateLocationUseCase = new UpdateLocationUseCase(locationRepository, mockStoryRepository)

    // Pre-populate a location for testing
    locationRepository.save({
      id: 'loc123',
      storyId: 'story123',
      name: 'Original Location Name',
      description: 'Original Description',
      climate: 'Temperate',
      culture: 'Elven',
      politics: 'Neutral',
      isFavorite: false,
      extraNotes: 'Original Notes',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should update an existing location successfully', async () => {
    const updateDTO = {
      id: 'loc123',
      storyId: 'story123',
      name: 'Updated Location Name',
      description: 'Updated Description',
      isFavorite: true,
    }

    const updatedLocation = await updateLocationUseCase.execute('user123', updateDTO)

    expect(updatedLocation).toBeDefined()
    expect(updatedLocation?.name).toBe('Updated Location Name')
    expect(updatedLocation?.description).toBe('Updated Description')
    expect(updatedLocation?.isFavorite).toBe(true)
    expect(updatedLocation?.climate).toBe('Temperate') // Should remain unchanged
  })

  it('should return null if location not found', async () => {
    const updateDTO = {
      id: 'nonexistent_loc',
      storyId: 'story123',
      name: 'New Name',
    }

    await expect(updateLocationUseCase.execute('user123', updateDTO)).rejects.toThrow(
      'Location not found',
    )
  })

  it('should return null if location does not belong to the specified story', async () => {
    const updateDTO = {
      id: 'loc123',
      storyId: 'another_story',
      name: 'New Name',
    }

    await expect(updateLocationUseCase.execute('user123', updateDTO)).rejects.toThrow(
      'Location not found or does not belong to the specified story',
    )

    // Ensure the location was not updated
    const location = await locationRepository.findById('loc123')
    expect(location?.name).toBe('Original Location Name')
  })
})
