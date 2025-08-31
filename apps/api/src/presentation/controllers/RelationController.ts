import type {
  CreateRelationUseCase,
  DeleteRelationUseCase,
  GetRelationsByCharIdUseCase,
  GetRelationUseCase,
  UpdateRelationUseCase,
} from '@application/use-cases'
import type { z } from 'zod'

import {
  type RelationCreateSchema,
  RelationResponseSchema,
  type RelationUpdateSchema,
} from '@keres/shared'

export class RelationController {
  constructor(
    private readonly createRelationUseCase: CreateRelationUseCase,
    private readonly getRelationUseCase: GetRelationUseCase,
    private readonly updateRelationUseCase: UpdateRelationUseCase,
    private readonly deleteRelationUseCase: DeleteRelationUseCase,
    private readonly getRelationsByCharIdUseCase: GetRelationsByCharIdUseCase,
  ) {}

  async createRelation(data: z.infer<typeof RelationCreateSchema>) {
    const relation = await this.createRelationUseCase.execute(data)
    return RelationResponseSchema.parse(relation)
  }

  async getRelation(id: string) {
    const relation = await this.getRelationUseCase.execute(id)
    if (!relation) {
      throw new Error('Relation not found')
    }
    return RelationResponseSchema.parse(relation)
  }

  async getRelationsByCharId(charId: string) {
    const relations = await this.getRelationsByCharIdUseCase.execute(charId)
    return relations.map((relation) => RelationResponseSchema.parse(relation))
  }

  async updateRelation(id: string, data: z.infer<typeof RelationUpdateSchema>) {
    const { id: dataId, ...updateData } = data
    const updatedRelation = await this.updateRelationUseCase.execute({ id, ...updateData })
    if (!updatedRelation) {
      throw new Error('Relation not found or does not belong to the specified characters')
    }
    return RelationResponseSchema.parse(updatedRelation)
  }

  async deleteRelation(id: string, charIdSource: string, charIdTarget: string) {
    if (!charIdSource || !charIdTarget) {
      throw new Error('charIdSource and charIdTarget are required for deletion')
    }
    const deleted = await this.deleteRelationUseCase.execute(id, charIdSource, charIdTarget)
    if (!deleted) {
      throw new Error('Relation not found or does not belong to the specified characters')
    }
    return
  }
}
