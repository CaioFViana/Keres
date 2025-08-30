import { GalleryProfileDTO } from '@application/dtos/GalleryDTOs';
import { IGalleryRepository } from '@domain/repositories/IGalleryRepository';

export class GetGalleryUseCase {
  constructor(private readonly galleryRepository: IGalleryRepository) {}

  async execute(galleryId: string): Promise<GalleryProfileDTO | null> {
    const gallery = await this.galleryRepository.findById(galleryId);
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
