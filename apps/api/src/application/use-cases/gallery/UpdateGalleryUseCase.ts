import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { GalleryResponse, GalleryUpdatePayload } from '@keres/shared'

export class UpdateGalleryUseCase {
  constructor(
    private readonly galleryRepository: IGalleryRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, data: GalleryUpdatePayload): Promise<GalleryResponse> {
    const existingGallery = await this.galleryRepository.findById(data.id)
    if (!existingGallery) {
      throw new Error('Gallery item not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(existingGallery.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const updatedGallery = {
      ...existingGallery,
      ...data,
      updatedAt: new Date(),
    }

    await this.galleryRepository.update(updatedGallery, existingGallery.storyId, existingGallery.ownerId)

    return {
      id: updatedGallery.id,
      storyId: updatedGallery.storyId,
      ownerId: updatedGallery.ownerId,
      imagePath: updatedGallery.imagePath,
      isFile: updatedGallery.isFile,
      isFavorite: updatedGallery.isFavorite,
      extraNotes: updatedGallery.extraNotes,
      createdAt: updatedGallery.createdAt,
      updatedAt: updatedGallery.updatedAt,
    }
  }
}
