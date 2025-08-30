import { ILocationRepository } from '@domain/repositories/ILocationRepository';
import { LocationUpdatePayload, LocationResponse } from '@keres/shared';

export class UpdateLocationUseCase {
  constructor(private readonly locationRepository: ILocationRepository) {}

  async execute(data: LocationUpdatePayload): Promise<LocationResponse | null> {
    const existingLocation = await this.locationRepository.findById(data.id);
    if (!existingLocation) {
      return null; // Location not found
    }
    // Add ownership check
    if (data.storyId && existingLocation.storyId !== data.storyId) {
      return null; // Location does not belong to this story
    }

    const updatedLocation = {
      ...existingLocation,
      ...data,
      updatedAt: new Date(),
    };

    await this.locationRepository.update(updatedLocation);

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
    };
  }
}