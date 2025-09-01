import type { Location } from '@domain/entities/Location'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository'

import { DeleteLocationUseCase } from '@application/use-cases/location/DeleteLocationUseCase'
import { beforeEach, describe, expect, it } from 'vitest'

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
    deleteLocationUseCase = new DeleteLocationUseCase(locationRepository)

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
    const deleted = await deleteLocationUseCase.execute('loc123', 'story123')
    expect(deleted).toBe(true)

    const location = await locationRepository.findById('loc123')
    expect(location).toBeNull()
  })

  it('should return false if location not found', async () => {
    const deleted = await deleteLocationUseCase.execute('nonexistent_loc', 'story123')
    expect(deleted).toBe(false)
  })

  it('should return false if location does not belong to the specified story', async () => {
    const deleted = await deleteLocationUseCase.execute('loc123', 'another_story')
    expect(deleted).toBe(false)

    // Ensure the location was not deleted
    const location = await locationRepository.findById('loc123')
    expect(location).toBeDefined()
  })
})
