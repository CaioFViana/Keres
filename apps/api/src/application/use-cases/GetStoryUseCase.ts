import { IStoryRepository } from '@domain/repositories/IStoryRepository';
import { StoryResponse } from '@keres/shared';

export class GetStoryUseCase {
  constructor(private readonly storyRepository: IStoryRepository) {}

  async execute(id: string): Promise<StoryResponse | null> {
    const story = await this.storyRepository.findById(id);
    if (!story) {
      return null;
    }

    return {
      id: story.id,
      userId: story.userId,
      title: story.title,
      summary: story.summary,
      genre: story.genre,
      language: story.language,
      isFavorite: story.isFavorite,
      extraNotes: story.extraNotes,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    };
  }
}