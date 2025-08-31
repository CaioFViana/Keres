import type {
  CreateGalleryUseCase,
  DeleteGalleryUseCase,
  GetGalleryByOwnerIdUseCase,
  GetGalleryByStoryIdUseCase,
  GetGalleryUseCase,
  UpdateGalleryUseCase,
} from '@application/use-cases'
import type { Context } from 'hono'

import { GalleryResponseSchema } from '@keres/shared'

export class GalleryController {
  constructor(
    private readonly createGalleryUseCase: CreateGalleryUseCase,
    private readonly getGalleryUseCase: GetGalleryUseCase,
    private readonly updateGalleryUseCase: UpdateGalleryUseCase,
    private readonly deleteGalleryUseCase: DeleteGalleryUseCase,
    private readonly getGalleryByOwnerIdUseCase: GetGalleryByOwnerIdUseCase,
    private readonly getGalleryByStoryIdUseCase: GetGalleryByStoryIdUseCase,
  ) {}

  async createGallery(c: Context) {
    const data = c.req.valid('json') // Validated by zValidator middleware

    try {
      const gallery = await this.createGalleryUseCase.execute(data)
      return c.json(GalleryResponseSchema.parse(gallery), 201)
    } catch (_error: unknown) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async getGallery(c: Context) {
    const galleryId = c.req.param('id')

    try {
      const gallery = await this.getGalleryUseCase.execute(galleryId)
      if (!gallery) {
        return c.json({ error: 'Gallery item not found' }, 404)
      }
      return c.json(GalleryResponseSchema.parse(gallery), 200)
    } catch (_error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async getGalleryByOwnerId(c: Context) {
    const ownerId = c.req.param('ownerId') // Assuming ownerId is passed as a param

    try {
      const galleryItems = await this.getGalleryByOwnerIdUseCase.execute(ownerId)
      return c.json(
        galleryItems.map((item) => GalleryResponseSchema.parse(item)),
        200,
      )
    } catch (_error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async getGalleryByStoryId(c: Context) {
    const storyId = c.req.param('storyId') // Assuming storyId is passed as a param

    try {
      const galleryItems = await this.getGalleryByStoryIdUseCase.execute(storyId)
      return c.json(
        galleryItems.map((item) => GalleryResponseSchema.parse(item)),
        200,
      )
    } catch (_error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async updateGallery(c: Context) {
    const galleryId = c.req.param('id')
    const data = c.req.valid('json') // Validated by zValidator middleware

    try {
      const updatedGallery = await this.updateGalleryUseCase.execute({ id: galleryId, ...data })
      if (!updatedGallery) {
        return c.json(
          { error: 'Gallery item not found or does not belong to the specified story/owner' },
          404,
        )
      }
      return c.json(GalleryResponseSchema.parse(updatedGallery), 200)
    } catch (_error: unknown) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async deleteGallery(c: Context) {
    const galleryId = c.req.param('id')
    const storyId = c.req.query('storyId') // Assuming storyId is passed as a query param for delete
    const ownerId = c.req.query('ownerId') // Assuming ownerId is passed as a query param for delete

    if (!storyId || !ownerId) {
      return c.json({ error: 'storyId and ownerId are required for deletion' }, 400)
    }

    try {
      const deleted = await this.deleteGalleryUseCase.execute(galleryId, storyId, ownerId)
      if (!deleted) {
        return c.json(
          { error: 'Gallery item not found or does not belong to the specified story/owner' },
          404,
        )
      }
      return c.json({}, 204)
    } catch (_error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }
}
