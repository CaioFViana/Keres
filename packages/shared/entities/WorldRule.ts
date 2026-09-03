export const WORLD_PIECE_SECTIONS = [
  'rule',
  'fauna',
  'flora',
  'mythology',
  'people',
  'knowledge',
  'other',
] as const;

export type WorldPieceSection = (typeof WORLD_PIECE_SECTIONS)[number];

export interface WorldRule {
  id: string;
  storyId: string;
  title: string;
  description: string | null;
  /** Fixed drawer grouping; existing World Rules migrate to `rule`. */
  section: WorldPieceSection;
  /** Optional, author-owned type from the section-scoped suggestion catalogue. */
  type: string | null;
  category: string | null;
  behavior: string | null;
  usability: string | null;
  danger: string | null;
  isFavorite: boolean;
  extraNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean; // Added for conflict resolution (tombstones)
  deletedAt: Date | null; // Added for conflict resolution (tombstones)
}

/** Public product name. The legacy technical name remains during the compatibility migration. */
export type WorldPiece = WorldRule;
