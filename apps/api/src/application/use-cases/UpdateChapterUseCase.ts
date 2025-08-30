import { UpdateChapterDTO, ChapterProfileDTO } from '@application/dtos/ChapterDTOs';
import { IChapterRepository } from '@domain/repositories/IChapterRepository';

export class UpdateChapterUseCase {
  constructor(private readonly chapterRepository: IChapterRepository) {}

  async execute(data: UpdateChapterDTO): Promise<ChapterProfileDTO | null> {
    const existingChapter = await this.chapterRepository.findById(data.id);
    if (!existingChapter || existingChapter.storyId !== data.storyId) {
      // Chapter not found or does not belong to the specified story
      return null;
    }

    const updatedChapter = {
      ...existingChapter,
      name: data.name ?? existingChapter.name,
      index: data.index ?? existingChapter.index,
      summary: data.summary ?? existingChapter.summary,
      isFavorite: data.isFavorite ?? existingChapter.isFavorite,
      extraNotes: data.extraNotes ?? existingChapter.extraNotes,
      updatedAt: new Date(),
    };

    await this.chapterRepository.update(updatedChapter);

    return {
      id: updatedChapter.id,
      storyId: updatedChapter.storyId,
      name: updatedChapter.name,
      index: updatedChapter.index,
      summary: updatedChapter.summary,
      isFavorite: updatedChapter.isFavorite,
      extraNotes: updatedChapter.extraNotes,
      createdAt: updatedChapter.createdAt,
      updatedAt: updatedChapter.updatedAt,
    };
  }
}
