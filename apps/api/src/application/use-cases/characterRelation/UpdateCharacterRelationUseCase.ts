import type { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository'
import type { CharacterRelationResponse, CharacterRelationUpdatePayload } from '@keres/shared'

export class UpdateCharacterRelationUseCase {
  constructor(private readonly characterRelationRepository: ICharacterRelationRepository) {}

  async execute(data: CharacterRelationUpdatePayload): Promise<CharacterRelationResponse | null> {
    const existingCharacterRelation = await this.characterRelationRepository.findById(data.id)
    if (!existingCharacterRelation) {
      return null // Character relation not found
    }
    // Note: charId1 and charId2 are typically not updated for relations.
    // If they were, additional checks would be needed here.

    const updatedCharacterRelation = {
      ...existingCharacterRelation,
      ...data,
      updatedAt: new Date(),
    }

    await this.characterRelationRepository.update(updatedCharacterRelation)

    return {
      id: updatedCharacterRelation.id,
      charId1: updatedCharacterRelation.charId1,
      charId2: updatedCharacterRelation.charId2,
      relationType: updatedCharacterRelation.relationType,
      createdAt: updatedCharacterRelation.createdAt,
      updatedAt: updatedCharacterRelation.updatedAt,
    }
  }
}
