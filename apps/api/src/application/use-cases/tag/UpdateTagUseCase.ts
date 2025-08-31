import type { ITagRepository } from '@domain/repositories/ITagRepository';
import type { TagResponse, UpdateTagPayload } from '@keres/shared';

export class UpdateTagUseCase {
  constructor(private readonly tagRepository: ITagRepository) {}

  async execute(data: UpdateTagPayload): Promise<TagResponse | null> {
    const existingTag = await this.tagRepository.findById(data.id);
    if (!existingTag) {
      return null; // Tag not found
    }

    const updatedTag = {
      ...existingTag,
      ...data,
      updatedAt: new Date(),
    };

    await this.tagRepository.update(updatedTag);

    return {
      id: updatedTag.id,
      storyId: updatedTag.storyId,
      name: updatedTag.name,
      color: updatedTag.color,
      isFavorite: updatedTag.isFavorite,
      extraNotes: updatedTag.extraNotes,
      createdAt: updatedTag.createdAt,
      updatedAt: updatedTag.updatedAt,
    };
  }
}