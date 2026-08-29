export type FavoriteBehavior = 'global' | 'individual' | 'individual_public';
/** Notation for the stat system's values: letters (F, D, C…) or the plain number. */
export type StatNotation = 'letter' | 'number';

export interface Story {
  id: string;
  userId: string; // ID of the user who owns this story
  title: string;
  type: 'linear' | 'branching';
  description: string | null;
  genre: string | null;
  language: string | null;
  // Free-text credit for who wrote the story, separate from `userId` (the account that
  // owns/manages it in the app) - e.g. the original author for an imported public-domain tale.
  author: string | null;
  isFavorite: boolean;
  favoriteBehavior: FavoriteBehavior;
  extraNotes: string | null;
  theme: string | null;
  /** The day the first scene falls on, or `null` when the story states no absolute date. */
  timelineEpochDay: number | null;
  /** Seconds after the beginning of the epoch day; `null` follows a missing epoch day. */
  timelineEpochSeconds: number | null;
  normalizeSceneTiming: boolean;
  // Only relevant (and only shown in the UI) for stories linked to a server - local stories only
  // have the 'owner' role, so the reader/writer distinction does not exist for them.
  allowReaderComments: boolean;
  /**
   * When on, Story Analysis also reports elements that exist but are not referenced anywhere - a
   * location in no scene, an unused tag. Off by default: whether an element has to be used is the
   * writer's judgement, not the app's.
   */
  completenessChecks: boolean;
  /**
   * When on, entity names found in this story's own text render as links to those entities.
   * Purely a reading convenience: it renders and navigates, and never writes a relation.
   */
  autoLinkMentions: boolean;
  /** Turns on this story's stat system (stats, ladders, radar). */
  statSystem: boolean;
  /** How stat values are displayed. Only matters with `statSystem` on. */
  statNotation: StatNotation;
  // Optional: ID of the server this story is synchronized with.
  // This ID references an entry in the local 'Server' entity.
  // If null or undefined, the story is considered offline-only.
  serverId: string | null;
  lastOperationLog: number;
  lastServerSyncedLog: number;

  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean; // Added for conflict resolution (tombstones)
  deletedAt: Date | null; // Added for conflict resolution (tombstones)
}
