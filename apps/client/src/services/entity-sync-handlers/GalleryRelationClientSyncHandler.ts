import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies GalleryRelation operations received from the server to the local table. */
export class GalleryRelationClientSyncHandler extends TableClientSyncHandler<
  typeof schema.galleryRelations
> {
  readonly entityName = 'GalleryRelation';
  protected readonly table = schema.galleryRelations;
  protected override readonly behavior = { stampStoryId: { create: true } };
}
