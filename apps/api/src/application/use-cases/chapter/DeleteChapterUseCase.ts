import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository

export class DeleteChapterUseCase {
  constructor(
    private readonly chapterRepository: IChapterRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, id: string): Promise<boolean> {
    const existingChapter = await this.chapterRepository.findById(id)
    if (!existingChapter) {
      throw new Error('Chapter not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(existingChapter.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    await this.chapterRepository.delete(id, existingChapter.storyId)
    return true
  }
}
