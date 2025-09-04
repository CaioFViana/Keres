import type { Gallery } from '@domain/entities/Gallery'
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { GalleryCreatePayload, GalleryResponse } from '@keres/shared'

import { ulid } from 'ulid'

export class CreateGalleryUseCase {
  constructor(
    private readonly galleryRepository: IGalleryRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, data: GalleryCreatePayload): Promise<GalleryResponse> {
    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(data.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const newGallery: Gallery = {
      id: ulid(),
      storyId: data.storyId,
      ownerId: data.ownerId,
      imagePath: data.imagePath,
      isFile: data.isFile || false,
      isFavorite: data.isFavorite || false,
      extraNotes: data.extraNotes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.galleryRepository.save(newGallery)

    return {
      id: newGallery.id,
      storyId: newGallery.storyId,
      ownerId: newGallery.ownerId,
      imagePath: newGallery.imagePath,
      isFile: newGallery.isFile,
      isFavorite: newGallery.isFavorite,
      extraNotes: newGallery.extraNotes,
      createdAt: newGallery.createdAt,
      updatedAt: newGallery.updatedAt,
    }
  }
}
