import type { Location } from '@domain/entities/Location'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository'

import { GetLocationUseCase } from '@application/use-cases/GetLocationUseCase'
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

describe('GetLocationUseCase', () => {
  let locationRepository: MockLocationRepository
  let getLocationUseCase: GetLocationUseCase

  beforeEach(() => {
    locationRepository = new MockLocationRepository()
    getLocationUseCase = new GetLocationUseCase(locationRepository)

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
    const locationProfile = await getLocationUseCase.execute('loc123')

    expect(locationProfile).toBeDefined()
    expect(locationProfile?.id).toBe('loc123')
    expect(locationProfile?.name).toBe('Test Location')
  })

  it('should return null for an invalid location ID', async () => {
    const locationProfile = await getLocationUseCase.execute('nonexistent')

    expect(locationProfile).toBeNull()
  })
})
