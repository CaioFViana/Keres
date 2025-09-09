import type { ILocationRepository } from '@domain/repositories/ILocationRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'

export class DeleteLocationUseCase {
  constructor(
    private readonly locationRepository: ILocationRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly sceneRepository: ISceneRepository,
  ) {}

  async execute(userId: string, id: string): Promise<boolean> {
    const existingLocation = await this.locationRepository.findById(id)
    if (!existingLocation) {
      throw new Error('Location not found')
    }

    const scenes = await this.sceneRepository.findByLocationId(id)
    if (scenes && scenes.length > 0) {
      throw new Error('Location cannot be deleted because it is referenced by scenes.')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(existingLocation.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    await this.locationRepository.delete(id, existingLocation.storyId)
    return true
  }
}
