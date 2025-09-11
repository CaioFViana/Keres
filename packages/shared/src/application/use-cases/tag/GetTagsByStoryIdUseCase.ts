import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { ITagRepository } from '@domain/repositories/ITagRepository'
import type { ListQueryParams, PaginatedResponse, TagResponse } from 'schemas'

export class GetTagsByStoryIdUseCase {
  constructor(
    private readonly tagRepository: ITagRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, storyId: string, query: ListQueryParams): Promise<PaginatedResponse<TagResponse>> {
    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const paginatedTags = await this.tagRepository.findByStoryId(storyId, query)
    const items = paginatedTags.items.map((tag) => ({
      id: tag.id,
      storyId: tag.storyId,
      name: tag.name,
      color: tag.color,
      isFavorite: tag.isFavorite,
      extraNotes: tag.extraNotes,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    }))

    return {
      items,
      totalItems: paginatedTags.totalItems,
    }
  }
}
