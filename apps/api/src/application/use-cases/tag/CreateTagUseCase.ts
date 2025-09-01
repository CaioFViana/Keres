import type { Tag } from '@domain/entities/Tag'
import type { ITagRepository } from '@domain/repositories/ITagRepository'
import type { CreateTagPayload, TagResponse } from '@keres/shared'

import { ulid } from 'ulid'

export class CreateTagUseCase {
  constructor(private readonly tagRepository: ITagRepository) {}

  async execute(data: CreateTagPayload): Promise<TagResponse> {
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
