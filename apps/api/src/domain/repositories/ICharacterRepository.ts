import type { Character } from '@domain/entities/Character'
import type { ListQueryParams } from '@keres/shared'

export interface ICharacterRepository {
  findById(id: string): Promise<Character | null>
  findByIds(ids: string[]): Promise<Character[]>
  findByStoryId(storyId: string, query?: ListQueryParams): Promise<Character[]>
  save(character: Character): Promise<void>
  saveMany(characters: Character[]): Promise<void>
  update(character: Character, storyId: string): Promise<void>
  updateMany(characters: Character[]): Promise<void>
  delete(id: string, storyId: string): Promise<void>
  search(query: string, userId: string): Promise<Character[]>
}
