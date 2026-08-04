export interface Tier {
  id: string;
  name: string;
  isDefault: boolean;
  /** Every `max*` field is `null` when unlimited. */
  maxStories: number | null;
  maxEntitiesPerStory: number | null;
  maxEntitiesTotal: number | null;
  maxStorageBytesPerStory: number | null;
  maxStorageBytesTotal: number | null;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt: Date | null;
}
