import type { Moment } from '@domain/entities/Moment'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { CreateMomentPayload, MomentResponse } from 'schemas'

import { ulid } from 'ulid'

export class CreateManyMomentsUseCase {
  constructor(
    private readonly momentRepository: IMomentRepository,
    private readonly sceneRepository: ISceneRepository,
    private readonly chapterRepository: IChapterRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(userId: string, data: CreateMomentPayload[]): Promise<MomentResponse[]> {
    if (data.length === 0) {
      return []
    }

    const newMoments: Moment[] = []
    const momentResponses: MomentResponse[] = []

    for (const momentPayload of data) {
      // Verify that the scene exists and belongs to the user's story
      const scene = await this.sceneRepository.findById(momentPayload.sceneId)
      if (!scene) {
        throw new Error(`Scene with ID ${momentPayload.sceneId} not found`)
      }
      const chapter = await this.chapterRepository.findById(scene.chapterId)
      if (!chapter) {
        throw new Error(`Chapter with ID ${scene.chapterId} not found`)
      }
      const story = await this.storyRepository.findById(chapter.storyId, userId)
      if (!story) {
        throw new Error(`Story with ID ${chapter.storyId} not found or not owned by user`)
      }

      const newMoment: Moment = {
        id: ulid(),
        sceneId: momentPayload.sceneId,
        name: momentPayload.name,
        location: momentPayload.location || null,
        index: momentPayload.index,
        summary: momentPayload.summary || null,
        isFavorite: momentPayload.isFavorite || false,
        extraNotes: momentPayload.extraNotes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      newMoments.push(newMoment)
      momentResponses.push({
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
      })
    }

    await this.momentRepository.saveMany(newMoments)

    return momentResponses
  }
}
