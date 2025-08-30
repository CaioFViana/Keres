import { IStoryRepository } from '@domain/repositories/IStoryRepository';
import { StoryUpdatePayload, StoryResponse } from '@keres/shared';

export class UpdateStoryUseCase {
  constructor(private readonly storyRepository: IStoryRepository) {}

  async execute(data: StoryUpdatePayload): Promise<StoryResponse | null> {
    const existingStory = await this.storyRepository.findById(data.id);
    if (!existingStory) {
      return null; // Story not found
    }
    // Add ownership check
    if (data.userId && existingStory.userId !== data.userId) {
      return null; // Story does not belong to this user
    }

    const updatedStory = {
      ...existingStory,
      ...data,
      updatedAt: new Date(),
    };

    await this.storyRepository.update(updatedStory);

    return {
      id: updatedStory.id,
      userId: updatedStory.userId,
      title: updatedStory.title,
      summary: updatedStory.summary,
      genre: updatedStory.genre,
      language: updatedStory.language,
      isFavorite: updatedStory.isFavorite,
      extraNotes: updatedStory.extraNotes,
      createdAt: updatedStory.createdAt,
      updatedAt: updatedStory.updatedAt,
    };
  }
}