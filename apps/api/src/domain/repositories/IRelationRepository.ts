import type { Relation } from '@domain/entities/Relation'

export interface IRelationRepository {
  findById(id: string): Promise<Relation | null>
  findByCharId(charId: string): Promise<Relation[]>
  save(relation: Relation): Promise<void>
  update(relation: Relation): Promise<void>
  delete(id: string): Promise<void>
}
