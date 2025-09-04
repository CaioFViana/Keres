import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { StoryResponse } from '@keres/shared'

export class GetStoryUseCase {
  constructor(private readonly storyRepository: IStoryRepository) {}

  async execute(userId: string, id: string): Promise<StoryResponse | null> {
    const story = await this.storyRepository.findById(id, userId)
    if (!story || story.userId !== userId) {
      return null
    }

    return {
      id: story.id,
      userId: story.userId,
      title: story.title,
      type: story.type,
      summary: story.summary,
      genre: story.genre,
      language: story.language,
      isFavorite: story.isFavorite,
      extraNotes: story.extraNotes,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    }
  }
}
