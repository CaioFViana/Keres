export interface Chapter {
  id: string;
  storyId: string;
  name: string;
  index: number;
  /** Place among the container's rows; `index` is derived from it (see `rules/rank.ts`). */
  rank: string;
  summary: string | null;
  isFavorite: boolean;
  extraNotes: string | null;
  /** The Arc this container belongs to; null until a default arc is assigned. */
  arcId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean; // Added for conflict resolution (tombstones)
  deletedAt: Date | null; // Added for conflict resolution (tombstones)
}
