import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies Item operations received from the server to the local table. */
export class ItemClientSyncHandler extends TableClientSyncHandler<typeof schema.items> {
  readonly entityName = 'Item';
  protected readonly table = schema.items;
}
