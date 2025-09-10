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

  async execute(
    userId: string,
    id: string,
    data: Omit<SceneUpdatePayload, 'id'>,
  ): Promise<SceneResponse> {
    const existingScene = await this.sceneRepository.findById(id)
    if (!existingScene) {
      throw new Error('Scene not found')
    }

    // Verify that the chapter exists and belongs to the user's story
    const chapter = await this.chapterRepository.findById(existingScene.chapterId)
    if (!chapter) {
      throw new Error('Chapter not found')
    }
    const story = await this.storyRepository.findById(chapter.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const updatedScene = {
      ...existingScene,
      ...data,
      id: id, // Ensure ID is set from the URL parameter
      updatedAt: new Date(),
    }

    await this.sceneRepository.update(updatedScene, existingScene.chapterId)

    // Logic for implicit choices in linear stories
    const chapterForImplicit = await this.chapterRepository.findById(updatedScene.chapterId)
    if (chapterForImplicit) {
      const storyForImplicit = await this.storyRepository.findById(
        chapterForImplicit.storyId,
        userId,
      )
      if (storyForImplicit && storyForImplicit.type === 'linear') {
        const scenesInChapter = await this.sceneRepository.findByChapterId(updatedScene.chapterId)
        scenesInChapter.sort((a, b) => a.index - b.index)

        // Remove any existing implicit choices for the chapter to recreate them
        for (const scene of scenesInChapter) {
          const existingChoices = await this.choiceRepository.findBySceneId(scene.id)
          for (const choice of existingChoices) {
            if (choice.isImplicit) {
              await this.choiceRepository.delete(choice.id, scene.id)
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
      locationId: updatedScene.locationId,
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
