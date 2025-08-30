import { LocationProfileDTO } from '@application/dtos/LocationDTOs';
import { ILocationRepository } from '@domain/repositories/ILocationRepository';

export class GetLocationUseCase {
  constructor(private readonly locationRepository: ILocationRepository) {}

  async execute(locationId: string): Promise<LocationProfileDTO | null> {
    const location = await this.locationRepository.findById(locationId);
    if (!location) {
      return null;
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
    };
  }
}
