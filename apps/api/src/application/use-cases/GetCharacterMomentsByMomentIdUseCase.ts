import type { ICharacterMomentRepository } from '@domain/repositories/ICharacterMomentRepository'
import type { CharacterMomentResponse } from '@keres/shared'

export class GetCharacterMomentsByMomentIdUseCase {
  constructor(private readonly characterMomentRepository: ICharacterMomentRepository) {}

  async execute(momentId: string): Promise<CharacterMomentResponse[]> {
    const characterMoments = await this.characterMomentRepository.findByMomentId(momentId)
    return characterMoments.map((cm) => ({
      characterId: cm.characterId,
      momentId: cm.momentId,
      createdAt: cm.createdAt,
      updatedAt: cm.updatedAt,
    }))
  }
}
