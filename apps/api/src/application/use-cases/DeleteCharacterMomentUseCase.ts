import { ICharacterMomentRepository } from '@domain/repositories/ICharacterMomentRepository';

export class DeleteCharacterMomentUseCase {
  constructor(private readonly characterMomentRepository: ICharacterMomentRepository) {}

  async execute(characterId: string, momentId: string): Promise<boolean> {
    // In a real app, you might want to check if the characterMoment exists first
    await this.characterMomentRepository.delete(characterId, momentId);
    return true; // Assuming delete always succeeds if no error is thrown
  }
}
