import type { ArcMedium } from '../metadata/ArcMedium';
import type { StoryVocabulary } from './Story';

/**
 * An editorial book/volume/phase inside one Story. The Story remains the universe: world,
 * calendar, vocabulary, permissions and sync are shared. An Arc is applied only to Chapter/Event
 * rows; other entities inherit or derive appearance from those containers.
 */
export interface StoryArc {
  id: string;
  storyId: string;
  title: string;
  description: string | null;
  sortOrder: number;
  color: string | null;
  icon: string | null;
  /** `null` means inherit the Story theme. */
  themeOverride: string | null;
  /** The form of the work; an output profile, never a rule about the data (`metadata/ArcMedium.ts`). */
  medium: ArcMedium;
  /** Terms this Arc overrides; `null` inherits the Story's, then the medium's. */
  vocabulary: StoryVocabulary | null;
  /** Credit for this work; `null` falls back to `Story.author`, then to the user's handle. */
  author: string | null;
  /** Gallery medium used as this work's cover; a row-level link, never part of the Gallery. */
  coverGalleryId: string | null;
  /** The migration/create arc. It cannot be deleted while it is the only destination. */
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
