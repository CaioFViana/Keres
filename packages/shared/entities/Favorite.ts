export type FavoriteEntityType =
  | 'Story'
  | 'Character'
  | 'Chapter'
  | 'Location'
  | 'Scene'
  | 'Note'
  | 'WorldRule'
  | 'Item'
  | 'Gallery'
  | 'Tag';

export interface Favorite {
  id: string;
  storyId: string;
  entityId: string;
  entityType: FavoriteEntityType;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
