import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { ChapterResponse, ChapterUpdatePayload } from '@keres/shared'

export class UpdateChapterUseCase {
  constructor(
    private readonly chapterRepository: IChapterRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, data: ChapterUpdatePayload): Promise<ChapterResponse> {
    const existingChapter = await this.chapterRepository.findById(data.id)
    if (!existingChapter) {
      throw new Error('Chapter not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(existingChapter.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const updatedChapter = {
      ...existingChapter,
      ...data,
      updatedAt: new Date(),
    }

    await this.chapterRepository.update(updatedChapter, existingChapter.storyId)

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
    }
  }
}
