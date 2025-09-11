import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { BulkDeleteResponse, ListQueryParams } from 'schemas'

export class BulkDeleteSceneUseCase {
  constructor(
    private readonly sceneRepository: ISceneRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly chapterRepository: IChapterRepository,
    private readonly choiceRepository: IChoiceRepository,
  ) {}

  async execute(userId: string, ids: string[]): Promise<BulkDeleteResponse> {
    const successfulIds: string[] = []
    const failedIds: { id: string; reason: string }[] = []

    for (const id of ids) {
      try {
        const existingScene = await this.sceneRepository.findById(id)
        if (!existingScene) {
          failedIds.push({ id, reason: 'Scene not found' })
          continue
        }

        const chapter = await this.chapterRepository.findById(existingScene.chapterId)
        if (!chapter) {
          failedIds.push({ id, reason: 'Chapter not found' })
          continue
        }
        const story = await this.storyRepository.findById(chapter.storyId, userId)
        if (!story) {
          failedIds.push({ id, reason: 'Story not found or not owned by user' })
          continue
        }

        await this.sceneRepository.delete(id, existingScene.chapterId)
        successfulIds.push(id)

        // Re-apply implicit choice logic after each deletion
        const chapterForImplicit = await this.chapterRepository.findById(existingScene.chapterId)
        if (chapterForImplicit) {
          const storyForImplicit = await this.storyRepository.findById(
            chapterForImplicit.storyId,
            userId,
          )
          if (storyForImplicit && storyForImplicit.type === 'linear') {
            const scenesInChapter = (await this.sceneRepository.findByChapterId(
              existingScene.chapterId
            )).items
            scenesInChapter.sort((a, b) => a.index - b.index)

            for (const scene of scenesInChapter) {
              const existingChoices = await this.choiceRepository.findBySceneId(scene.id)
              for (const choice of existingChoices) {
                if (choice.isImplicit) {
                  await this.choiceRepository.delete(choice.id, scene.id)
                }
              }
            }

            for (let i = 0; i < scenesInChapter.length - 1; i++) {
              const currentScene = scenesInChapter[i]
              const nextScene = scenesInChapter[i + 1]

              await this.choiceRepository.create({
                sceneId: currentScene.id,
                nextSceneId: nextScene.id,
                text: 'Next Scene (Implicit)',
                isImplicit: true,
              })
            }
          }
        }
      } catch (error: unknown) {
        failedIds.push({ id, reason: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return { successfulIds, failedIds }
  }
}
