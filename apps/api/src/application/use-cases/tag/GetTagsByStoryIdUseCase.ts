import type { ITagRepository } from '@domain/repositories/ITagRepository'
import type { TagResponse } from '@keres/shared'

export class GetTagsByStoryIdUseCase {
  constructor(private readonly tagRepository: ITagRepository) {}

  async execute(storyId: string): Promise<TagResponse[]> {
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
