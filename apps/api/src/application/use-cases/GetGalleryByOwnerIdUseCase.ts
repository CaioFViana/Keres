import { GalleryProfileDTO } from '@application/dtos/GalleryDTOs';
import { IGalleryRepository } from '@domain/repositories/IGalleryRepository';

export class GetGalleryByOwnerIdUseCase {
  constructor(private readonly galleryRepository: IGalleryRepository) {}

  async execute(ownerId: string): Promise<GalleryProfileDTO[]> {
    const galleryItems = await this.galleryRepository.findByOwnerId(ownerId);
    return galleryItems.map(item => ({
      id: item.id,
      storyId: item.storyId,
      ownerId: item.ownerId,
      imagePath: item.imagePath,
      isFile: item.isFile,
      isFavorite: item.isFavorite,
      extraNotes: item.extraNotes,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }
}
