import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies Chapter operations received from the server to the local table. */
export class ChapterClientSyncHandler extends TableClientSyncHandler<typeof schema.chapters> {
  readonly entityName = 'Chapter';
  protected readonly table = schema.chapters;
  protected override readonly behavior = {
    stampStoryId: { create: true, update: true, delete: true },
  };
}
