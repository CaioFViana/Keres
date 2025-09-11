import type { Tag } from '@domain/entities/Tag'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { ITagRepository } from '@domain/repositories/ITagRepository'
import type { CreateTagPayload, TagResponse } from 'schemas'

import { ulid } from 'ulid'

export class CreateTagUseCase {
  constructor(
    private readonly tagRepository: ITagRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, data: CreateTagPayload): Promise<TagResponse> {
    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(data.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const newTag: Tag = {
      id: ulid(),
      storyId: data.storyId,
      name: data.name,
      color: data.color || null,
      isFavorite: data.isFavorite || false,
      extraNotes: data.extraNotes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.tagRepository.save(newTag)

    return {
      id: newTag.id,
      storyId: newTag.storyId,
      name: newTag.name,
      color: newTag.color,
      isFavorite: newTag.isFavorite,
      extraNotes: newTag.extraNotes,
      createdAt: newTag.createdAt,
      updatedAt: newTag.updatedAt,
    }
  }
}
