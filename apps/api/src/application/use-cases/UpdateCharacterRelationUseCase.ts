import { UpdateCharacterRelationDTO, CharacterRelationProfileDTO } from '@application/dtos/CharacterRelationDTOs';
import { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository';

export class UpdateCharacterRelationUseCase {
  constructor(private readonly characterRelationRepository: ICharacterRelationRepository) {}

  async execute(data: UpdateCharacterRelationDTO): Promise<CharacterRelationProfileDTO | null> {
    const existingCharacterRelation = await this.characterRelationRepository.findById(data.id);
    if (!existingCharacterRelation) {
      return null;
    }

    const updatedCharacterRelation = {
      ...existingCharacterRelation,
      charId1: data.charId1 ?? existingCharacterRelation.charId1,
      charId2: data.charId2 ?? existingCharacterRelation.charId2,
      relationType: data.relationType ?? existingCharacterRelation.relationType,
      updatedAt: new Date(),
    };

    await this.characterRelationRepository.update(updatedCharacterRelation);

    return {
      id: updatedCharacterRelation.id,
      charId1: updatedCharacterRelation.charId1,
      charId2: updatedCharacterRelation.charId2,
      relationType: updatedCharacterRelation.relationType,
      createdAt: updatedCharacterRelation.createdAt,
      updatedAt: updatedCharacterRelation.updatedAt,
    };
  }
}
