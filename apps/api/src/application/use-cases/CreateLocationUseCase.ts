import type { Location } from '@domain/entities/Location'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository'
import type { LocationCreatePayload, LocationResponse } from '@keres/shared'

import { ulid } from 'ulid'

export class CreateLocationUseCase {
  constructor(private readonly locationRepository: ILocationRepository) {}

  async execute(data: LocationCreatePayload): Promise<LocationResponse> {
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
