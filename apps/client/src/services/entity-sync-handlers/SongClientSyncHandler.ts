import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies Song operations received from the server to the local table. */
export class SongClientSyncHandler extends TableClientSyncHandler<typeof schema.songs> {
  readonly entityName = 'Song';
  protected readonly table = schema.songs;
}
