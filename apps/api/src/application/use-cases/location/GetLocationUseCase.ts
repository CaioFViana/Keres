import type { ILocationRepository } from '@domain/repositories/ILocationRepository'
import type { LocationResponse } from '@keres/shared'

export class GetLocationUseCase {
  constructor(private readonly locationRepository: ILocationRepository) {}

  async execute(id: string): Promise<LocationResponse | null> {
    const location = await this.locationRepository.findById(id)
    if (!location) {
      return null
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
