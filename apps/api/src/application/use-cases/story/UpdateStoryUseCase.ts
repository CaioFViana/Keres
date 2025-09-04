import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { StoryResponse, StoryUpdatePayload } from '@keres/shared'

export class UpdateStoryUseCase {
  constructor(private readonly storyRepository: IStoryRepository) {}

  async execute(userId: string, data: StoryUpdatePayload): Promise<StoryResponse | null> {
    const existingStory = await this.storyRepository.findById(data.id, userId)
    if (!existingStory) {
      return null // Story not found
    }
    // Add ownership check
    if (existingStory.userId !== userId) {
      return null // Story does not belong to this user
    }

    const updatedStory = {
      ...existingStory,
      ...data,
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
