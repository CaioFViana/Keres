import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { ITagRepository } from '@domain/repositories/ITagRepository'
import type { TagResponse } from '@keres/shared'

export class GetTagUseCase {
  constructor(
    private readonly tagRepository: ITagRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, id: string): Promise<TagResponse> {
    const tag = await this.tagRepository.findById(id)
    if (!tag) {
      throw new Error('Tag not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(tag.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    return {
      id: tag.id,
      storyId: tag.storyId,
      name: tag.name,
      color: tag.color,
      isFavorite: tag.isFavorite,
      extraNotes: tag.extraNotes,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    }
  }
}
