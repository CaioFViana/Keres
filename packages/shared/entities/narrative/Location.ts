/**
 * Whether a place is indoors or out: what a screenplay writes in a scene heading (`INT.`, `EXT.`,
 * `INT./EXT.`). Optional: a place with none (a void, an abstract stage) simply gets no prefix.
 */
export const LOCATION_INT_EXT = ['interior', 'exterior', 'both'] as const;

export type LocationIntExt = (typeof LOCATION_INT_EXT)[number];

export interface Location {
  id: string;
  storyId: string;
  name: string;
  description: string | null;
  climate: string | null;
  culture: string | null;
  politics: string | null;
  /** Indoors, outdoors or both; `null` when it does not apply. Used by the screenplay export. */
  intExt: LocationIntExt | null;
  isFavorite: boolean;
  extraNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean; // Added for conflict resolution (tombstones)
  deletedAt: Date | null; // Added for conflict resolution (tombstones)
}
