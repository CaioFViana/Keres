import { CreateStoryDTO, StoryProfileDTO } from '@application/dtos/StoryDTOs';
import { IStoryRepository } from '@domain/repositories/IStoryRepository';
import { Story } from '@domain/entities/Story';
import { ulid } from 'ulid';

export class CreateStoryUseCase {
  constructor(private readonly storyRepository: IStoryRepository) {}

  async execute(data: CreateStoryDTO): Promise<StoryProfileDTO> {
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
