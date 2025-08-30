import { CharacterMomentProfileDTO } from '@application/dtos/CharacterMomentDTOs';
import { ICharacterMomentRepository } from '@domain/repositories/ICharacterMomentRepository';

export class GetCharacterMomentsByCharacterIdUseCase {
  constructor(private readonly characterMomentRepository: ICharacterMomentRepository) {}

  async execute(characterId: string): Promise<CharacterMomentProfileDTO[]> {
    const characterMoments = await this.characterMomentRepository.findByCharacterId(characterId);
    return characterMoments.map(cm => ({
      characterId: cm.characterId,
      momentId: cm.momentId,
      createdAt: cm.createdAt,
      updatedAt: cm.updatedAt,
    }));
  }
}
