import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { ITagRepository } from '@domain/repositories/ITagRepository'
import type { TagResponse } from '@keres/shared'

export class GetTagsByStoryIdUseCase {
  constructor(
    private readonly tagRepository: ITagRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, storyId: string): Promise<TagResponse[]> {
    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const tags = await this.tagRepository.findByStoryId(storyId)
    return tags.map((tag) => ({
      id: tag.id,
      storyId: tag.storyId,
      name: tag.name,
      color: tag.color,
      isFavorite: tag.isFavorite,
      extraNotes: tag.extraNotes,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    }))
  }
}
