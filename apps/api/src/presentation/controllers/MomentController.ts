import { Context } from 'hono';
import {
  CreateMomentUseCase,
  GetMomentUseCase,
  UpdateMomentUseCase,
  DeleteMomentUseCase,
  GetMomentsBySceneIdUseCase,
} from '@application/use-cases';
import { MomentCreateSchema, MomentUpdateSchema, MomentResponseSchema } from '@keres/shared';

export class MomentController {
  constructor(
    private readonly createMomentUseCase: CreateMomentUseCase,
    private readonly getMomentUseCase: GetMomentUseCase,
    private readonly updateMomentUseCase: UpdateMomentUseCase,
    private readonly deleteMomentUseCase: DeleteMomentUseCase,
    private readonly getMomentsBySceneIdUseCase: GetMomentsBySceneIdUseCase
  ) {}

  async createMoment(c: Context) {
    const data = c.req.valid('json'); // Validated by zValidator middleware

    try {
      const moment = await this.createMomentUseCase.execute(data);
      return c.json(MomentResponseSchema.parse(moment), 201);
    } catch (error: any) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getMoment(c: Context) {
    const momentId = c.req.param('id');

    try {
      const moment = await this.getMomentUseCase.execute(momentId);
      if (!moment) {
        return c.json({ error: 'Moment not found' }, 404);
      }
      return c.json(MomentResponseSchema.parse(moment), 200);
    } catch (error) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getMomentsBySceneId(c: Context) {
    const sceneId = c.req.param('sceneId'); // Assuming sceneId is passed as a param

    try {
      const moments = await this.getMomentsBySceneIdUseCase.execute(sceneId);
      return c.json(moments.map(moment => MomentResponseSchema.parse(moment)), 200);
    } catch (error) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async updateMoment(c: Context) {
    const momentId = c.req.param('id');
    const data = c.req.valid('json'); // Validated by zValidator middleware

    try {
      const updatedMoment = await this.updateMomentUseCase.execute({ id: momentId, ...data });
      if (!updatedMoment) {
        return c.json({ error: 'Moment not found or does not belong to the specified scene' }, 404);
      }
      return c.json(MomentResponseSchema.parse(updatedMoment), 200);
    } catch (error: any) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async deleteMoment(c: Context) {
    const momentId = c.req.param('id');
    const sceneId = c.req.query('sceneId'); // Assuming sceneId is passed as a query param for delete

    if (!sceneId) {
      return c.json({ error: 'sceneId is required for deletion' }, 400);
    }

    try {
      const deleted = await this.deleteMomentUseCase.execute(momentId, sceneId);
      if (!deleted) {
        return c.json({ error: 'Moment not found or does not belong to the specified scene' }, 404);
      }
      return c.json({}, 204);
    } catch (error) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }
}