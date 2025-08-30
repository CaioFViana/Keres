import { ICharacterMomentRepository } from '@domain/repositories/ICharacterMomentRepository';
import { CharacterMomentCreatePayload, CharacterMomentResponse } from '@keres/shared';
import { CharacterMoment } from '@domain/entities/CharacterMoment';

export class CreateCharacterMomentUseCase {
  constructor(private readonly characterMomentRepository: ICharacterMomentRepository) {}

  async execute(data: CharacterMomentCreatePayload): Promise<CharacterMomentResponse> {
    const newCharacterMoment: CharacterMoment = {
      characterId: data.characterId,
      momentId: data.momentId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.characterMomentRepository.save(newCharacterMoment);

    return {
      characterId: newCharacterMoment.characterId,
      momentId: newCharacterMoment.momentId,
      createdAt: newCharacterMoment.createdAt,
      updatedAt: newCharacterMoment.updatedAt,
    };
  }
}