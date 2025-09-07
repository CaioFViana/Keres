import type { Moment } from '@domain/entities/Moment'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { MomentResponse, UpdateMomentPayload } from '@keres/shared'

export class UpdateManyMomentsUseCase {
  constructor(
    private readonly momentRepository: IMomentRepository,
    private readonly sceneRepository: ISceneRepository,
    private readonly chapterRepository: IChapterRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(userId: string, data: UpdateMomentPayload[]): Promise<MomentResponse[]> {
    if (data.length === 0) {
      return []
    }

    const updatedMoments: Moment[] = []
    const momentResponses: MomentResponse[] = []

    for (const momentPayload of data) {
      if (!momentPayload.id) {
        throw new Error('Moment ID is required for batch update')
      }

      const existingMoment = await this.momentRepository.findById(momentPayload.id)
      if (!existingMoment) {
        throw new Error(`Moment with ID ${momentPayload.id} not found`)
      }

      // Verify that the scene exists and belongs to the user's story
      const scene = await this.sceneRepository.findById(existingMoment.sceneId)
      if (!scene) {
        throw new Error(`Scene with ID ${existingMoment.sceneId} not found`)
      }
      const chapter = await this.chapterRepository.findById(scene.chapterId)
      if (!chapter) {
        throw new Error(`Chapter with ID ${scene.chapterId} not found`)
      }
      const story = await this.storyRepository.findById(chapter.storyId, userId)
      if (!story) {
        throw new Error(`Story with ID ${chapter.storyId} not found or not owned by user`)
      }

      const momentToUpdate: Moment = {
        ...existingMoment,
        ...momentPayload,
        updatedAt: new Date(),
      }
      updatedMoments.push(momentToUpdate)
      momentResponses.push({
        id: momentToUpdate.id,
        sceneId: momentToUpdate.sceneId,
        name: momentToUpdate.name,
        location: momentToUpdate.location,
        index: momentToUpdate.index,
        summary: momentToUpdate.summary,
        isFavorite: momentToUpdate.isFavorite,
        extraNotes: momentToUpdate.extraNotes,
        createdAt: momentToUpdate.createdAt,
        updatedAt: momentToUpdate.updatedAt,
      })
    }

    await this.momentRepository.updateMany(updatedMoments)

    return momentResponses
  }
}
