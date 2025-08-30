import { ICharacterRepository } from '@domain/repositories/ICharacterRepository';

export class DeleteCharacterUseCase {
  constructor(private readonly characterRepository: ICharacterRepository) {}

  async execute(id: string, storyId: string): Promise<boolean> {
    const existingCharacter = await this.characterRepository.findById(id);
    if (!existingCharacter) {
      return false; // Character not found
    }
    if (existingCharacter.storyId !== storyId) { // Check ownership
      return false; // Character does not belong to this story
    }
    await this.characterRepository.delete(id);
    return true;
  }
}