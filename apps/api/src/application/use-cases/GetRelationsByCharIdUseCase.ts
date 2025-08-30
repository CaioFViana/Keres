import type { IRelationRepository } from '@domain/repositories/IRelationRepository'
import type { RelationResponse } from '@keres/shared'

export class GetRelationsByCharIdUseCase {
  constructor(private readonly relationRepository: IRelationRepository) {}

  async execute(charId: string): Promise<RelationResponse[]> {
    const relations = await this.relationRepository.findByCharId(charId)
    return relations.map((relation) => ({
      id: relation.id,
      charIdSource: relation.charIdSource,
      charIdTarget: relation.charIdTarget,
      sceneId: relation.sceneId,
      momentId: relation.momentId,
      summary: relation.summary,
      isFavorite: relation.isFavorite,
      extraNotes: relation.extraNotes,
      createdAt: relation.createdAt,
      updatedAt: relation.updatedAt,
    }))
  }
}
