import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository' // Import
import type { IChapterRepository } from '@domain/repositories/IChapterRepository' // Import
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import

export class DeleteChoiceUseCase {
  constructor(
    private choiceRepository: IChoiceRepository,
    private sceneRepository: ISceneRepository, // Inject
    private chapterRepository: IChapterRepository, // Inject
    private storyRepository: IStoryRepository, // Inject
  ) {}

  async execute(userId: string, id: string): Promise<void> {
    const existingChoice = await this.choiceRepository.findById(id)
    if (!existingChoice) {
      throw new Error('Choice not found')
    }

    // Verify scene ownership
    const scene = await this.sceneRepository.findById(existingChoice.sceneId)
    if (!scene) {
      throw new Error('Scene not found for choice')
    }
    const chapter = await this.chapterRepository.findById(scene.chapterId)
    if (!chapter) {
      throw new Error('Chapter not found for scene')
    }
    const story = await this.storyRepository.findById(chapter.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user for choice')
    }

    await this.choiceRepository.delete(id, existingChoice.sceneId)
  }
}
