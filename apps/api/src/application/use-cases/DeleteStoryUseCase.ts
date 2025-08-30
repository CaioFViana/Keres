export class DeleteStoryUseCase {
  constructor(private readonly storyRepository: IStoryRepository) {}

  async execute(storyId: string, userId: string): Promise<boolean> {
    const existingStory = await this.storyRepository.findById(storyId);
    if (!existingStory || existingStory.userId !== userId) {
      // Story not found or user does not own the story
      return false;
    }

    await this.storyRepository.delete(storyId);
    return true;
  }
}
