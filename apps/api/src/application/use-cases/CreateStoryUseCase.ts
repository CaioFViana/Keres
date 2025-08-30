import { Story } from '@domain/entities/Story';
import { IStoryRepository } from '@domain/repositories/IStoryRepository';
import { ulid } from 'ulid';
import { StoryCreatePayload, StoryResponse } from '@keres/shared';

export class CreateStoryUseCase {
  constructor(private readonly storyRepository: IStoryRepository) {}

  async execute(data: StoryCreatePayload): Promise<StoryResponse> {
    const newStory: Story = {
      id: ulid(),
      userId: data.userId,
      title: data.title,
      summary: data.summary || null,
      genre: data.genre || null,
      language: data.language || null,
      isFavorite: data.isFavorite || false,
      extraNotes: data.extraNotes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.storyRepository.save(newStory);

    return {
      id: newStory.id,
      userId: newStory.userId,
      title: newStory.title,
      summary: newStory.summary,
      genre: newStory.genre,
      language: newStory.language,
      isFavorite: newStory.isFavorite,
      extraNotes: newStory.extraNotes,
      createdAt: newStory.createdAt,
      updatedAt: newStory.updatedAt,
    };
  }
}