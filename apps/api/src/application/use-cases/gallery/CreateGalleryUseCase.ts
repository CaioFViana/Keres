import type { Gallery } from '@domain/entities/Gallery'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository' // Added
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository' // Added
import type { INoteRepository } from '@domain/repositories/INoteRepository' // Added
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { GalleryCreatePayload, GalleryResponse } from '@keres/shared'
import { getKeresGalleryPath } from '@keres/shared'

import { ulid } from 'ulid'
import fs from 'fs'

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

    // Validate ownerId based on ownerType
    let ownerFound = false
    if (data.ownerId && data.ownerType) {
      switch (data.ownerType) {
        case 'character':
          const character = await this.characterRepository.findById(data.ownerId)
          if (character && character.storyId === data.storyId) {
            ownerFound = true
          }
          break
        case 'note':
          const note = await this.noteRepository.findById(data.ownerId)
          if (note && note.storyId === data.storyId) {
            ownerFound = true
          }
          break
        case 'location':
          const location = await this.locationRepository.findById(data.ownerId)
          if (location && location.storyId === data.storyId) {
            ownerFound = true
          }
          break
      }

      if (!ownerFound) {
        throw new Error('Owner not found or does not belong to the specified story')
      }
    } else if (data.ownerId && !data.ownerType) {
      throw new Error('ownerType is required when ownerId is provided')
    }

    // Ensure Gallery directory exists if isFile is true
    if (data.isFile) {
      const galleryPath = getKeresGalleryPath()
      if (!fs.existsSync(galleryPath)) {
        console.log(`Creating gallery directory: ${galleryPath}`)
        fs.mkdirSync(galleryPath, { recursive: true })
      }
    }

    // TODO: Implement file saving logic here if data.isFile is true.
    // This will involve receiving the actual file data (e.g., as a Buffer) from the controller,
    // generating a unique filename, saving it to the path returned by getKeresGalleryPath(),
    // and updating data.imagePath to reflect the local file path.

    const newGallery: Gallery = {
      id: ulid(),
      storyId: data.storyId,
      ownerId: data.ownerId,
      ownerType: data.ownerType || null,
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
      ownerType: newGallery.ownerType,
      imagePath: newGallery.imagePath,
      isFile: newGallery.isFile,
      isFavorite: newGallery.isFavorite,
      extraNotes: newGallery.extraNotes,
      createdAt: newGallery.createdAt,
      updatedAt: newGallery.updatedAt,
    }
  }
}
