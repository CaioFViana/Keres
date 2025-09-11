import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

import { ChoiceResponseSchema, MomentResponseSchema, type SceneResponse } from 'schemas'

export class GetSceneUseCase {
  constructor(
    private readonly sceneRepository: ISceneRepository,
    private readonly chapterRepository: IChapterRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly momentRepository: IMomentRepository,
    private readonly choiceRepository: IChoiceRepository,
  ) {}

  async execute(userId: string, id: string, include: string[] = []): Promise<SceneResponse> {
    const scene = await this.sceneRepository.findById(id)
    if (!scene) {
      throw new Error('Scene not found')
    }

    // Verify that the chapter exists and belongs to the user's story
    const chapter = await this.chapterRepository.findById(scene.chapterId)
    if (!chapter) {
      throw new Error('Chapter not found')
    }
    const story = await this.storyRepository.findById(chapter.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const response: SceneResponse = {
      id: scene.id,
      chapterId: scene.chapterId,
      name: scene.name,
      index: scene.index,
      locationId: scene.locationId,
      summary: scene.summary,
      gap: scene.gap,
      duration: scene.duration,
      isFavorite: scene.isFavorite,
      extraNotes: scene.extraNotes,
      createdAt: scene.createdAt,
      updatedAt: scene.updatedAt,
    }

    if (include.includes('moments')) {
      const rawMoments = await this.momentRepository.findBySceneId(scene.id)
      response.moments = rawMoments.items.map((m) => MomentResponseSchema.parse(m))
    }

    if (include.includes('choices')) {
      const rawChoices = await this.choiceRepository.findBySceneId(scene.id)
      response.choices = rawChoices.map((c) => ChoiceResponseSchema.parse(c))
    }

    return response
  }
}
