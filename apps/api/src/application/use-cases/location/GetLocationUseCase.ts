import type { ILocationRepository } from '@domain/repositories/ILocationRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { LocationResponse } from '@keres/shared'

export class GetLocationUseCase {
  constructor(
    private readonly locationRepository: ILocationRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, id: string): Promise<LocationResponse> {
    const location = await this.locationRepository.findById(id)
    if (!location) {
      throw new Error('Location not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(location.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    return {
      id: location.id,
      storyId: location.storyId,
      name: location.name,
      description: location.description,
      climate: location.climate,
      culture: location.culture,
      politics: location.politics,
      isFavorite: location.isFavorite,
      extraNotes: location.extraNotes,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
    }
  }
}
