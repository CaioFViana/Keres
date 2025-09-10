import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { StoryResponse, StoryUpdatePayload } from '@keres/shared'

export class UpdateStoryUseCase {
  constructor(private readonly storyRepository: IStoryRepository) {}

  async execute(userId: string, id: string, data: Omit<StoryUpdatePayload, 'id'>): Promise<StoryResponse | null> {
    const existingStory = await this.storyRepository.findById(id, userId)
    if (!existingStory) {
      return null // Story not found
    }
    // Add ownership check
    if (existingStory.userId !== userId) {
      return null // Story does not belong to this user
    }

    if (data.type && existingStory.type === 'branching' && data.type === 'linear') {
      throw new Error('Cannot change story type from branching to linear.')
    }

    const updatedStory = {
      ...existingStory,
      ...data,
      id: id, // Ensure ID is set from the URL parameter
      updatedAt: new Date(),
    }
    await this.storyRepository.update(updatedStory, userId)

    return {
      id: updatedStory.id,
      userId: updatedStory.userId,
      type: updatedStory.type, // Added type field
      title: updatedStory.title,
      summary: updatedStory.summary,
      genre: updatedStory.genre,
      language: updatedStory.language,
      isFavorite: updatedStory.isFavorite,
      extraNotes: updatedStory.extraNotes,
      createdAt: updatedStory.createdAt,
      updatedAt: updatedStory.updatedAt,
    }
  }
}
