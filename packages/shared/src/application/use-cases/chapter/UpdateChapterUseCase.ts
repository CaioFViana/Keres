import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { ChapterResponse, ChapterUpdatePayload } from 'schemas'

export class UpdateChapterUseCase {
  constructor(
    private readonly chapterRepository: IChapterRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(
    userId: string,
    id: string,
    data: Omit<ChapterUpdatePayload, 'id'>,
  ): Promise<ChapterResponse> {
    const existingChapter = await this.chapterRepository.findById(id)
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
      id: id, // Ensure ID is set from the URL parameter
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
