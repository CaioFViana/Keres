import { RelationProfileDTO } from '@application/dtos/RelationDTOs';
import { IRelationRepository } from '@domain/repositories/IRelationRepository';

export class GetRelationUseCase {
  constructor(private readonly relationRepository: IRelationRepository) {}

  async execute(relationId: string): Promise<RelationProfileDTO | null> {
    const relation = await this.relationRepository.findById(relationId);
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
