import type { Character } from '@domain/entities/Character'

export interface ICharacterRepository {
  findById(id: string): Promise<Character | null>
  findByStoryId(storyId: string): Promise<Character[]>
  save(character: Character): Promise<void>
  update(character: Character, storyId: string): Promise<void>
  delete(id: string, storyId: string): Promise<void>
}
