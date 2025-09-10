import type { IChapterRepository } from '@domain/repositories/IChapterRepository' // Import IChapterRepository
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { ListQueryParams, SceneResponse, PaginatedResponse } from '@keres/shared'

export class GetScenesByChapterIdUseCase {
  constructor(
    private readonly sceneRepository: ISceneRepository,
    private readonly chapterRepository: IChapterRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(
    userId: string,
    chapterId: string,
    query: ListQueryParams,
  ): Promise<PaginatedResponse<SceneResponse>> {
    // Verify that the chapter exists and belongs to the user's story
    const chapter = await this.chapterRepository.findById(chapterId)
    if (!chapter) {
      throw new Error('Chapter not found')
    }
    const story = await this.storyRepository.findById(chapter.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const paginatedScenes = await this.sceneRepository.findByChapterId(chapterId, query)
    const items = paginatedScenes.items.map((scene) => ({
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
    }))

    return {
      items,
      totalItems: paginatedScenes.totalItems,
    }
  }
}
