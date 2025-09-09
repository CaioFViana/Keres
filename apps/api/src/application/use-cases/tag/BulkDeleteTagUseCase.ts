import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { ITagRepository } from '@domain/repositories/ITagRepository'
import type { BulkDeleteResponse } from '@keres/shared'

export class BulkDeleteTagUseCase {
  constructor(
    private readonly tagRepository: ITagRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(userId: string, ids: string[]): Promise<BulkDeleteResponse> {
    const successfulIds: string[] = []
    const failedIds: { id: string; reason: string }[] = []

    for (const id of ids) {
      try {
        const existingTag = await this.tagRepository.findById(id)
        if (!existingTag) {
          failedIds.push({ id, reason: 'Tag not found' })
          continue
        }

        const story = await this.storyRepository.findById(existingTag.storyId, userId)
        if (!story) {
          failedIds.push({ id, reason: 'Story not found or not owned by user' })
          continue
        }

        await this.tagRepository.delete(id, existingTag.storyId)
        successfulIds.push(id)
      } catch (error: unknown) {
        failedIds.push({ id, reason: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return { successfulIds, failedIds }
  }
}
