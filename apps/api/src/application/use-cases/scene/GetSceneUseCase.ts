import type { IChapterRepository } from '@domain/repositories/IChapterRepository' // Import IChapterRepository
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { SceneResponse } from '@keres/shared'

export class GetSceneUseCase {
  constructor(
    private readonly sceneRepository: ISceneRepository,
    private readonly chapterRepository: IChapterRepository, // Inject IChapterRepository
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, id: string): Promise<SceneResponse> {
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

    return {
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
  }
}
