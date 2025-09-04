import type { ILocationRepository } from '@domain/repositories/ILocationRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { LocationResponse, LocationUpdatePayload } from '@keres/shared'

export class UpdateLocationUseCase {
  constructor(
    private readonly locationRepository: ILocationRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, data: LocationUpdatePayload): Promise<LocationResponse> {
    const existingLocation = await this.locationRepository.findById(data.id)
    if (!existingLocation) {
      throw new Error('Location not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(existingLocation.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const updatedLocation = {
      ...existingLocation,
      ...data,
      updatedAt: new Date(),
    }

    await this.locationRepository.update(updatedLocation, existingLocation.storyId)

    return {
      id: updatedLocation.id,
      storyId: updatedLocation.storyId,
      name: updatedLocation.name,
      description: updatedLocation.description,
      climate: updatedLocation.climate,
      culture: updatedLocation.culture,
      politics: updatedLocation.politics,
      isFavorite: updatedLocation.isFavorite,
      extraNotes: updatedLocation.extraNotes,
      createdAt: updatedLocation.createdAt,
      updatedAt: updatedLocation.updatedAt,
    }
  }
}
