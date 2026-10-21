import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies NoteRelation operations received from the server to the local table. */
export class NoteRelationClientSyncHandler extends TableClientSyncHandler<
  typeof schema.noteRelations
> {
  readonly entityName = 'NoteRelation';
  protected readonly table = schema.noteRelations;
  protected override readonly behavior = {
    stampStoryId: { create: true, update: true, delete: true },
  };
}
