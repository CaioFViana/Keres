import type { Location } from '@domain/entities/Location'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { LocationCreatePayload, LocationResponse } from '@keres/shared'

import { ulid } from 'ulid'

export class CreateLocationUseCase {
  constructor(
    private readonly locationRepository: ILocationRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, data: LocationCreatePayload): Promise<LocationResponse> {
    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(data.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const newLocation: Location = {
      id: ulid(),
      storyId: data.storyId,
      name: data.name,
      description: data.description || null,
      climate: data.climate || null,
      culture: data.culture || null,
      politics: data.politics || null,
      isFavorite: data.isFavorite || false,
      extraNotes: data.extraNotes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.locationRepository.save(newLocation)

    return {
      id: newLocation.id,
      storyId: newLocation.storyId,
      name: newLocation.name,
      description: newLocation.description,
      climate: newLocation.climate,
      culture: newLocation.culture,
      politics: newLocation.politics,
      isFavorite: newLocation.isFavorite,
      extraNotes: newLocation.extraNotes,
      createdAt: newLocation.createdAt,
      updatedAt: newLocation.updatedAt,
    }
  }
}
