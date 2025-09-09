import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

export class BulkDeleteChoiceUseCase {
  constructor(
    private choiceRepository: IChoiceRepository,
    private sceneRepository: ISceneRepository,
    private chapterRepository: IChapterRepository,
    private storyRepository: IStoryRepository,
  ) {}

  async execute(
    userId: string,
    ids: string[],
  ): Promise<{ successfulIds: string[]; failedIds: { id: string; reason: string }[] }> {
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
      } catch (error: any) {
        failedIds.push({ id, reason: error.message || 'Unknown error' })
      }
    }

    return { successfulIds, failedIds }
  }
}
