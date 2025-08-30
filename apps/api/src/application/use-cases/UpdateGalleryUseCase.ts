import { UpdateGalleryDTO, GalleryProfileDTO } from '@application/dtos/GalleryDTOs';
import { IGalleryRepository } from '@domain/repositories/IGalleryRepository';

export class UpdateGalleryUseCase {
  constructor(private readonly galleryRepository: IGalleryRepository) {}

  async execute(data: UpdateGalleryDTO): Promise<GalleryProfileDTO | null> {
    const existingGallery = await this.galleryRepository.findById(data.id);
    if (!existingGallery || existingGallery.storyId !== data.storyId) {
      // Gallery item not found or does not belong to the specified story
      return null;
    }

    const updatedGallery = {
      ...existingGallery,
      ownerId: data.ownerId ?? existingGallery.ownerId,
      imagePath: data.imagePath ?? existingGallery.imagePath,
      isFile: data.isFile ?? existingGallery.isFile,
      isFavorite: data.isFavorite ?? existingGallery.isFavorite,
      extraNotes: data.extraNotes ?? existingGallery.extraNotes,
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
