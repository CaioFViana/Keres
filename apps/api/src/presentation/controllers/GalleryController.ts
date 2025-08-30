import { Context } from 'hono';
import {
  CreateGalleryUseCase,
  GetGalleryUseCase,
  GetGalleryByStoryIdUseCase,
  GetGalleryByOwnerIdUseCase,
  UpdateGalleryUseCase,
  DeleteGalleryUseCase,
} from '@application/use-cases';
import { createGallerySchema, updateGallerySchema, galleryProfileSchema } from '@presentation/schemas/GallerySchemas';

export class GalleryController {
  constructor(
    private readonly createGalleryUseCase: CreateGalleryUseCase,
    private readonly getGalleryUseCase: GetGalleryUseCase,
    private readonly getGalleryByStoryIdUseCase: GetGalleryByStoryIdUseCase,
    private readonly getGalleryByOwnerIdUseCase: GetGalleryByOwnerIdUseCase,
    private readonly updateGalleryUseCase: UpdateGalleryUseCase,
    private readonly deleteGalleryUseCase: DeleteGalleryUseCase
  ) {}

  async createGallery(c: Context) {
    const body = await c.req.json();
    const validation = createGallerySchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const galleryProfile = await this.createGalleryUseCase.execute(validation.data);
      return c.json(galleryProfileSchema.parse(galleryProfile), 201);
    } catch (error: any) {
      console.error('Error creating gallery item:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getGallery(c: Context) {
    const galleryId = c.req.param('id');

    try {
      const galleryProfile = await this.getGalleryUseCase.execute(galleryId);
      if (!galleryProfile) {
        return c.json({ error: 'Gallery item not found' }, 404);
      }
      return c.json(galleryProfileSchema.parse(galleryProfile), 200);
    } catch (error: any) {
      console.error('Error getting gallery item:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getGalleryByStoryId(c: Context) {
    const storyId = c.req.param('storyId');

    try {
      const galleryItems = await this.getGalleryByStoryIdUseCase.execute(storyId);
      return c.json(galleryItems.map(item => galleryProfileSchema.parse(item)), 200);
    } catch (error: any) {
      console.error('Error getting gallery items by story ID:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getGalleryByOwnerId(c: Context) {
    const ownerId = c.req.param('ownerId');

    try {
      const galleryItems = await this.getGalleryByOwnerIdUseCase.execute(ownerId);
      return c.json(galleryItems.map(item => galleryProfileSchema.parse(item)), 200);
    } catch (error: any) {
      console.error('Error getting gallery items by owner ID:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async updateGallery(c: Context) {
    const galleryId = c.req.param('id');
    const body = await c.req.json();
    const validation = updateGallerySchema.safeParse({ id: galleryId, ...body });

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const updatedGallery = await this.updateGalleryUseCase.execute(validation.data);
      if (!updatedGallery) {
        return c.json({ error: 'Gallery item not found or unauthorized' }, 404);
      }
      return c.json(galleryProfileSchema.parse(updatedGallery), 200);
    } catch (error: any) {
      console.error('Error updating gallery item:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async deleteGallery(c: Context) {
    const galleryId = c.req.param('id');
    // Assuming storyId comes from the request body or a header for authorization
    const storyId = c.req.header('x-story-id'); // For testing purposes

    if (!storyId) {
      return c.json({ error: 'Unauthorized: Missing story ID' }, 401);
    }

    try {
      const deleted = await this.deleteGalleryUseCase.execute(galleryId, storyId);
      if (!deleted) {
        return c.json({ error: 'Gallery item not found or unauthorized' }, 404);
      }
      return c.json({ message: 'Gallery item deleted successfully' }, 200);
    } catch (error: any) {
      console.error('Error deleting gallery item:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }
}
