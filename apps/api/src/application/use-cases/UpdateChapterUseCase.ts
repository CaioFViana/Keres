import { IChapterRepository } from '@domain/repositories/IChapterRepository';
import { ChapterUpdatePayload, ChapterResponse } from '@keres/shared';

export class UpdateChapterUseCase {
  constructor(private readonly chapterRepository: IChapterRepository) {}

  async execute(data: ChapterUpdatePayload): Promise<ChapterResponse | null> {
    const existingChapter = await this.chapterRepository.findById(data.id);
    if (!existingChapter) {
      return null; // Chapter not found
    }
    // Add ownership check
    if (data.storyId && existingChapter.storyId !== data.storyId) {
      return null; // Chapter does not belong to this story
    }

    const updatedChapter = {
      ...existingChapter,
      ...data,
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