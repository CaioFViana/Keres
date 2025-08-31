import type { CharacterMoment } from '@domain/entities/CharacterMoment'
import type { ICharacterMomentRepository } from '@domain/repositories/ICharacterMomentRepository'
import type { CharacterMomentCreatePayload, CharacterMomentResponse } from '@keres/shared'

export class CreateCharacterMomentUseCase {
  constructor(private readonly characterMomentRepository: ICharacterMomentRepository) {}

  async execute(data: CharacterMomentCreatePayload): Promise<CharacterMomentResponse> {
    const newCharacterMoment: CharacterMoment = {
      characterId: data.characterId,
      momentId: data.momentId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.characterMomentRepository.save(newCharacterMoment)

    return {
      characterId: newCharacterMoment.characterId,
      momentId: newCharacterMoment.momentId,
      createdAt: newCharacterMoment.createdAt,
      updatedAt: newCharacterMoment.updatedAt,
    }
  }
}
