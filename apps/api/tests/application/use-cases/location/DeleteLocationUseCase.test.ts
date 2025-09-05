import type { Location } from '@domain/entities/Location'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository'

import { DeleteLocationUseCase } from '@application/use-cases/location/DeleteLocationUseCase'
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

describe('DeleteLocationUseCase', () => {
  let locationRepository: MockLocationRepository
  let deleteLocationUseCase: DeleteLocationUseCase

  beforeEach(() => {
    locationRepository = new MockLocationRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

    // Setup mock return values for dependencies
    mockStoryRepository.findById.mockImplementation((id: string, userId: string) => {
      if (id === 'story123' && userId === 'user123') {
        return Promise.resolve({ id: 'story123', userId: 'user123', title: 'Test Story 1', type: 'linear' })
      }
      if (id === 'another_story' && userId === 'user123') {
        return Promise.resolve({ id: 'another_story', userId: 'user123', title: 'Test Story 2', type: 'linear' })
      }
      return Promise.resolve(null)
    })

    deleteLocationUseCase = new DeleteLocationUseCase(locationRepository, mockStoryRepository)

    // Pre-populate a location for testing
    locationRepository.save({
      id: 'loc123',
      storyId: 'story123',
      name: 'Location to Delete',
      description: null,
      climate: null,
      culture: null,
      politics: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should delete an existing location successfully', async () => {
    const deleted = await deleteLocationUseCase.execute('user123', 'loc123')
    expect(deleted).toBe(true)

    const location = await locationRepository.findById('loc123')
    expect(location).toBeNull()
  })

  it('should return false if location not found', async () => {
    await expect(deleteLocationUseCase.execute('user123', 'nonexistent_loc')).rejects.toThrow('Location not found')
  })

    it('should return false if location does not belong to the specified story', async () => {
    await expect(deleteLocationUseCase.execute('user123', 'loc123')).rejects.toThrow('Story not found or not owned by user')

    // Ensure the location was not deleted
    const location = await locationRepository.findById('loc123')
    expect(location).toBeDefined()
  })
})
