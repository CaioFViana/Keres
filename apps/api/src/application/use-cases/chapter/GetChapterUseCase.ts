import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { ChapterResponse } from '@keres/shared'

export class GetChapterUseCase {
  constructor(
    private readonly chapterRepository: IChapterRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, id: string): Promise<ChapterResponse> {
    const chapter = await this.chapterRepository.findById(id)
    if (!chapter) {
      throw new Error('Chapter not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(chapter.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    return {
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
  }
}
