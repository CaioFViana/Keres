import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

export class DeleteStoryUseCase {
  constructor(private readonly storyRepository: IStoryRepository) {}

  async execute(userId: string, id: string): Promise<boolean> {
    const existingStory = await this.storyRepository.findById(id, userId)
    if (!existingStory || existingStory.userId !== userId) {
      return false // Story not found or does not belong to this user
    }
    await this.storyRepository.delete(id, userId)
    return true
  }
}
