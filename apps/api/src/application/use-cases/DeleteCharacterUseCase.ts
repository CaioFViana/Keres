import { ICharacterRepository } from '@domain/repositories/ICharacterRepository';

export class DeleteCharacterUseCase {
  constructor(private readonly characterRepository: ICharacterRepository) {}

  async execute(characterId: string, storyId: string): Promise<boolean> {
    const existingCharacter = await this.characterRepository.findById(characterId);
    if (!existingCharacter || existingCharacter.storyId !== storyId) {
      // Character not found or does not belong to the specified story
      return false;
    }

    await this.characterRepository.delete(characterId);
    return true;
  }
}
