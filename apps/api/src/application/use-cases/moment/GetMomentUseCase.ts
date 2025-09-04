import type { IMomentRepository } from '@domain/repositories/IMomentRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository' // Import ISceneRepository
import type { IChapterRepository } from '@domain/repositories/IChapterRepository' // Import IChapterRepository
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { MomentResponse } from '@keres/shared'

export class GetMomentUseCase {
  constructor(
    private readonly momentRepository: IMomentRepository,
    private readonly sceneRepository: ISceneRepository, // Inject ISceneRepository
    private readonly chapterRepository: IChapterRepository, // Inject IChapterRepository
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, id: string): Promise<MomentResponse> {
    const moment = await this.momentRepository.findById(id)
    if (!moment) {
      throw new Error('Moment not found')
    }

    // Verify that the scene exists and belongs to the user's story
    const scene = await this.sceneRepository.findById(moment.sceneId)
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

    return {
      id: moment.id,
      sceneId: moment.sceneId,
      name: moment.name,
      location: moment.location,
      index: moment.index,
      summary: moment.summary,
      isFavorite: moment.isFavorite,
      extraNotes: moment.extraNotes,
      createdAt: moment.createdAt,
      updatedAt: moment.updatedAt,
    }
  }
}
