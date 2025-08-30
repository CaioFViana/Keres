import { IStoryRepository } from '@domain/repositories/IStoryRepository';

export class DeleteStoryUseCase {
  constructor(private readonly storyRepository: IStoryRepository) {}

  async execute(id: string, userId: string): Promise<boolean> {
    const existingStory = await this.storyRepository.findById(id);
    if (!existingStory) {
      return false; // Story not found
    }
    if (existingStory.userId !== userId) { // Check ownership
      return false; // Story does not belong to this user
    }
    await this.storyRepository.delete(id);
    return true;
  }
}