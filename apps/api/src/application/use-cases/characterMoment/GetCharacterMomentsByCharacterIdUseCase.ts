import type { ICharacterMomentRepository } from '@domain/repositories/ICharacterMomentRepository'
import type { CharacterMomentResponse } from '@keres/shared'

export class GetCharacterMomentsByCharacterIdUseCase {
  constructor(private readonly characterMomentRepository: ICharacterMomentRepository) {}

  async execute(characterId: string): Promise<CharacterMomentResponse[]> {
    const characterMoments = await this.characterMomentRepository.findByCharacterId(characterId)
    return characterMoments.map((cm) => ({
      characterId: cm.characterId,
      momentId: cm.momentId,
      createdAt: cm.createdAt,
      updatedAt: cm.updatedAt,
    }))
  }
}
