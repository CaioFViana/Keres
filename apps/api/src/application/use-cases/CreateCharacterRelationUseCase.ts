import { CharacterRelation } from '@domain/entities/CharacterRelation';
import { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository';
import { ulid } from 'ulid';
import { CharacterRelationCreatePayload, CharacterRelationResponse } from '@keres/shared';

export class CreateCharacterRelationUseCase {
  constructor(private readonly characterRelationRepository: ICharacterRelationRepository) {}

  async execute(data: CharacterRelationCreatePayload): Promise<CharacterRelationResponse> {
    const newCharacterRelation: CharacterRelation = {
      id: ulid(),
      charId1: data.charId1,
      charId2: data.charId2,
      relationType: data.relationType,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.characterRelationRepository.save(newCharacterRelation);

    return {
      id: newCharacterRelation.id,
      charId1: newCharacterRelation.charId1,
      charId2: newCharacterRelation.charId2,
      relationType: newCharacterRelation.relationType,
      createdAt: newCharacterRelation.createdAt,
      updatedAt: newCharacterRelation.updatedAt,
    };
  }
}