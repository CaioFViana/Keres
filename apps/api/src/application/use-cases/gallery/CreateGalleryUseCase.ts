import type { Gallery } from '@domain/entities/Gallery'
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { GalleryCreatePayload, GalleryResponse } from '@keres/shared'

import { ulid } from 'ulid'

export class CreateGalleryUseCase {
  constructor(private readonly galleryRepository: IGalleryRepository) {}

  async execute(data: GalleryCreatePayload): Promise<GalleryResponse> {
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
