import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository' // Added
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository' // Added
import type { INoteRepository } from '@domain/repositories/INoteRepository' // Added
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { GalleryResponse, GalleryUpdatePayload } from '@keres/shared'
import { getKeresGalleryPath } from '@keres/shared'

import fs from 'fs'

export class UpdateGalleryUseCase {
  constructor(
    private readonly galleryRepository: IGalleryRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
    private readonly characterRepository: ICharacterRepository, // Added
    private readonly noteRepository: INoteRepository, // Added
    private readonly locationRepository: ILocationRepository, // Added
  ) {}

  async execute(userId: string, data: GalleryUpdatePayload): Promise<GalleryResponse> {
    const existingGallery = await this.galleryRepository.findById(data.id)
    if (!existingGallery) {
      throw new Error('Gallery item not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(existingGallery.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    // Validate ownerId if provided in the update payload
    if (data.ownerId !== undefined || data.ownerType !== undefined) {
      let ownerFound = false
      const targetOwnerId = data.ownerId !== undefined ? data.ownerId : existingGallery.ownerId
      const targetOwnerType = data.ownerType !== undefined ? data.ownerType : existingGallery.ownerType

      if (targetOwnerId && targetOwnerType) {
        switch (targetOwnerType) {
          case 'character':
            const character = await this.characterRepository.findById(targetOwnerId)
            if (character && character.storyId === existingGallery.storyId) {
              ownerFound = true
            }
            break
          case 'note':
            const note = await this.noteRepository.findById(targetOwnerId)
            if (note && note.storyId === existingGallery.storyId) {
              ownerFound = true
            }
            break
          case 'location':
            const location = await this.locationRepository.findById(targetOwnerId)
            if (location && location.storyId === existingGallery.storyId) {
              ownerFound = true
            }
            break
        }

        if (!ownerFound) {
          throw new Error('Owner not found or does not belong to the specified story')
        }
      } else if (targetOwnerId && !targetOwnerType) {
        throw new Error('ownerType is required when ownerId is provided')
      }
    }

    // Ensure Gallery directory exists if isFile is true and imagePath is being updated
    if (data.isFile && data.imagePath) {
      const galleryPath = getKeresGalleryPath()
      if (!fs.existsSync(galleryPath)) {
        console.log(`Creating gallery directory: ${galleryPath}`)
        fs.mkdirSync(galleryPath, { recursive: true })
      }
    }

    // TODO: Implement file saving logic here if data.isFile is true and a new file is provided.
    // This will involve receiving the actual file data (e.g., as a Buffer) from the controller,
    // generating a unique filename, saving it to the path returned by getKeresGalleryPath(),
    // and updating data.imagePath to reflect the local file path.
    // Also handle deletion of old file if imagePath changes and old file was local.

    const updatedGallery = {
      ...existingGallery,
      ...data,
      updatedAt: new Date(),
    }

    // Ensure ownerId is always a string when passed to the repository
    const ownerIdToUpdate = data.ownerId !== undefined ? data.ownerId : existingGallery.ownerId
    await this.galleryRepository.update(updatedGallery, existingGallery.storyId, ownerIdToUpdate)

    return {
      id: updatedGallery.id,
      storyId: updatedGallery.storyId,
      ownerId: updatedGallery.ownerId,
      ownerType: updatedGallery.ownerType,
      imagePath: updatedGallery.imagePath,
      isFile: updatedGallery.isFile,
      isFavorite: updatedGallery.isFavorite,
      extraNotes: updatedGallery.extraNotes,
      createdAt: updatedGallery.createdAt,
      updatedAt: updatedGallery.updatedAt,
    }
  }
}
