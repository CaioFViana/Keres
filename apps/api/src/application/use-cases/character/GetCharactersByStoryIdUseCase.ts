import { ICharacterRepository } from '@domain/repositories/ICharacterRepository';
import { CharacterResponse } from '@keres/shared';

export class GetCharactersByStoryIdUseCase {
  constructor(private readonly characterRepository: ICharacterRepository) {}

  async execute(storyId: string): Promise<CharacterResponse[]> {
    const characters = await this.characterRepository.findByStoryId(storyId);
    return characters.map(character => ({
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
    }));
  }
}