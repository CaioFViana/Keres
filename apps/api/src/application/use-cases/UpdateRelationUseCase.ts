import type { IRelationRepository } from '@domain/repositories/IRelationRepository'
import type { RelationResponse, RelationUpdatePayload } from '@keres/shared'

export class UpdateRelationUseCase {
  constructor(private readonly relationRepository: IRelationRepository) {}

  async execute(data: RelationUpdatePayload): Promise<RelationResponse | null> {
    const existingRelation = await this.relationRepository.findById(data.id)
    if (!existingRelation) {
      return null // Relation not found
    }
    // Add ownership check (assuming charIdSource and charIdTarget define ownership)
    if (data.charIdSource && existingRelation.charIdSource !== data.charIdSource) {
      return null // Relation does not belong to this source character
    }
    if (data.charIdTarget && existingRelation.charIdTarget !== data.charIdTarget) {
      return null // Relation does not belong to this target character
    }

    const updatedRelation = {
      ...existingRelation,
      ...data,
      updatedAt: new Date(),
    }

    await this.relationRepository.update(updatedRelation)

    return {
      id: updatedRelation.id,
      charIdSource: updatedRelation.charIdSource,
      charIdTarget: updatedRelation.charIdTarget,
      sceneId: updatedRelation.sceneId,
      momentId: updatedRelation.momentId,
      summary: updatedRelation.summary,
      isFavorite: updatedRelation.isFavorite,
      extraNotes: updatedRelation.extraNotes,
      createdAt: updatedRelation.createdAt,
      updatedAt: updatedRelation.updatedAt,
    }
  }
}
