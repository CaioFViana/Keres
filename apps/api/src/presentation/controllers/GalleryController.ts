import type {
  CreateGalleryUseCase,
  DeleteGalleryUseCase,
  GetGalleryByOwnerIdUseCase,
  GetGalleryByStoryIdUseCase,
  GetGalleryUseCase,
  UpdateGalleryUseCase,
} from '@application/use-cases'

import { GalleryCreateSchema, GalleryResponseSchema, GalleryUpdateSchema } from '@keres/shared'
import z from 'zod'

export class GalleryController {
  constructor(
    private readonly createGalleryUseCase: CreateGalleryUseCase,
    private readonly getGalleryUseCase: GetGalleryUseCase,
    private readonly updateGalleryUseCase: UpdateGalleryUseCase,
    private readonly deleteGalleryUseCase: DeleteGalleryUseCase,
    private readonly getGalleryByOwnerIdUseCase: GetGalleryByOwnerIdUseCase,
    private readonly getGalleryByStoryIdUseCase: GetGalleryByStoryIdUseCase,
  ) {}

  async createGallery(data: z.infer<typeof GalleryCreateSchema>) {
    const gallery = await this.createGalleryUseCase.execute(data)
    return GalleryResponseSchema.parse(gallery)
  }

  async getGallery(id: string) {
    const gallery = await this.getGalleryUseCase.execute(id)
    if (!gallery) {
      throw new Error('Gallery item not found')
    }
    return GalleryResponseSchema.parse(gallery)
  }

  async getGalleryByOwnerId(ownerId: string) {
    const galleryItems = await this.getGalleryByOwnerIdUseCase.execute(ownerId)
    return galleryItems.map((item) => GalleryResponseSchema.parse(item))
  }

  async getGalleryByStoryId(storyId: string) {
    const galleryItems = await this.getGalleryByStoryIdUseCase.execute(storyId)
    return galleryItems.map((item) => GalleryResponseSchema.parse(item))
  }

  async updateGallery(id: string, data: z.infer<typeof GalleryUpdateSchema>) {
    const updatedGallery = await this.updateGalleryUseCase.execute({ id, ...data })
    if (!updatedGallery) {
      throw new Error('Gallery item not found or does not belong to the specified story/owner')
    }
    return GalleryResponseSchema.parse(updatedGallery)
  }

  async deleteGallery(id: string, storyId: string, ownerId: string) {
    if (!storyId || !ownerId) {
      throw new Error('storyId and ownerId are required for deletion')
    }
    const deleted = await this.deleteGalleryUseCase.execute(id, storyId, ownerId)
    if (!deleted) {
      throw new Error('Gallery item not found or does not belong to the specified story/owner')
    }
    return
  }
}
