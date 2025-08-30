import { ICharacterRepository } from '@domain/repositories/ICharacterRepository';
import { CharacterUpdatePayload, CharacterResponse } from '@keres/shared';

export class UpdateCharacterUseCase {
  constructor(private readonly characterRepository: ICharacterRepository) {}

  async execute(data: CharacterUpdatePayload): Promise<CharacterResponse | null> {
    const existingCharacter = await this.characterRepository.findById(data.id);
    if (!existingCharacter) {
      return null; // Character not found
    }
    // Add ownership check
    if (data.storyId && existingCharacter.storyId !== data.storyId) {
      return null; // Character does not belong to this story
    }

    const updatedCharacter = {
      ...existingCharacter,
      ...data,
      updatedAt: new Date(),
    };

    await this.characterRepository.update(updatedCharacter);

    return {
      id: updatedCharacter.id,
      storyId: updatedCharacter.storyId,
      name: updatedCharacter.name,
      gender: updatedCharacter.gender,
      race: updatedCharacter.race,
      subrace: updatedCharacter.subrace,
      personality: updatedCharacter.personality,
      motivation: updatedCharacter.motivation,
      qualities: updatedCharacter.qualities,
      weaknesses: updatedCharacter.weaknesses,
      biography: updatedCharacter.biography,
      plannedTimeline: updatedCharacter.plannedTimeline,
      isFavorite: updatedCharacter.isFavorite,
      extraNotes: updatedCharacter.extraNotes,
      createdAt: updatedCharacter.createdAt,
      updatedAt: updatedCharacter.updatedAt,
    };
  }
}