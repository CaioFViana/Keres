import type { Location } from '@domain/entities/Location'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository'

import { CreateLocationUseCase } from '@application/use-cases/CreateLocationUseCase'
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

describe('CreateLocationUseCase', () => {
  let locationRepository: MockLocationRepository
  let createLocationUseCase: CreateLocationUseCase

  beforeEach(() => {
    locationRepository = new MockLocationRepository()
    createLocationUseCase = new CreateLocationUseCase(locationRepository)
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

    const locationProfile = await createLocationUseCase.execute(locationDTO)

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

    const locationProfile = await createLocationUseCase.execute(locationDTO)

    expect(locationProfile).toBeDefined()
    expect(locationProfile.name).toBe('Mountain')
    expect(locationProfile.description).toBeNull()
    expect(locationProfile.climate).toBeNull()
    expect(locationProfile.culture).toBeNull()
    expect(locationProfile.politics).toBeNull()
    expect(locationProfile.isFavorite).toBe(false)
    expect(locationProfile.extraNotes).toBeNull()
  })
})
