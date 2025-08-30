import { CreateCharacterMomentDTO, CharacterMomentProfileDTO } from '@application/dtos/CharacterMomentDTOs';
import { ICharacterMomentRepository } from '@domain/repositories/ICharacterMomentRepository';
import { CharacterMoment } from '@domain/entities/CharacterMoment';

export class CreateCharacterMomentUseCase {
  constructor(private readonly characterMomentRepository: ICharacterMomentRepository) {}

  async execute(data: CreateCharacterMomentDTO): Promise<CharacterMomentProfileDTO> {
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
