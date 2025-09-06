import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository' // Added
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository' // Added
import type { INoteRepository } from '@domain/repositories/INoteRepository' // Added
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { GalleryResponse, GalleryUpdatePayload } from '@keres/shared'

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
    if (data.ownerId !== undefined) {
      // Check if ownerId is explicitly provided in the payload
      let ownerFound = false

      // Check in Characters
      const character = await this.characterRepository.findById(data.ownerId)
      if (character && character.storyId === existingGallery.storyId) {
        ownerFound = true
      }

      // Check in Notes (only if not found in Characters)
      if (!ownerFound) {
        const note = await this.noteRepository.findById(data.ownerId)
        if (note && note.storyId === existingGallery.storyId) {
          ownerFound = true
        }
      }

      // Check in Locations (only if not found in Notes)
      if (!ownerFound) {
        const location = await this.locationRepository.findById(data.ownerId)
        if (location && location.storyId === existingGallery.storyId) {
          ownerFound = true
        }
      }

      if (!ownerFound) {
        throw new Error('Owner not found or does not belong to the specified story')
      }
    }

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
      imagePath: updatedGallery.imagePath,
      isFile: updatedGallery.isFile,
      isFavorite: updatedGallery.isFavorite,
      extraNotes: updatedGallery.extraNotes,
      createdAt: updatedGallery.createdAt,
      updatedAt: updatedGallery.updatedAt,
    }
  }
}
