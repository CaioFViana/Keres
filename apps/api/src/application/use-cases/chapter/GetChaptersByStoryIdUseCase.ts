import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { ChapterResponse } from '@keres/shared'

export class GetChaptersByStoryIdUseCase {
  constructor(private readonly chapterRepository: IChapterRepository) {}

  async execute(storyId: string): Promise<ChapterResponse[]> {
    const chapters = await this.chapterRepository.findByStoryId(storyId)
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
