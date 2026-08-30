export interface Scene {
  id: string;
  storyId: string;
  /** Null when the scene belongs to no chapter — a fragment, a study, a note with scenes. */
  chapterId: string | null;
  /** Null when the scene happens nowhere in particular - an era, a rumour, a war. */
  locationId: string | null;
  name: string;
  index: number;
  summary: string | null;
  gap: number | null;
  gapType: string | null;
  duration: number | null;
  durationType: string | null;
  isStart: boolean;
  isFinish: boolean;

  isFavorite: boolean;
  extraNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean; // Added for conflict resolution (tombstones)
  deletedAt: Date | null; // Added for conflict resolution (tombstones)
}
