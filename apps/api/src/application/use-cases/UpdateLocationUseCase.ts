import { UpdateLocationDTO, LocationProfileDTO } from '@application/dtos/LocationDTOs';
import { ILocationRepository } from '@domain/repositories/ILocationRepository';

export class UpdateLocationUseCase {
  constructor(private readonly locationRepository: ILocationRepository) {}

  async execute(data: UpdateLocationDTO): Promise<LocationProfileDTO | null> {
    const existingLocation = await this.locationRepository.findById(data.id);
    if (!existingLocation || existingLocation.storyId !== data.storyId) {
      // Location not found or does not belong to the specified story
      return null;
    }

    const updatedLocation = {
      ...existingLocation,
      name: data.name ?? existingLocation.name,
      description: data.description ?? existingLocation.description,
      climate: data.climate ?? existingLocation.climate,
      culture: data.culture ?? existingLocation.culture,
      politics: data.politics ?? existingLocation.politics,
      isFavorite: data.isFavorite ?? existingLocation.isFavorite,
      extraNotes: data.extraNotes ?? existingLocation.extraNotes,
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
