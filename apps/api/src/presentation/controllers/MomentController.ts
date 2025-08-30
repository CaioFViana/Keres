import { Context } from 'hono';
import {
  CreateMomentUseCase,
  GetMomentUseCase,
  GetMomentsBySceneIdUseCase,
  UpdateMomentUseCase,
  DeleteMomentUseCase,
} from '@application/use-cases';
import { createMomentSchema, updateMomentSchema, momentProfileSchema } from '@presentation/schemas/MomentSchemas';

export class MomentController {
  constructor(
    private readonly createMomentUseCase: CreateMomentUseCase,
    private readonly getMomentUseCase: GetMomentUseCase,
    private readonly getMomentsBySceneIdUseCase: GetMomentsBySceneIdUseCase,
    private readonly updateMomentUseCase: UpdateMomentUseCase,
    private readonly deleteMomentUseCase: DeleteMomentUseCase
  ) {}

  async createMoment(c: Context) {
    const body = await c.req.json();
    const validation = createMomentSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const momentProfile = await this.createMomentUseCase.execute(validation.data);
      return c.json(momentProfileSchema.parse(momentProfile), 201);
    } catch (error: any) {
      console.error('Error creating moment:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getMoment(c: Context) {
    const momentId = c.req.param('id');

    try {
      const momentProfile = await this.getMomentUseCase.execute(momentId);
      if (!momentProfile) {
        return c.json({ error: 'Moment not found' }, 404);
      }
      return c.json(momentProfileSchema.parse(momentProfile), 200);
    } catch (error: any) {
      console.error('Error getting moment:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getMomentsBySceneId(c: Context) {
    const sceneId = c.req.param('sceneId');

    try {
      const moments = await this.getMomentsBySceneIdUseCase.execute(sceneId);
      return c.json(moments.map(moment => momentProfileSchema.parse(moment)), 200);
    } catch (error: any) {
      console.error('Error getting moments by scene ID:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async updateMoment(c: Context) {
    const momentId = c.req.param('id');
    const body = await c.req.json();
    const validation = updateMomentSchema.safeParse({ id: momentId, ...body });

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const updatedMoment = await this.updateMomentUseCase.execute(validation.data);
      if (!updatedMoment) {
        return c.json({ error: 'Moment not found or unauthorized' }, 404);
      }
      return c.json(momentProfileSchema.parse(updatedMoment), 200);
    } catch (error: any) {
      console.error('Error updating moment:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async deleteMoment(c: Context) {
    const momentId = c.req.param('id');
    // Assuming sceneId comes from the request body or a header for authorization
    const sceneId = c.req.header('x-scene-id'); // For testing purposes

    if (!sceneId) {
      return c.json({ error: 'Unauthorized: Missing scene ID' }, 401);
    }

    try {
      const deleted = await this.deleteMomentUseCase.execute(momentId, sceneId);
      if (!deleted) {
        return c.json({ error: 'Moment not found or unauthorized' }, 404);
      }
      return c.json({ message: 'Moment deleted successfully' }, 200);
    } catch (error: any) {
      console.error('Error deleting moment:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }
}
