import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { INoteRepository } from '@domain/repositories/INoteRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

export class DeleteGalleryUseCase {
  constructor(
    private readonly galleryRepository: IGalleryRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly noteRepository: INoteRepository,
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

    const notes = await this.noteRepository.findByGalleryId(id)
    if (notes && notes.length > 0) {
      throw new Error('Gallery item cannot be deleted because it is referenced by notes.')
    }

    await this.galleryRepository.delete(id, storyId, ownerId)
    return true
  }
}
