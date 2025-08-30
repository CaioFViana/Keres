import { CreateCharacterRelationDTO, CharacterRelationProfileDTO } from '@application/dtos/CharacterRelationDTOs';
import { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository';
import { CharacterRelation } from '@domain/entities/CharacterRelation';
import { ulid } from 'ulid';

export class CreateCharacterRelationUseCase {
  constructor(private readonly characterRelationRepository: ICharacterRelationRepository) {}

  async execute(data: CreateCharacterRelationDTO): Promise<CharacterRelationProfileDTO> {
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
