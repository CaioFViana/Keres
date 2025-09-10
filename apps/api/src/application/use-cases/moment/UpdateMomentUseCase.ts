import type { IChapterRepository } from '@domain/repositories/IChapterRepository' // Import IChapterRepository
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository' // Import ISceneRepository
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { MomentResponse, UpdateMomentPayload } from '@keres/shared'

export class UpdateMomentUseCase {
  constructor(
    private readonly momentRepository: IMomentRepository,
    private readonly sceneRepository: ISceneRepository, // Inject ISceneRepository
    private readonly chapterRepository: IChapterRepository, // Inject IChapterRepository
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, id: string, data: Omit<UpdateMomentPayload, 'id'>): Promise<MomentResponse> {
    const existingMoment = await this.momentRepository.findById(id)
    if (!existingMoment) {
      throw new Error('Moment not found')
    }

    // Verify that the scene exists and belongs to the user's story
    const scene = await this.sceneRepository.findById(existingMoment.sceneId)
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

    const updatedMoment = {
      ...existingMoment,
      ...data,
      id: id, // Ensure ID is set from the URL parameter
      updatedAt: new Date(),
    }

    await this.momentRepository.update(updatedMoment, existingMoment.sceneId)

    return {
      id: updatedMoment.id,
      sceneId: updatedMoment.sceneId,
      name: updatedMoment.name,
      location: updatedMoment.location,
      index: updatedMoment.index,
      summary: updatedMoment.summary,
      isFavorite: updatedMoment.isFavorite,
      extraNotes: updatedMoment.extraNotes,
      createdAt: updatedMoment.createdAt,
      updatedAt: updatedMoment.updatedAt,
    }
  }
}
