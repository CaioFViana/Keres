import type { Chapter } from '@domain/entities/Chapter'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { ChapterCreatePayload, ChapterResponse } from 'schemas'

import { ulid } from 'ulid'

export class CreateChapterUseCase {
  constructor(
    private readonly chapterRepository: IChapterRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, data: ChapterCreatePayload): Promise<ChapterResponse> {
    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(data.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

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
    }

    await this.chapterRepository.save(newChapter)

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
    }
  }
}
