import { CharacterProfileDTO } from '@application/dtos/CharacterDTOs';
import { ICharacterRepository } from '@domain/repositories/ICharacterRepository';

export class GetCharacterUseCase {
  constructor(private readonly characterRepository: ICharacterRepository) {}

  async execute(characterId: string): Promise<CharacterProfileDTO | null> {
    const character = await this.characterRepository.findById(characterId);
    if (!character) {
      return null;
    }

    return {
      id: character.id,
      storyId: character.storyId,
      name: character.name,
      gender: character.gender,
      race: character.race,
      subrace: character.subrace,
      personality: character.personality,
      motivation: character.motivation,
      qualities: character.qualities,
      weaknesses: character.weaknesses,
      biography: character.biography,
      plannedTimeline: character.plannedTimeline,
      isFavorite: character.isFavorite,
      extraNotes: character.extraNotes,
      createdAt: character.createdAt,
      updatedAt: character.updatedAt,
    };
  }
}
