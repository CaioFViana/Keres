import { Context } from 'hono';
import {
  CreateRelationUseCase,
  GetRelationUseCase,
  GetRelationsByCharIdUseCase,
  UpdateRelationUseCase,
  DeleteRelationUseCase,
} from '@application/use-cases';
import { createRelationSchema, updateRelationSchema, relationProfileSchema } from '@presentation/schemas/RelationSchemas';

export class RelationController {
  constructor(
    private readonly createRelationUseCase: CreateRelationUseCase,
    private readonly getRelationUseCase: GetRelationUseCase,
    private readonly getRelationsByCharIdUseCase: GetRelationsByCharIdUseCase,
    private readonly updateRelationUseCase: UpdateRelationUseCase,
    private readonly deleteRelationUseCase: DeleteRelationUseCase
  ) {}

  async createRelation(c: Context) {
    const body = await c.req.json();
    const validation = createRelationSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const relationProfile = await this.createRelationUseCase.execute(validation.data);
      return c.json(relationProfileSchema.parse(relationProfile), 201);
    } catch (error: any) {
      console.error('Error creating relation:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getRelation(c: Context) {
    const relationId = c.req.param('id');

    try {
      const relationProfile = await this.getRelationUseCase.execute(relationId);
      if (!relationProfile) {
        return c.json({ error: 'Relation not found' }, 404);
      }
      return c.json(relationProfileSchema.parse(relationProfile), 200);
    } catch (error: any) {
      console.error('Error getting relation:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getRelationsByCharId(c: Context) {
    const charId = c.req.param('charId');

    try {
      const relations = await this.getRelationsByCharIdUseCase.execute(charId);
      return c.json(relations.map(relation => relationProfileSchema.parse(relation)), 200);
    } catch (error: any) {
      console.error('Error getting relations by character ID:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async updateRelation(c: Context) {
    const relationId = c.req.param('id');
    const body = await c.req.json();
    const validation = updateRelationSchema.safeParse({ id: relationId, ...body });

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const updatedRelation = await this.updateRelationUseCase.execute(validation.data);
      if (!updatedRelation) {
        return c.json({ error: 'Relation not found' }, 404);
      }
      return c.json(relationProfileSchema.parse(updatedRelation), 200);
    } catch (error: any) {
      console.error('Error updating relation:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async deleteRelation(c: Context) {
    const relationId = c.req.param('id');

    try {
      const deleted = await this.deleteRelationUseCase.execute(relationId);
      if (!deleted) {
        return c.json({ error: 'Relation not found' }, 404);
      }
      return c.json({ message: 'Relation deleted successfully' }, 200);
    } catch (error: any) {
      console.error('Error deleting relation:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }
}
