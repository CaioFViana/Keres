import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies Note operations received from the server to the local table. */
export class NoteClientSyncHandler extends TableClientSyncHandler<typeof schema.notes> {
  readonly entityName = 'Note';
  protected readonly table = schema.notes;
  protected override readonly behavior = {
    stampStoryId: { create: true, update: true, delete: true },
  };
}
