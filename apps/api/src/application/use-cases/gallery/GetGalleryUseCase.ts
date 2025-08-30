import { IGalleryRepository } from '@domain/repositories/IGalleryRepository';
import { GalleryResponse } from '@keres/shared';

export class GetGalleryUseCase {
  constructor(private readonly galleryRepository: IGalleryRepository) {}

  async execute(id: string): Promise<GalleryResponse | null> {
    const gallery = await this.galleryRepository.findById(id);
    if (!gallery) {
      return null;
    }

    return {
      id: gallery.id,
      storyId: gallery.storyId,
      ownerId: gallery.ownerId,
      imagePath: gallery.imagePath,
      isFile: gallery.isFile,
      isFavorite: gallery.isFavorite,
      extraNotes: gallery.extraNotes,
      createdAt: gallery.createdAt,
      updatedAt: gallery.updatedAt,
    };
  }
}