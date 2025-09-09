import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { BulkDeleteResponse } from '@keres/shared'

export class BulkDeleteChoiceUseCase {
  constructor(
    private readonly choiceRepository: IChoiceRepository,
    private readonly sceneRepository: ISceneRepository,
    private readonly chapterRepository: IChapterRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(userId: string, ids: string[]): Promise<BulkDeleteResponse> {
    const successfulIds: string[] = []
    const failedIds: { id: string; reason: string }[] = []

    for (const id of ids) {
      try {
        const existingChoice = await this.choiceRepository.findById(id)
        if (!existingChoice) {
          failedIds.push({ id, reason: 'Choice not found' })
          continue
        }

        const scene = await this.sceneRepository.findById(existingChoice.sceneId)
        if (!scene) {
          failedIds.push({ id, reason: 'Scene not found for choice' })
          continue
        }
        const chapter = await this.chapterRepository.findById(scene.chapterId)
        if (!chapter) {
          failedIds.push({ id, reason: 'Chapter not found for scene' })
          continue
        }
        const story = await this.storyRepository.findById(chapter.storyId, userId)
        if (!story) {
          failedIds.push({ id, reason: 'Story not found or not owned by user for choice' })
          continue
        }

        await this.choiceRepository.delete(id, existingChoice.sceneId)
        successfulIds.push(id)
      } catch (error: unknown) {
        failedIds.push({ id, reason: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return { successfulIds, failedIds }
  }
}
