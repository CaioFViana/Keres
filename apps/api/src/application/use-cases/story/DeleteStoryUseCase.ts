import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

export class DeleteStoryUseCase {
  constructor(private readonly storyRepository: IStoryRepository) {}

  async execute(id: string): Promise<boolean> {
    const existingStory = await this.storyRepository.findById(id)
    if (!existingStory) {
      return false // Story not found
    }
    await this.storyRepository.delete(id)
    return true
  }
}
