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
  /** The migration/create arc. It cannot be deleted while it is the only destination. */
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
