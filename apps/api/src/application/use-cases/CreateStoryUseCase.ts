import type { Story } from '@domain/entities/Story'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { StoryCreatePayload, StoryResponse } from '@keres/shared'

import { ulid } from 'ulid'

export class CreateStoryUseCase {
  constructor(private readonly storyRepository: IStoryRepository) {}

  async execute(data: StoryCreatePayload): Promise<StoryResponse> {
    const newStory: Story = {
      id: ulid(),
      userId: data.userId,
      type: data.type || 'linear', // Added type field
      title: data.title,
      summary: data.summary || null,
      genre: data.genre || null,
      language: data.language || null,
      isFavorite: data.isFavorite || false,
      extraNotes: data.extraNotes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.storyRepository.save(newStory)

    return {
      id: newStory.id,
      userId: newStory.userId,
      type: newStory.type, // Added type field
      title: newStory.title,
      summary: newStory.summary,
      genre: newStory.genre,
      language: newStory.language,
      isFavorite: newStory.isFavorite,
      extraNotes: newStory.extraNotes,
      createdAt: newStory.createdAt,
      updatedAt: newStory.updatedAt,
    }
  }
}
