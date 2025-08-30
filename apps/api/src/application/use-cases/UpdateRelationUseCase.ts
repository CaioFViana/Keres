import { UpdateRelationDTO, RelationProfileDTO } from '@application/dtos/RelationDTOs';
import { IRelationRepository } from '@domain/repositories/IRelationRepository';

export class UpdateRelationUseCase {
  constructor(private readonly relationRepository: IRelationRepository) {}

  async execute(data: UpdateRelationDTO): Promise<RelationProfileDTO | null> {
    const existingRelation = await this.relationRepository.findById(data.id);
    if (!existingRelation) {
      return null;
    }

    const updatedRelation = {
      ...existingRelation,
      charIdSource: data.charIdSource ?? existingRelation.charIdSource,
      charIdTarget: data.charIdTarget ?? existingRelation.charIdTarget,
      sceneId: data.sceneId ?? existingRelation.sceneId,
      momentId: data.momentId ?? existingRelation.momentId,
      summary: data.summary ?? existingRelation.summary,
      isFavorite: data.isFavorite ?? existingRelation.isFavorite,
      extraNotes: data.extraNotes ?? existingRelation.extraNotes,
      updatedAt: new Date(),
    };

    await this.relationRepository.update(updatedRelation);

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
    };
  }
}
