import { CreateChapterDTO, ChapterProfileDTO } from '@application/dtos/ChapterDTOs';
import { IChapterRepository } from '@domain/repositories/IChapterRepository';
import { Chapter } from '@domain/entities/Chapter';
import { ulid } from 'ulid';

export class CreateChapterUseCase {
  constructor(private readonly chapterRepository: IChapterRepository) {}

  async execute(data: CreateChapterDTO): Promise<ChapterProfileDTO> {
    const newChapter: Chapter = {
      id: ulid(),
      storyId: data.storyId,
      name: data.name,
      index: data.index,
      summary: data.summary || null,
      isFavorite: data.isFavorite || false,
      extraNotes: data.extraNotes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.chapterRepository.save(newChapter);

    return {
      id: newChapter.id,
      storyId: newChapter.storyId,
      name: newChapter.name,
      index: newChapter.index,
      summary: newChapter.summary,
      isFavorite: newChapter.isFavorite,
      extraNotes: newChapter.extraNotes,
      createdAt: newChapter.createdAt,
      updatedAt: newChapter.updatedAt,
    };
  }
}
