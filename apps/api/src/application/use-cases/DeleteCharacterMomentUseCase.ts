import { ICharacterMomentRepository } from '@domain/repositories/ICharacterMomentRepository';

export class DeleteCharacterMomentUseCase {
  constructor(private readonly characterMomentRepository: ICharacterMomentRepository) {}

  async execute(characterId: string, momentId: string): Promise<boolean> {
    // In a real scenario, you might want to check if the record exists before attempting to delete
    // and return false if not found. For now, assuming delete will succeed if IDs are valid.
    try {
      await this.characterMomentRepository.delete(characterId, momentId);
      return true;
    } catch (error) {
      console.error('Error deleting character moment:', error);
      return false; // Or re-throw if it's an unexpected error
    }
  }
}