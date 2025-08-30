import { Context } from 'hono';
import {
  CreateSceneUseCase,
  GetSceneUseCase,
  GetScenesByChapterIdUseCase,
  UpdateSceneUseCase,
  DeleteSceneUseCase,
} from '@application/use-cases';
import { createSceneSchema, updateSceneSchema, sceneProfileSchema } from '@presentation/schemas/SceneSchemas';

export class SceneController {
  constructor(
    private readonly createSceneUseCase: CreateSceneUseCase,
    private readonly getSceneUseCase: GetSceneUseCase,
    private readonly getScenesByChapterIdUseCase: GetScenesByChapterIdUseCase,
    private readonly updateSceneUseCase: UpdateSceneUseCase,
    private readonly deleteSceneUseCase: DeleteSceneUseCase
  ) {}

  async createScene(c: Context) {
    const body = await c.req.json();
    const validation = createSceneSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const sceneProfile = await this.createSceneUseCase.execute(validation.data);
      return c.json(sceneProfileSchema.parse(sceneProfile), 201);
    } catch (error: any) {
      console.error('Error creating scene:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getScene(c: Context) {
    const sceneId = c.req.param('id');

    try {
      const sceneProfile = await this.getSceneUseCase.execute(sceneId);
      if (!sceneProfile) {
        return c.json({ error: 'Scene not found' }, 404);
      }
      return c.json(sceneProfileSchema.parse(sceneProfile), 200);
    } catch (error: any) {
      console.error('Error getting scene:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getScenesByChapterId(c: Context) {
    const chapterId = c.req.param('chapterId');

    try {
      const scenes = await this.getScenesByChapterIdUseCase.execute(chapterId);
      return c.json(scenes.map(scene => sceneProfileSchema.parse(scene)), 200);
    } catch (error: any) {
      console.error('Error getting scenes by chapter ID:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async updateScene(c: Context) {
    const sceneId = c.req.param('id');
    const body = await c.req.json();
    const validation = updateSceneSchema.safeParse({ id: sceneId, ...body });

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const updatedScene = await this.updateSceneUseCase.execute(validation.data);
      if (!updatedScene) {
        return c.json({ error: 'Scene not found or unauthorized' }, 404);
      }
      return c.json(sceneProfileSchema.parse(updatedScene), 200);
    } catch (error: any) {
      console.error('Error updating scene:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async deleteScene(c: Context) {
    const sceneId = c.req.param('id');
    // Assuming chapterId comes from the request body or a header for authorization
    const chapterId = c.req.header('x-chapter-id'); // For testing purposes

    if (!chapterId) {
      return c.json({ error: 'Unauthorized: Missing chapter ID' }, 401);
    }

    try {
      const deleted = await this.deleteSceneUseCase.execute(sceneId, chapterId);
      if (!deleted) {
        return c.json({ error: 'Scene not found or unauthorized' }, 404);
      }
      return c.json({ message: 'Scene deleted successfully' }, 200);
    } catch (error: any) {
      console.error('Error deleting scene:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }
}
