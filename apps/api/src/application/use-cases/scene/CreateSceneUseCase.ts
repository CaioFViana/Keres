import type { Scene } from '@domain/entities/Scene'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository' // Added
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository' // Added
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
    private readonly locationRepository: ILocationRepository, // Added
  ) {}

  async execute(userId: string, data: SceneCreatePayload): Promise<SceneResponse> {
    // Verify that the chapter exists and belongs to the user's story
    const chapter = await this.chapterRepository.findById(data.chapterId)
    if (!chapter) {
      throw new Error('Chapter not found')
    }
    const story = await this.storyRepository.findById(chapter.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    // Verify that the location exists and belongs to the same story
    const location = await this.locationRepository.findById(data.locationId)
    if (!location) {
      throw new Error('Location not found')
    }
    if (location.storyId !== chapter.storyId) {
      throw new Error('Location does not belong to the same story as the chapter')
    }

    const newScene: Scene = {
      id: ulid(),
      chapterId: data.chapterId,
      locationId: data.locationId, // Added locationId
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
    // Re-fetch chapter and story with userId for ownership verification within this block
    const chapterForImplicit = await this.chapterRepository.findById(newScene.chapterId)
    if (chapterForImplicit) {
      const storyForImplicit = await this.storyRepository.findById(
        chapterForImplicit.storyId,
        userId,
      )
      if (storyForImplicit && storyForImplicit.type === 'linear') {
        const scenesInChapter = (await this.sceneRepository.findByChapterId(newScene.chapterId)).items
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
      id: newScene.id,
      chapterId: newScene.chapterId,
      locationId: newScene.locationId, // Added locationId
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
