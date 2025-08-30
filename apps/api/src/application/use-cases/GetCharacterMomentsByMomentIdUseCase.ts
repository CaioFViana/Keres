import { CharacterMomentProfileDTO } from '@application/dtos/CharacterMomentDTOs';
import { ICharacterMomentRepository } from '@domain/repositories/ICharacterMomentRepository';

export class GetCharacterMomentsByMomentIdUseCase {
  constructor(private readonly characterMomentRepository: ICharacterMomentRepository) {}

  async execute(momentId: string): Promise<CharacterMomentProfileDTO[]> {
    const characterMoments = await this.characterMomentRepository.findByMomentId(momentId);
    return characterMoments.map(cm => ({
      characterId: cm.characterId,
      momentId: cm.momentId,
      createdAt: cm.createdAt,
      updatedAt: cm.updatedAt,
    }));
  }
}
