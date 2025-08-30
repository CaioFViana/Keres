import { IGalleryRepository } from '@domain/repositories/IGalleryRepository';

export class DeleteGalleryUseCase {
  constructor(private readonly galleryRepository: IGalleryRepository) {}

  async execute(galleryId: string, storyId: string): Promise<boolean> {
    const existingGallery = await this.galleryRepository.findById(galleryId);
    if (!existingGallery || existingGallery.storyId !== storyId) {
      // Gallery item not found or does not belong to the specified story
      return false;
    }

    await this.galleryRepository.delete(galleryId);
    return true;
  }
}
