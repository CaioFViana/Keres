import type { Scene } from '@domain/entities/Scene'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository' // Added
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { SceneCreatePayload, SceneResponse } from '@keres/shared'

import { ulid } from 'ulid'

export class CreateSceneUseCase {
  constructor(
    private readonly sceneRepository: ISceneRepository,
    private readonly choiceRepository: IChoiceRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly chapterRepository: IChapterRepository, // Added
  ) {}

  async execute(data: SceneCreatePayload): Promise<SceneResponse> {
    const newScene: Scene = {
      id: ulid(),
      chapterId: data.chapterId,
      name: data.name,
      index: data.index,
      summary: data.summary || null,
      gap: data.gap || null,
      duration: data.duration || null,
      isFavorite: data.isFavorite || false,
      extraNotes: data.extraNotes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.sceneRepository.save(newScene)

    // Logic for implicit choices in linear stories
    const chapter = await this.chapterRepository.findById(newScene.chapterId)
    if (chapter) {
      const story = await this.storyRepository.findById(chapter.storyId)
      if (story && story.type === 'linear') {
        const scenesInChapter = await this.sceneRepository.findByChapterId(newScene.chapterId)
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
      id: newScene.id,
      chapterId: newScene.chapterId,
      name: newScene.name,
      index: newScene.index,
      summary: newScene.summary,
      gap: newScene.gap,
      duration: newScene.duration,
      isFavorite: newScene.isFavorite,
      extraNotes: newScene.extraNotes,
      createdAt: newScene.createdAt,
      updatedAt: newScene.updatedAt,
    }
  }
}
