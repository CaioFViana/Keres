import type {
  CreateRelationUseCase,
  DeleteRelationUseCase,
  GetRelationsByCharIdUseCase,
  GetRelationUseCase,
  UpdateRelationUseCase,
} from '@application/use-cases'
import type { Context } from 'hono'

import { RelationResponseSchema } from '@keres/shared'

export class RelationController {
  constructor(
    private readonly createRelationUseCase: CreateRelationUseCase,
    private readonly getRelationUseCase: GetRelationUseCase,
    private readonly updateRelationUseCase: UpdateRelationUseCase,
    private readonly deleteRelationUseCase: DeleteRelationUseCase,
    private readonly getRelationsByCharIdUseCase: GetRelationsByCharIdUseCase,
  ) {}

  async createRelation(c: Context) {
    const data = c.req.valid('json') // Validated by zValidator middleware

    try {
      const relation = await this.createRelationUseCase.execute(data)
      return c.json(RelationResponseSchema.parse(relation), 201)
    } catch (_error: unknown) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async getRelation(c: Context) {
    const relationId = c.req.param('id')

    try {
      const relation = await this.getRelationUseCase.execute(relationId)
      if (!relation) {
        return c.json({ error: 'Relation not found' }, 404)
      }
      return c.json(RelationResponseSchema.parse(relation), 200)
    } catch (_error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async getRelationsByCharId(c: Context) {
    const charId = c.req.param('charId') // Assuming charId is passed as a param

    try {
      const relations = await this.getRelationsByCharIdUseCase.execute(charId)
      return c.json(
        relations.map((relation) => RelationResponseSchema.parse(relation)),
        200,
      )
    } catch (_error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async updateRelation(c: Context) {
    const relationId = c.req.param('id')
    const data = c.req.valid('json') // Validated by zValidator middleware

    try {
      const updatedRelation = await this.updateRelationUseCase.execute({ id: relationId, ...data })
      if (!updatedRelation) {
        return c.json(
          { error: 'Relation not found or does not belong to the specified characters' },
          404,
        )
      }
      return c.json(RelationResponseSchema.parse(updatedRelation), 200)
    } catch (_error: unknown) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async deleteRelation(c: Context) {
    const relationId = c.req.param('id')
    const charIdSource = c.req.query('charIdSource') // Assuming charIdSource is passed as a query param for delete
    const charIdTarget = c.req.query('charIdTarget') // Assuming charIdTarget is passed as a query param for delete

    if (!charIdSource || !charIdTarget) {
      return c.json({ error: 'charIdSource and charIdTarget are required for deletion' }, 400)
    }

    try {
      const deleted = await this.deleteRelationUseCase.execute(
        relationId,
        charIdSource,
        charIdTarget,
      )
      if (!deleted) {
        return c.json(
          { error: 'Relation not found or does not belong to the specified characters' },
          404,
        )
      }
      return c.json({}, 204)
    } catch (_error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }
}
