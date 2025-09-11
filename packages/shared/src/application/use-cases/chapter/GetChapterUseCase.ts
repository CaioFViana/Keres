import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

import { type ChapterResponse, SceneResponseSchema } from 'schemas'

export class GetChapterUseCase {
  constructor(
    private readonly chapterRepository: IChapterRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly sceneRepository: ISceneRepository,
  ) {}

  async execute(userId: string, id: string, include: string[] = []): Promise<ChapterResponse> {
    const chapter = await this.chapterRepository.findById(id)
    if (!chapter) {
      throw new Error('Chapter not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(chapter.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const response: ChapterResponse = {
      id: chapter.id,
      storyId: chapter.storyId,
      name: chapter.name,
      index: chapter.index,
      summary: chapter.summary,
      isFavorite: chapter.isFavorite,
      extraNotes: chapter.extraNotes,
      createdAt: chapter.createdAt,
      updatedAt: chapter.updatedAt,
    }

    if (include.includes('scenes')) {
      const rawScenes = await this.sceneRepository.findByChapterId(chapter.id)
      response.scenes = rawScenes.items.map((s) => SceneResponseSchema.parse(s))
    }

    return response
  }
}
