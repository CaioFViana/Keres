import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { ListQueryParams, SceneResponse } from '@keres/shared'

export class GetScenesByLocationIdUseCase {
  constructor(
    private readonly sceneRepository: ISceneRepository,
    private readonly locationRepository: ILocationRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(
    userId: string,
    locationId: string,
    query: ListQueryParams,
  ): Promise<SceneResponse[]> {
    // Verify that the location exists and belongs to the user's story
    const location = await this.locationRepository.findById(locationId)
    if (!location) {
      throw new Error('Location not found')
    }
    // Find the story associated with the location
    const story = await this.storyRepository.findById(location.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const scenes = await this.sceneRepository.findByLocationId(locationId, query)
    return scenes.map((scene) => ({
      id: scene.id,
      chapterId: scene.chapterId,
      name: scene.name,
      index: scene.index,
      locationId: scene.locationId,
      summary: scene.summary,
      gap: scene.gap,
      duration: scene.duration,
      isFavorite: scene.isFavorite,
      extraNotes: scene.extraNotes,
      createdAt: scene.createdAt,
      updatedAt: scene.updatedAt,
    }))
  }
}
