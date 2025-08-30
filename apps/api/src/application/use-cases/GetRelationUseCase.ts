import { IRelationRepository } from '@domain/repositories/IRelationRepository';
import { RelationResponse } from '@keres/shared';

export class GetRelationUseCase {
  constructor(private readonly relationRepository: IRelationRepository) {}

  async execute(id: string): Promise<RelationResponse | null> {
    const relation = await this.relationRepository.findById(id);
    if (!relation) {
      return null;
    }

    return {
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
    };
  }
}