import type { Gallery } from '@domain/entities/Gallery'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository' // Added
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository' // Added
import type { INoteRepository } from '@domain/repositories/INoteRepository' // Added
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { GalleryCreatePayload, GalleryResponse } from '@keres/shared'
import fs from 'node:fs/promises' // Use fs.promises for async operations

import { getKeresGalleryPath } from '@keres/shared'
import { ulid } from 'ulid'

export class CreateGalleryUseCase {
  constructor(
    private readonly galleryRepository: IGalleryRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
    private readonly characterRepository: ICharacterRepository, // Added
    private readonly noteRepository: INoteRepository, // Added
    private readonly locationRepository: ILocationRepository, // Added
  ) {}

  async execute(
    userId: string,
    data: GalleryCreatePayload,
    fileBuffer: Buffer,
  ): Promise<GalleryResponse> {
    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(data.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    // Validate ownerId based on ownerType
    let ownerFound = false
    if (data.ownerId && data.ownerType) {
      switch (data.ownerType) {
        case 'character': {
          const character = await this.characterRepository.findById(data.ownerId)
          if (character && character.storyId === data.storyId) {
            ownerFound = true
          }
          break
        }
        case 'note': {
          const note = await this.noteRepository.findById(data.ownerId)
          if (note && note.storyId === data.storyId) {
            ownerFound = true
          }
          break
        }
        case 'location': {
          const location = await this.locationRepository.findById(data.ownerId)
          if (location && location.storyId === data.storyId) {
            ownerFound = true
          }
          break
        }
      }

      if (!ownerFound) {
        throw new Error('Owner not found or does not belong to the specified story')
      }
    } else if (data.ownerId && !data.ownerType) {
      throw new Error('ownerType is required when ownerId is provided')
    }

    let finalImagePath = data.imagePath // Default to the provided imagePath

    // Handle file saving if isFile is true
    if (data.isFile) {
      if (!fileBuffer) {
        throw new Error('File content is required when isFile is true')
      }

      const galleryPath = getKeresGalleryPath()
      // Ensure Gallery directory exists
      await fs.mkdir(galleryPath, { recursive: true })

      const originalExtension = data.imagePath ? data.imagePath.split('.').pop() : ''
      // Sanitize the extension to only allow alphanumeric characters
      const sanitizedExtension = originalExtension
        ? originalExtension.replace(/[^a-zA-Z0-9]/g, '')
        : ''
      const fileExtension = sanitizedExtension ? `.${sanitizedExtension}` : ''
      const uniqueFilename = `${ulid()}${fileExtension}`
      const fullFilePath = `${galleryPath}/${uniqueFilename}`

      await fs.writeFile(fullFilePath, fileBuffer)
      finalImagePath = uniqueFilename // Update imagePath to the unique filename
    }

    const newGallery: Gallery = {
      id: ulid(),
      storyId: data.storyId,
      ownerId: data.ownerId,
      ownerType: data.ownerType,
      imagePath: finalImagePath,
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
