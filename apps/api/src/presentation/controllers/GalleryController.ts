import type {
  BulkDeleteGalleryUseCase,
  CreateGalleryUseCase,
  DeleteGalleryUseCase,
  GetGalleryByOwnerIdUseCase,
  GetGalleryByStoryIdUseCase,
  GetGalleryUseCase,
  UpdateGalleryUseCase,
} from '@application/use-cases'
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type z from 'zod'
import fs from 'node:fs/promises'
import path from 'node:path'

import {
  type GalleryCreateSchema,
  GalleryResponseSchema,
  type GalleryUpdateSchema,
  getKeresGalleryPath,
  type ListQueryParams,
} from '@keres/shared'

export class GalleryController {
  constructor(
    private readonly createGalleryUseCase: CreateGalleryUseCase,
    private readonly getGalleryUseCase: GetGalleryUseCase,
    private readonly updateGalleryUseCase: UpdateGalleryUseCase,
    private readonly deleteGalleryUseCase: DeleteGalleryUseCase,
    private readonly bulkDeleteGalleryUseCase: BulkDeleteGalleryUseCase,
    private readonly getGalleryByOwnerIdUseCase: GetGalleryByOwnerIdUseCase,
    private readonly getGalleryByStoryIdUseCase: GetGalleryByStoryIdUseCase,
    private readonly galleryRepository: IGalleryRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async createGallery(
    userId: string,
    data: z.infer<typeof GalleryCreateSchema>,
    fileBuffer: Buffer,
  ) {
    const gallery = await this.createGalleryUseCase.execute(userId, data, fileBuffer)
    return GalleryResponseSchema.parse(gallery)
  }

  async getGallery(userId: string, id: string) {
    const gallery = await this.getGalleryUseCase.execute(userId, id)
    if (!gallery) {
      throw new Error('Gallery item not found')
    }
    return GalleryResponseSchema.parse(gallery)
  }

  async getGalleryByOwnerId(userId: string, ownerId: string, query: ListQueryParams) {
    const galleryItems = await this.getGalleryByOwnerIdUseCase.execute(userId, ownerId, query)
    return galleryItems.map((item) => GalleryResponseSchema.parse(item))
  }

  async getGalleryByStoryId(userId: string, storyId: string, query: ListQueryParams) {
    const galleryItems = await this.getGalleryByStoryIdUseCase.execute(userId, storyId, query)
    return galleryItems.map((item) => GalleryResponseSchema.parse(item))
  }

  async updateGallery(
    userId: string,
    id: string,
    data: z.infer<typeof GalleryUpdateSchema>,
    fileBuffer?: Buffer,
  ) {
    const { id: dataId, ...updateData } = data
    const updatedGallery = await this.updateGalleryUseCase.execute(
      userId,
      { id, ...updateData },
      fileBuffer,
    )
    if (!updatedGallery) {
      throw new Error('Gallery item not found or does not belong to the specified story/owner')
    }
    return GalleryResponseSchema.parse(updatedGallery)
  }

  async deleteGallery(userId: string, id: string, storyId: string, ownerId: string) {
    if (!storyId || !ownerId) {
      throw new Error('storyId and ownerId are required for deletion')
    }
    const deleted = await this.deleteGalleryUseCase.execute(userId, id, storyId, ownerId)
    if (!deleted) {
      throw new Error('Gallery item not found or does not belong to the specified story/owner')
    }
    return
  }

  async bulkDeleteGallery(userId: string, ids: string[]) {
    const result = await this.bulkDeleteGalleryUseCase.execute(userId, ids)
    return result
  }

  async getGalleryImage(userId: string, galleryId: string) {
    // Find the gallery item by ID
    const galleryItem = await this.galleryRepository.findById(galleryId)
    if (!galleryItem) {
      throw new Error('Gallery item not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(galleryItem.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const galleryPath = getKeresGalleryPath()
    const imageFilePath = path.join(galleryPath, galleryItem.imagePath)

    try {
      const fileContent = await fs.readFile(imageFilePath)
      const ext = path.extname(galleryItem.imagePath).toLowerCase()
      let contentType = 'application/octet-stream' // Default to binary

      switch (ext) {
        case '.jpg':
        case '.jpeg':
          contentType = 'image/jpeg'
          break
        case '.png':
          contentType = 'image/png'
          break
        case '.gif':
          contentType = 'image/gif'
          break
        case '.webp':
          contentType = 'image/webp'
          break
        case '.svg':
          contentType = 'image/svg+xml'
          break
        case '.bmp':
          contentType = 'image/bmp'
          break
        // Add more image types as needed
      }

      return { fileContent, contentType }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('Image file not found on disk')
      }
      throw new Error(`Failed to read image: ${(error as Error).message}`)
    }
  }
}
