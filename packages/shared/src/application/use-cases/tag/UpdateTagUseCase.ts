import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { ITagRepository } from '@domain/repositories/ITagRepository'
import type { TagResponse, UpdateTagPayload } from 'schemas'

export class UpdateTagUseCase {
  constructor(
    private readonly tagRepository: ITagRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, data: UpdateTagPayload): Promise<TagResponse> {
    const existingTag = await this.tagRepository.findById(data.id)
    if (!existingTag) {
      throw new Error('Tag not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(existingTag.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const updatedTag = {
      ...existingTag,
      ...data,
      updatedAt: new Date(),
    }

    await this.tagRepository.update(updatedTag, existingTag.storyId)

    return {
      id: updatedTag.id,
      storyId: updatedTag.storyId,
      name: updatedTag.name,
      color: updatedTag.color,
      isFavorite: updatedTag.isFavorite,
      extraNotes: updatedTag.extraNotes,
      createdAt: updatedTag.createdAt,
      updatedAt: updatedTag.updatedAt,
    }
  }
}
