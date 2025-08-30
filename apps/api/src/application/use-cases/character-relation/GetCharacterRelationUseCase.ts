import { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository';
import { CharacterRelationResponse } from '@keres/shared';

export class GetCharacterRelationUseCase {
  constructor(private readonly characterRelationRepository: ICharacterRelationRepository) {}

  async execute(id: string): Promise<CharacterRelationResponse | null> {
    const characterRelation = await this.characterRelationRepository.findById(id);
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