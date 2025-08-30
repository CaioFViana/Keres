import { UpdateCharacterDTO, CharacterProfileDTO } from '@application/dtos/CharacterDTOs';
import { ICharacterRepository } from '@domain/repositories/ICharacterRepository';

export class UpdateCharacterUseCase {
  constructor(private readonly characterRepository: ICharacterRepository) {}

  async execute(data: UpdateCharacterDTO): Promise<CharacterProfileDTO | null> {
    const existingCharacter = await this.characterRepository.findById(data.id);
    if (!existingCharacter || existingCharacter.storyId !== data.storyId) {
      // Character not found or does not belong to the specified story
      return null;
    }

    const updatedCharacter = {
      ...existingCharacter,
      name: data.name ?? existingCharacter.name,
      gender: data.gender ?? existingCharacter.gender,
      race: data.race ?? existingCharacter.race,
      subrace: data.subrace ?? existingCharacter.subrace,
      personality: data.personality ?? existingCharacter.personality,
      motivation: data.motivation ?? existingCharacter.motivation,
      qualities: data.qualities ?? existingCharacter.qualities,
      weaknesses: data.weaknesses ?? existingCharacter.weaknesses,
      biography: data.biography ?? existingCharacter.biography,
      plannedTimeline: data.plannedTimeline ?? existingCharacter.plannedTimeline,
      isFavorite: data.isFavorite ?? existingCharacter.isFavorite,
      extraNotes: data.extraNotes ?? existingCharacter.extraNotes,
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
