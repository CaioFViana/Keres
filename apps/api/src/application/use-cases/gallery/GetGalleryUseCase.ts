import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { GalleryResponse } from '@keres/shared'

export class GetGalleryUseCase {
  constructor(
    private readonly galleryRepository: IGalleryRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, id: string): Promise<GalleryResponse> {
    const gallery = await this.galleryRepository.findById(id)
    if (!gallery) {
      throw new Error('Gallery item not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(gallery.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    return {
      id: gallery.id,
      storyId: gallery.storyId,
      ownerId: gallery.ownerId,
      ownerType: gallery.ownerType,
      imagePath: gallery.imagePath,
      isFile: gallery.isFile,
      isFavorite: gallery.isFavorite,
      extraNotes: gallery.extraNotes,
      createdAt: gallery.createdAt,
      updatedAt: gallery.updatedAt,
    }
  }
}
