import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { BulkDeleteResponse } from '@keres/shared'

export class BulkDeleteMomentUseCase {
  constructor(
    private readonly momentRepository: IMomentRepository,
    private readonly sceneRepository: ISceneRepository,
    private readonly chapterRepository: IChapterRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(userId: string, ids: string[]): Promise<BulkDeleteResponse> {
    const successfulIds: string[] = []
    const failedIds: { id: string; reason: string }[] = []

    for (const id of ids) {
      try {
        const existingMoment = await this.momentRepository.findById(id)
        if (!existingMoment) {
          failedIds.push({ id, reason: 'Moment not found' })
          continue
        }

        const scene = await this.sceneRepository.findById(existingMoment.sceneId)
        if (!scene) {
          failedIds.push({ id, reason: 'Scene not found' })
          continue
        }
        const chapter = await this.chapterRepository.findById(scene.chapterId)
        if (!chapter) {
          failedIds.push({ id, reason: 'Chapter not found' })
          continue
        }
        const story = await this.storyRepository.findById(chapter.storyId, userId)
        if (!story) {
          failedIds.push({ id, reason: 'Story not found or not owned by user' })
          continue
        }

        await this.momentRepository.delete(id, existingMoment.sceneId)
        successfulIds.push(id)
      } catch (error: unknown) {
        failedIds.push({ id, reason: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return { successfulIds, failedIds }
  }
}
