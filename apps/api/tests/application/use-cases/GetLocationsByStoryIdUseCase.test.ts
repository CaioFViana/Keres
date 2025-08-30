import type { Location } from '@domain/entities/Location'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository'

import { GetLocationsByStoryIdUseCase } from '@application/use-cases/GetLocationsByStoryIdUseCase'
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

describe('GetLocationsByStoryIdUseCase', () => {
  let locationRepository: MockLocationRepository
  let getLocationsByStoryIdUseCase: GetLocationsByStoryIdUseCase

  beforeEach(() => {
    locationRepository = new MockLocationRepository()
    getLocationsByStoryIdUseCase = new GetLocationsByStoryIdUseCase(locationRepository)

    // Pre-populate locations for testing
    locationRepository.save({
      id: 'loc1',
      storyId: 'story123',
      name: 'Location 1',
      description: null,
      climate: null,
      culture: null,
      politics: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    locationRepository.save({
      id: 'loc2',
      storyId: 'story123',
      name: 'Location 2',
      description: null,
      climate: null,
      culture: null,
      politics: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    locationRepository.save({
      id: 'loc3',
      storyId: 'story456',
      name: 'Location 3',
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

  it('should return all locations for a given story ID', async () => {
    const locations = await getLocationsByStoryIdUseCase.execute('story123')

    expect(locations).toBeDefined()
    expect(locations.length).toBe(2)
    expect(locations[0].name).toBe('Location 1')
    expect(locations[1].name).toBe('Location 2')
  })

  it('should return an empty array if no locations found for the story ID', async () => {
    const locations = await getLocationsByStoryIdUseCase.execute('nonexistent_story')

    expect(locations).toBeDefined()
    expect(locations.length).toBe(0)
  })
})
