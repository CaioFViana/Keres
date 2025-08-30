import { CharacterMoment } from '@domain/entities/CharacterMoment';

export interface ICharacterMomentRepository {
  findByCharacterId(characterId: string): Promise<CharacterMoment[]>;
  findByMomentId(momentId: string): Promise<CharacterMoment[]>;
  save(characterMoment: CharacterMoment): Promise<void>;
  delete(characterId: string, momentId: string): Promise<void>;
}
