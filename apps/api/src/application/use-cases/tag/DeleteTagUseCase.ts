import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { ITagRepository } from '@domain/repositories/ITagRepository'

export class DeleteTagUseCase {
  constructor(
    private readonly tagRepository: ITagRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, id: string): Promise<boolean> {
    const existingTag = await this.tagRepository.findById(id)
    if (!existingTag) {
      throw new Error('Tag not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(existingTag.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    await this.tagRepository.delete(id, existingTag.storyId)
    return true
  }
}
