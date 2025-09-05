import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository

export class DeleteGalleryUseCase {
  constructor(
    private readonly galleryRepository: IGalleryRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, id: string, storyId: string, ownerId: string): Promise<boolean> {
    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const existingGallery = await this.galleryRepository.findById(id)
    if (!existingGallery || existingGallery.storyId !== storyId) {
      throw new Error('Gallery item not found or does not belong to the specified story')
    }

    await this.galleryRepository.delete(id, storyId, ownerId)
    return true
  }
}
