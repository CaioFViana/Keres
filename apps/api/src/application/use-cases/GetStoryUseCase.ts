import { StoryProfileDTO } from '@application/dtos/StoryDTOs';
import { IStoryRepository } from '@domain/repositories/IStoryRepository';

export class GetStoryUseCase {
  constructor(private readonly storyRepository: IStoryRepository) {}

  async execute(storyId: string): Promise<StoryProfileDTO | null> {
    const story = await this.storyRepository.findById(storyId);
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
