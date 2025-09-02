import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { StoryResponse } from '@keres/shared'

export class GetStoriesByUserIdUseCase {
  constructor(private readonly storyRepository: IStoryRepository) {}

  async execute(userId: string): Promise<StoryResponse[]> {
    const stories = await this.storyRepository.findByUserId(userId)
    return stories.map((story) => ({
      id: story.id,
      userId: story.userId,
      title: story.title,
      summary: story.summary,
      type: story.type == 'linear' ? story.type : 'branching',
      genre: story.genre,
      language: story.language,
      isFavorite: story.isFavorite,
      extraNotes: story.extraNotes,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    }))
  }
}
