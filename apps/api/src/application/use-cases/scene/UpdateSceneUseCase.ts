import type { IChapterRepository } from '@domain/repositories/IChapterRepository' // Added
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository' // Added
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Added
import type { SceneResponse, SceneUpdatePayload } from '@keres/shared'

export class UpdateSceneUseCase {
  constructor(
    private readonly sceneRepository: ISceneRepository,
    private readonly choiceRepository: IChoiceRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly chapterRepository: IChapterRepository,
  ) {}

  async execute(data: SceneUpdatePayload): Promise<SceneResponse | null> {
    const existingScene = await this.sceneRepository.findById(data.id)
    if (!existingScene) {
      return null // Scene not found
    }
    // Add ownership check
    if (data.chapterId && existingScene.chapterId !== data.chapterId) {
      return null // Scene does not belong to this chapter
    }

    
    const updatedScene = {
      ...existingScene,
      ...data,
      updatedAt: new Date(),
    }

    await this.sceneRepository.update(updatedScene)

    // Logic for implicit choices in linear stories
    const chapter = await this.chapterRepository.findById(updatedScene.chapterId)
    if (chapter) {
      const story = await this.storyRepository.findById(chapter.storyId)
      if (story && story.type === 'linear') {
        const scenesInChapter = await this.sceneRepository.findByChapterId(updatedScene.chapterId)
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

    return {
      id: updatedScene.id,
      chapterId: updatedScene.chapterId,
      name: updatedScene.name,
      index: updatedScene.index,
      summary: updatedScene.summary,
      gap: updatedScene.gap,
      duration: updatedScene.duration,
      isFavorite: updatedScene.isFavorite,
      extraNotes: updatedScene.extraNotes,
      createdAt: updatedScene.createdAt,
      updatedAt: updatedScene.updatedAt,
    }
  }
}
