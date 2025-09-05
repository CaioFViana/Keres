import type { CharacterMoment } from '@domain/entities/CharacterMoment'

export interface ICharacterMomentRepository {
  findById(characterId: string, momentId: string): Promise<CharacterMoment | null>
  findByCharacterId(characterId: string): Promise<CharacterMoment[]>
  findByMomentId(momentId: string): Promise<CharacterMoment[]>
  save(characterMoment: CharacterMoment): Promise<void>
  delete(characterId: string, momentId: string): Promise<void>
}
