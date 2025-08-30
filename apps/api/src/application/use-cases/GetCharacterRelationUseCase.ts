import { CharacterRelationProfileDTO } from '@application/dtos/CharacterRelationDTOs';
import { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository';

export class GetCharacterRelationUseCase {
  constructor(private readonly characterRelationRepository: ICharacterRelationRepository) {}

  async execute(relationId: string): Promise<CharacterRelationProfileDTO | null> {
    const characterRelation = await this.characterRelationRepository.findById(relationId);
    if (!characterRelation) {
      return null;
    }

    return {
      id: characterRelation.id,
      charId1: characterRelation.charId1,
      charId2: characterRelation.charId2,
      relationType: characterRelation.relationType,
      createdAt: characterRelation.createdAt,
      updatedAt: characterRelation.updatedAt,
    };
  }
}
