import { IGalleryRepository } from '@domain/repositories/IGalleryRepository';
import { GalleryUpdatePayload, GalleryResponse } from '@keres/shared';

export class UpdateGalleryUseCase {
  constructor(private readonly galleryRepository: IGalleryRepository) {}

  async execute(data: GalleryUpdatePayload): Promise<GalleryResponse | null> {
    const existingGallery = await this.galleryRepository.findById(data.id);
    if (!existingGallery) {
      return null; // Gallery item not found
    }
    // Add ownership check
    if (data.storyId && existingGallery.storyId !== data.storyId) {
      return null; // Gallery item does not belong to this story
    }
    if (data.ownerId && existingGallery.ownerId !== data.ownerId) {
      return null; // Gallery item does not belong to this owner
    }

    const updatedGallery = {
      ...existingGallery,
      ...data,
      updatedAt: new Date(),
    };

    await this.galleryRepository.update(updatedGallery);

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
    };
  }
}