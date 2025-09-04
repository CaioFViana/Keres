import type { Moment } from '@domain/entities/Moment'
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository' // Import ISceneRepository
import type { IChapterRepository } from '@domain/repositories/IChapterRepository' // Import IChapterRepository
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { CreateMomentPayload, MomentResponse } from '@keres/shared'

import { ulid } from 'ulid'

export class CreateMomentUseCase {
  constructor(
    private readonly momentRepository: IMomentRepository,
    private readonly sceneRepository: ISceneRepository, // Inject ISceneRepository
    private readonly chapterRepository: IChapterRepository, // Inject IChapterRepository
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, data: CreateMomentPayload): Promise<MomentResponse> {
    // Verify that the scene exists and belongs to the user's story
    const scene = await this.sceneRepository.findById(data.sceneId)
    if (!scene) {
      throw new Error('Scene not found')
    }
    const chapter = await this.chapterRepository.findById(scene.chapterId)
    if (!chapter) {
      throw new Error('Chapter not found')
    }
    const story = await this.storyRepository.findById(chapter.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const newMoment: Moment = {
      id: ulid(),
      sceneId: data.sceneId,
      name: data.name,
      location: data.location || null,
      index: data.index,
      summary: data.summary || null,
      isFavorite: data.isFavorite || false,
      extraNotes: data.extraNotes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.momentRepository.save(newMoment)

    return {
      id: newMoment.id,
      sceneId: newMoment.sceneId,
      name: newMoment.name,
      location: newMoment.location,
      index: newMoment.index,
      summary: newMoment.summary,
      isFavorite: newMoment.isFavorite,
      extraNotes: newMoment.extraNotes,
      createdAt: newMoment.createdAt,
      updatedAt: newMoment.updatedAt,
    }
  }
}
