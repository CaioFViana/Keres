import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository' // Added
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository' // Added
import type { INoteRepository } from '@domain/repositories/INoteRepository' // Added
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { GalleryResponse, GalleryUpdatePayload } from '@keres/shared'
import fs from 'node:fs/promises'

import { getKeresGalleryPath } from '@keres/shared'
import { ulid } from 'ulid'

export class UpdateGalleryUseCase {
  constructor(
    private readonly galleryRepository: IGalleryRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
    private readonly characterRepository: ICharacterRepository, // Added
    private readonly noteRepository: INoteRepository, // Added
    private readonly locationRepository: ILocationRepository, // Added
  ) {}

  async execute(userId: string, data: GalleryUpdatePayload, fileBuffer?: Buffer): Promise<GalleryResponse> {
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
      const targetOwnerType =
        data.ownerType !== undefined ? data.ownerType : existingGallery.ownerType

      if (targetOwnerId && targetOwnerType) {
        switch (targetOwnerType) {
          case 'character': {
            const character = await this.characterRepository.findById(targetOwnerId)
            if (character && character.storyId === existingGallery.storyId) {
              ownerFound = true
            }
            break
          }
          case 'note': {
            const note = await this.noteRepository.findById(targetOwnerId)
            if (note && note.storyId === existingGallery.storyId) {
              ownerFound = true
            }
            break
          }
          case 'location': {
            const location = await this.locationRepository.findById(targetOwnerId)
            if (location && location.storyId === existingGallery.storyId) {
              ownerFound = true
            }
            break
          }
        }

        if (!ownerFound) {
          throw new Error('Owner not found or does not belong to the specified story')
        }
      } else if (targetOwnerId && !targetOwnerType) {
        throw new Error('ownerType is required when ownerId is provided')
      }
    }

    let finalImagePath = existingGallery.imagePath // Start with existing imagePath
    let finalIsFile = existingGallery.isFile // Start with existing isFile

    // Handle file saving/deletion if imagePath or file changes
    if (data.imagePath !== undefined || fileBuffer !== undefined) {
      const galleryPath = getKeresGalleryPath()
      await fs.mkdir(galleryPath, { recursive: true }) // Ensure directory exists

      // Case 1: New file provided (implies isFile is true)
      if (fileBuffer) {
        // Delete old file if it was a local file
        if (existingGallery.isFile) {
          const oldFilePath = `${galleryPath}/${existingGallery.imagePath}`
          try {
            await fs.unlink(oldFilePath)
          } catch (error) {
            console.warn(`Could not delete old file ${oldFilePath}:`, error)
          }
        }

        const originalExtension = data.imagePath ? data.imagePath.split('.').pop() : ''
        const sanitizedExtension = originalExtension
          ? originalExtension.replace(/[^a-zA-Z0-9]/g, '')
          : ''
        const fileExtension = sanitizedExtension ? `.${sanitizedExtension}` : ''
        const uniqueFilename = `${ulid()}${fileExtension}`
        const fullFilePath = `${galleryPath}/${uniqueFilename}`

        await fs.writeFile(fullFilePath, fileBuffer)
        finalImagePath = uniqueFilename
        finalIsFile = true
      } else if (data.imagePath !== undefined && data.imagePath !== existingGallery.imagePath) {
        // Case 2: imagePath changed, but no new file provided (implies it's a URL)
        // Delete old file if it was a local file
        if (existingGallery.isFile) {
          const oldFilePath = `${galleryPath}/${existingGallery.imagePath}`
          try {
            await fs.unlink(oldFilePath)
          } catch (error) {
            console.warn(`Could not delete old file ${oldFilePath}:`, error)
          }
        }
        finalImagePath = data.imagePath // New imagePath is a URL
        finalIsFile = false
      }
    }

    const updatedGallery = {
      ...existingGallery,
      ...data,
      imagePath: finalImagePath,
      isFile: finalIsFile,
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
