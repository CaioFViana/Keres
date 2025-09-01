import type { ITagRepository } from '@domain/repositories/ITagRepository'
import type { TagResponse } from '@keres/shared'

export class GetTagUseCase {
  constructor(private readonly tagRepository: ITagRepository) {}

  async execute(id: string): Promise<TagResponse | null> {
    const tag = await this.tagRepository.findById(id)
    if (!tag) {
      return null
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
