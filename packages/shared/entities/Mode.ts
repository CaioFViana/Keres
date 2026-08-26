/**
 * An alternative state of a character over the course of the work ("Awakened", "After training").
 *
 * Independent of the stat system: modes exist even with `Story.statSystem` off, because describing
 * what changes in a transformation is useful on its own. When the system is on, each mode can
 * override the character's stat values (see `StatRelation.modeId`).
 */
export interface Mode {
  id: string;
  storyId: string;
  characterId: string;
  name: string;
  /** O que muda nesta forma, em texto livre. */
  modeChanges: string | null;
  /** Display order, ascending. */
  order: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
