import { ChapterProfileDTO } from '@application/dtos/ChapterDTOs';
import { IChapterRepository } from '@domain/repositories/IChapterRepository';

export class GetChaptersByStoryIdUseCase {
  constructor(private readonly chapterRepository: IChapterRepository) {}

  async execute(storyId: string): Promise<ChapterProfileDTO[]> {
    const chapters = await this.chapterRepository.findByStoryId(storyId);
    return chapters.map(chapter => ({
      id: chapter.id,
      storyId: chapter.storyId,
      name: chapter.name,
      index: chapter.index,
      summary: chapter.summary,
      isFavorite: chapter.isFavorite,
      extraNotes: chapter.extraNotes,
      createdAt: chapter.createdAt,
      updatedAt: chapter.updatedAt,
    }));
  }
}
