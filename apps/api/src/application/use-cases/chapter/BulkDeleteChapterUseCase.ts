import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { BulkDeleteResponse } from '@keres/shared'

export class BulkDeleteChapterUseCase {
  constructor(
    private readonly chapterRepository: IChapterRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly sceneRepository: ISceneRepository,
  ) {}

  async execute(userId: string, ids: string[]): Promise<BulkDeleteResponse> {
    const successfulIds: string[] = []
    const failedIds: { id: string; reason: string }[] = []

    for (const id of ids) {
      try {
        const existingChapter = await this.chapterRepository.findById(id)
        if (!existingChapter) {
          failedIds.push({ id, reason: 'Chapter not found' })
          continue
        }

        const scenes = await this.sceneRepository.findByChapterId(id)
        if (scenes && scenes.totalItems > 0) {
          failedIds.push({
            id,
            reason: 'Chapter cannot be deleted because it has associated scenes.',
          })
          continue
        }

        const story = await this.storyRepository.findById(existingChapter.storyId, userId)
        if (!story) {
          failedIds.push({ id, reason: 'Story not found or not owned by user' })
          continue
        }

        await this.chapterRepository.delete(id, existingChapter.storyId)
        successfulIds.push(id)
      } catch (error: unknown) {
        failedIds.push({ id, reason: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return { successfulIds, failedIds }
  }
}
