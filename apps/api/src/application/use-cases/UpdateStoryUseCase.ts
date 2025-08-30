import { UpdateStoryDTO, StoryProfileDTO } from '@application/dtos/StoryDTOs';
import { IStoryRepository } from '@domain/repositories/IStoryRepository';

export class UpdateStoryUseCase {
  constructor(private readonly storyRepository: IStoryRepository) {}

  async execute(data: UpdateStoryDTO): Promise<StoryProfileDTO | null> {
    const existingStory = await this.storyRepository.findById(data.id);
    if (!existingStory || existingStory.userId !== data.userId) {
      // Story not found or user does not own the story
      return null;
    }

    const updatedStory = {
      ...existingStory,
      title: data.title ?? existingStory.title,
      summary: data.summary ?? existingStory.summary,
      genre: data.genre ?? existingStory.genre,
      language: data.language ?? existingStory.language,
      isFavorite: data.isFavorite ?? existingStory.isFavorite,
      extraNotes: data.extraNotes ?? existingStory.extraNotes,
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
