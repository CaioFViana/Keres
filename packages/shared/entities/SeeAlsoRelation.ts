import type { SeeAlsoEntityType } from '../metadata/SeeAlsoEntityType';

/**
 * A "See also" link between any two entities in the system (within the types supported by
 * `SeeAlsoEntityType`). Mutual by nature - a single unordered row (A/B) represents the link from
 * both sides, unlike `NoteRelation`/`TagRelation`, which have a fixed "owner" side. There is no
 * `relationType`: only one kind of link exists.
 */
export interface SeeAlsoRelation {
  id: string;
  storyId: string;
  entityAType: SeeAlsoEntityType;
  entityAId: string;
  entityBType: SeeAlsoEntityType;
  entityBId: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
