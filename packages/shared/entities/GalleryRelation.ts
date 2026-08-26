import type { GalleryOwnerEntity } from '../schemas/GallerySchemas';

/**
 * A link between a media file and an entity of the story.
 *
 * The relation is N:N both ways: an entity can have several media files and the same media file
 * can appear on several entities.
 */
export interface GalleryRelation {
  id: string;
  storyId: string;
  galleryId: string;
  ownerId: string;
  ownerType: GalleryOwnerEntity;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
