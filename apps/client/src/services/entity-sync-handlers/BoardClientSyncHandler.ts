import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/**
 * Boards arriving from a server. `content` travels as an object and is stored as one.
 */
export class BoardClientSyncHandler extends TableClientSyncHandler<typeof schema.boards> {
  readonly entityName = 'Board';
  protected readonly table = schema.boards;
  protected override readonly behavior = {
    stampStoryId: { create: true, update: true, delete: true },
    updateOnlyHeldRows: true,
  };
}
