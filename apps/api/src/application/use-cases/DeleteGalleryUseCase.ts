import { IGalleryRepository } from '@domain/repositories/IGalleryRepository';

export class DeleteGalleryUseCase {
  constructor(private readonly galleryRepository: IGalleryRepository) {}

  async execute(id: string, storyId: string, ownerId: string): Promise<boolean> {
    const existingGallery = await this.galleryRepository.findById(id);
    if (!existingGallery) {
      return false; // Gallery item not found
    }
    if (existingGallery.storyId !== storyId) { // Check story ownership
      return false; // Gallery item does not belong to this story
    }
    if (existingGallery.ownerId !== ownerId) { // Check owner ownership
      return false; // Gallery item does not belong to this owner
    }
    await this.galleryRepository.delete(id);
    return true;
  }
}