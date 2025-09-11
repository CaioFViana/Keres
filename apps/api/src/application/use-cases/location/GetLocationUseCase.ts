import type { ILocationRepository } from '@domain/repositories/ILocationRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

import { type LocationResponse, SceneResponseSchema } from '@keres/shared'

export class GetLocationUseCase {
  constructor(
    private readonly locationRepository: ILocationRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly sceneRepository: ISceneRepository,
  ) {}

  async execute(userId: string, id: string, include: string[] = []): Promise<LocationResponse> {
    const location = await this.locationRepository.findById(id)
    if (!location) {
      throw new Error('Location not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(location.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const response: LocationResponse = {
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

    if (include.includes('scenes')) {
      const rawScenes = await this.sceneRepository.findByLocationId(location.id)
      response.scenes = rawScenes.items.map((s) => SceneResponseSchema.parse(s))
    }

    return response
  }
}
