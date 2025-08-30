import { Context } from 'hono';
import {
  CreateStoryUseCase,
  GetStoryUseCase,
  GetStoriesByUserIdUseCase,
  UpdateStoryUseCase,
  DeleteStoryUseCase,
} from '@application/use-cases';
import { createStorySchema, updateStorySchema, storyProfileSchema } from '@presentation/schemas/StorySchemas';

export class StoryController {
  constructor(
    private readonly createStoryUseCase: CreateStoryUseCase,
    private readonly getStoryUseCase: GetStoryUseCase,
    private readonly getStoriesByUserIdUseCase: GetStoriesByUserIdUseCase,
    private readonly updateStoryUseCase: UpdateStoryUseCase,
    private readonly deleteStoryUseCase: DeleteStoryUseCase
  ) {}

  async createStory(c: Context) {
    const body = await c.req.json();
    const validation = createStorySchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const storyProfile = await this.createStoryUseCase.execute(validation.data);
      return c.json(storyProfileSchema.parse(storyProfile), 201);
    } catch (error: any) {
      console.error('Error creating story:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getStory(c: Context) {
    const storyId = c.req.param('id');

    try {
      const storyProfile = await this.getStoryUseCase.execute(storyId);
      if (!storyProfile) {
        return c.json({ error: 'Story not found' }, 404);
      }
      return c.json(storyProfileSchema.parse(storyProfile), 200);
    } catch (error: any) {
      console.error('Error getting story:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getStoriesByUserId(c: Context) {
    const userId = c.req.param('userId');

    try {
      const stories = await this.getStoriesByUserIdUseCase.execute(userId);
      return c.json(stories.map(story => storyProfileSchema.parse(story)), 200);
    } catch (error: any) {
      console.error('Error getting stories by user ID:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async updateStory(c: Context) {
    const storyId = c.req.param('id');
    const body = await c.req.json();
    const validation = updateStorySchema.safeParse({ id: storyId, ...body });

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const updatedStory = await this.updateStoryUseCase.execute(validation.data);
      if (!updatedStory) {
        return c.json({ error: 'Story not found or unauthorized' }, 404);
      }
      return c.json(storyProfileSchema.parse(updatedStory), 200);
    } catch (error: any) {
      console.error('Error updating story:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async deleteStory(c: Context) {
    const storyId = c.req.param('id');
    // Assuming userId comes from authentication middleware in a real app
    const userId = c.req.header('x-user-id'); // For testing purposes

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
      const deleted = await this.deleteStoryUseCase.execute(storyId, userId);
      if (!deleted) {
        return c.json({ error: 'Story not found or unauthorized' }, 404);
      }
      return c.json({ message: 'Story deleted successfully' }, 200);
    } catch (error: any) {
      console.error('Error deleting story:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }
}
