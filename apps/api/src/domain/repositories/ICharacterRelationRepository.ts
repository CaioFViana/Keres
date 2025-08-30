import { CharacterRelation } from '@domain/entities/CharacterRelation';

export interface ICharacterRelationRepository {
  findById(id: string): Promise<CharacterRelation | null>;
  findByCharId(charId: string): Promise<CharacterRelation[]>;
  save(characterRelation: CharacterRelation): Promise<void>;
  update(characterRelation: CharacterRelation): Promise<void>;
  delete(id: string): Promise<void>;
}
