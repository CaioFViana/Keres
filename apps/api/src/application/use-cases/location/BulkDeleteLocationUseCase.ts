import type { ILocationRepository } from '@domain/repositories/ILocationRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

export class BulkDeleteLocationUseCase {
  constructor(
    private readonly locationRepository: ILocationRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly sceneRepository: ISceneRepository,
  ) {}

  async execute(
    userId: string,
    ids: string[],
  ): Promise<{ successfulIds: string[]; failedIds: { id: string; reason: string }[] }> {
    const successfulIds: string[] = []
    const failedIds: { id: string; reason: string }[] = []

    for (const id of ids) {
      try {
        const existingLocation = await this.locationRepository.findById(id)
        if (!existingLocation) {
          failedIds.push({ id, reason: 'Location not found' })
          continue
        }

        const scenes = await this.sceneRepository.findByLocationId(id)
        if (scenes && scenes.length > 0) {
          failedIds.push({
            id,
            reason: 'Location cannot be deleted because it is referenced by scenes.',
          })
          continue
        }

        const story = await this.storyRepository.findById(existingLocation.storyId, userId)
        if (!story) {
          failedIds.push({ id, reason: 'Story not found or not owned by user' })
          continue
        }

        await this.locationRepository.delete(id, existingLocation.storyId)
        successfulIds.push(id)
      } catch (error: any) {
        failedIds.push({ id, reason: error.message || 'Unknown error' })
      }
    }

    return { successfulIds, failedIds }
  }
}
