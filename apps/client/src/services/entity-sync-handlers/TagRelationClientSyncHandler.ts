import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies the server's tag assignments, including assignments made by another collaborator. */
export class TagRelationClientSyncHandler extends TableClientSyncHandler<
  typeof schema.tagRelations
> {
  readonly entityName = 'TagRelation';
  protected readonly table = schema.tagRelations;
  protected override readonly behavior = {
    stampStoryId: { create: true, update: true, delete: true },
  };
}
