import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { ChapterResponse } from '@keres/shared'

export class GetChapterUseCase {
  constructor(private readonly chapterRepository: IChapterRepository) {}

  async execute(id: string): Promise<ChapterResponse | null> {
    const chapter = await this.chapterRepository.findById(id)
    if (!chapter) {
      return null
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
