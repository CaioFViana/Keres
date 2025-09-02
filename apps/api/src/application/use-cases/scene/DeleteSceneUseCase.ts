import type { IChapterRepository } from '@domain/repositories/IChapterRepository' // Added
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository' // Added
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Added

export class DeleteSceneUseCase {
  constructor(
    private readonly sceneRepository: ISceneRepository,
    private readonly choiceRepository: IChoiceRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly chapterRepository: IChapterRepository,
  ) {}

  async execute(id: string): Promise<boolean> {
    const existingScene = await this.sceneRepository.findById(id)
    if (!existingScene) {
      return false // Scene not found
    }
    // Check ownership
    await this.sceneRepository.delete(id)

    // Logic for implicit choices in linear stories after deletion
    const chapter = await this.chapterRepository.findById(existingScene.chapterId)
    if (chapter) {
      const story = await this.storyRepository.findById(chapter.storyId)
      if (story && story.type === 'linear') {
        const scenesInChapter = await this.sceneRepository.findByChapterId(existingScene.chapterId)
        scenesInChapter.sort((a, b) => a.index - b.index)

        // Remove any existing implicit choices for the chapter to recreate them
        for (const scene of scenesInChapter) {
          const existingChoices = await this.choiceRepository.findBySceneId(scene.id)
          for (const choice of existingChoices) {
            if (choice.isImplicit) {
              await this.choiceRepository.delete(choice.id)
            }
          }
        }

        // Recreate implicit choices based on sorted index
        for (let i = 0; i < scenesInChapter.length - 1; i++) {
          const currentScene = scenesInChapter[i]
          const nextScene = scenesInChapter[i + 1]

          await this.choiceRepository.create({
            sceneId: currentScene.id,
            nextSceneId: nextScene.id,
            text: 'Next Scene (Implicit)', // Default text for implicit choices
            isImplicit: true,
          })
        }
      }
    }

    return true
  }
}
