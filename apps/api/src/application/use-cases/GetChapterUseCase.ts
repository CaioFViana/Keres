import { ChapterProfileDTO } from '@application/dtos/ChapterDTOs';
import { IChapterRepository } from '@domain/repositories/IChapterRepository';

export class GetChapterUseCase {
  constructor(private readonly chapterRepository: IChapterRepository) {}

  async execute(chapterId: string): Promise<ChapterProfileDTO | null> {
    const chapter = await this.chapterRepository.findById(chapterId);
    if (!chapter) {
      return null;
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
    };
  }
}
