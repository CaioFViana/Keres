import { Character } from '@domain/entities/Character';

export interface ICharacterRepository {
  findById(id: string): Promise<Character | null>;
  findByStoryId(storyId: string): Promise<Character[]>;
  save(character: Character): Promise<void>;
  update(character: Character): Promise<void>;
  delete(id: string): Promise<void>;
}
