import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { ChapterResponse, ListQueryParams } from '@keres/shared'

export class GetChaptersByStoryIdUseCase {
  constructor(
    private readonly chapterRepository: IChapterRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(
    userId: string,
    storyId: string,
    query: ListQueryParams,
  ): Promise<ChapterResponse[]> {
    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const chapters = await this.chapterRepository.findByStoryId(storyId, query)
    return chapters.map((chapter) => ({
      id: chapter.id,
      storyId: chapter.storyId,
      name: chapter.name,
      index: chapter.index,
      summary: chapter.summary,
      isFavorite: chapter.isFavorite,
      extraNotes: chapter.extraNotes,
      createdAt: chapter.createdAt,
      updatedAt: chapter.updatedAt,
    }))
  }
}
