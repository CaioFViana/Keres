import type { IChapterRepository } from '@domain/repositories/IChapterRepository' // Import
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository' // Import
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import
import { ChoiceResponseSchema } from '@keres/shared'
import type { z } from 'zod'

export class GetChoicesBySceneIdUseCase {
  constructor(
    private choiceRepository: IChoiceRepository,
    private sceneRepository: ISceneRepository,
    private chapterRepository: IChapterRepository,
    private storyRepository: IStoryRepository,
  ) {}

  async execute(userId: string, sceneId: string): Promise<z.infer<typeof ChoiceResponseSchema>[]> {
    // Verify scene ownership
    const scene = await this.sceneRepository.findById(sceneId)
    if (!scene) {
      throw new Error('Scene not found')
    }
    const chapter = await this.chapterRepository.findById(scene.chapterId)
    if (!chapter) {
      throw new Error('Chapter not found for scene')
    }
    const story = await this.storyRepository.findById(chapter.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user for scene')
    }

    const choices = await this.choiceRepository.findBySceneId(sceneId)
    return choices.map((choice) => ChoiceResponseSchema.parse(choice))
  }
}
