import { LocationProfileDTO } from '@application/dtos/LocationDTOs';
import { ILocationRepository } from '@domain/repositories/ILocationRepository';

export class GetLocationsByStoryIdUseCase {
  constructor(private readonly locationRepository: ILocationRepository) {}

  async execute(storyId: string): Promise<LocationProfileDTO[]> {
    const locations = await this.locationRepository.findByStoryId(storyId);
    return locations.map(location => ({
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
    }));
  }
}
