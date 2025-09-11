import type { ILocationRepository } from '@domain/repositories/ILocationRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { BulkDeleteResponse } from 'schemas'

export class BulkDeleteLocationUseCase {
  constructor(
    private readonly locationRepository: ILocationRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly sceneRepository: ISceneRepository,
  ) {}

  async execute(userId: string, ids: string[]): Promise<BulkDeleteResponse> {
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
        if (scenes.totalItems > 0) {
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
      } catch (error: unknown) {
        failedIds.push({ id, reason: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return { successfulIds, failedIds }
  }
}
