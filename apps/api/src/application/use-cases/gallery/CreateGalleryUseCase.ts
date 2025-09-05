import type { Gallery } from '@domain/entities/Gallery'
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository' // Added
import type { INoteRepository } from '@domain/repositories/INoteRepository' // Added
import type { ILocationRepository } from '@domain/repositories/ILocationRepository' // Added
import type { GalleryCreatePayload, GalleryResponse } from '@keres/shared'

import { ulid } from 'ulid'

export class CreateGalleryUseCase {
  constructor(
    private readonly galleryRepository: IGalleryRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
    private readonly characterRepository: ICharacterRepository, // Added
    private readonly noteRepository: INoteRepository, // Added
    private readonly locationRepository: ILocationRepository, // Added
  ) {}

  async execute(userId: string, data: GalleryCreatePayload): Promise<GalleryResponse> {
    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(data.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    // Validate ownerId if provided
    let ownerIdToUse: string | null = null
    if (data.ownerId) {
      let ownerFound = false

      // Check in Characters
      const character = await this.characterRepository.findById(data.ownerId)
      if (character && character.storyId === data.storyId) {
        ownerFound = true
        ownerIdToUse = data.ownerId
      }

      // Check in Notes (only if not found in Characters)
      if (!ownerFound) {
        const note = await this.noteRepository.findById(data.ownerId)
        if (note && note.storyId === data.storyId) {
          ownerFound = true
          ownerIdToUse = data.ownerId
        }
      }

      // Check in Locations (only if not found in Notes)
      if (!ownerFound) {
        const location = await this.locationRepository.findById(data.ownerId)
        if (location && location.storyId === data.storyId) {
          ownerFound = true
          ownerIdToUse = data.ownerId
        }
      }

      if (!ownerFound) {
        throw new Error('Owner not found or does not belong to the specified story')
      }
    }

    const newGallery: Gallery = {
      id: ulid(),
      storyId: data.storyId,
      ownerId: ownerIdToUse,
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
