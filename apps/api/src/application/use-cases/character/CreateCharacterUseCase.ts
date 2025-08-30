import { Character } from '@domain/entities/Character';
import { ICharacterRepository } from '@domain/repositories/ICharacterRepository';
import { ulid } from 'ulid';
import { CharacterCreatePayload, CharacterResponse } from '@keres/shared';

export class CreateCharacterUseCase {
  constructor(private readonly characterRepository: ICharacterRepository) {}

  async execute(data: CharacterCreatePayload): Promise<CharacterResponse> {
    const newCharacter: Character = {
      id: ulid(),
      storyId: data.storyId,
      name: data.name,
      gender: data.gender || null,
      race: data.race || null,
      subrace: data.subrace || null,
      personality: data.personality || null,
      motivation: data.motivation || null,
      qualities: data.qualities || null,
      weaknesses: data.weaknesses || null,
      biography: data.biography || null,
      plannedTimeline: data.plannedTimeline || null,
      isFavorite: data.isFavorite || false,
      extraNotes: data.extraNotes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.characterRepository.save(newCharacter);

    return {
      id: newCharacter.id,
      storyId: newCharacter.storyId,
      name: newCharacter.name,
      gender: newCharacter.gender,
      race: newCharacter.race,
      subrace: newCharacter.subrace,
      personality: newCharacter.personality,
      motivation: newCharacter.motivation,
      qualities: newCharacter.qualities,
      weaknesses: newCharacter.weaknesses,
      biography: newCharacter.biography,
      plannedTimeline: newCharacter.plannedTimeline,
      isFavorite: newCharacter.isFavorite,
      extraNotes: newCharacter.extraNotes,
      createdAt: newCharacter.createdAt,
      updatedAt: newCharacter.updatedAt,
    };
  }
}