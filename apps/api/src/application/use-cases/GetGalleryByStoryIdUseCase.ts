import { GalleryProfileDTO } from '@application/dtos/GalleryDTOs';
import { IGalleryRepository } from '@domain/repositories/IGalleryRepository';

export class GetGalleryByStoryIdUseCase {
  constructor(private readonly galleryRepository: IGalleryRepository) {}

  async execute(storyId: string): Promise<GalleryProfileDTO[]> {
    const galleryItems = await this.galleryRepository.findByStoryId(storyId);
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
