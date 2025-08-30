import type { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository'
import type { CharacterRelationResponse } from '@keres/shared'

export class GetCharacterRelationsByCharIdUseCase {
  constructor(private readonly characterRelationRepository: ICharacterRelationRepository) {}

  async execute(charId: string): Promise<CharacterRelationResponse[]> {
    const characterRelations = await this.characterRelationRepository.findByCharId(charId)
    return characterRelations.map((cr) => ({
      id: cr.id,
      charId1: cr.charId1,
      charId2: cr.charId2,
      relationType: cr.relationType,
      createdAt: cr.createdAt,
      updatedAt: cr.updatedAt,
    }))
  }
}
