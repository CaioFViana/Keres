import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies LocationMap documents received from the server to the local SQLite store. */
export class LocationMapClientSyncHandler extends TableClientSyncHandler<
  typeof schema.locationMaps
> {
  readonly entityName = 'LocationMap';
  protected readonly table = schema.locationMaps;
  protected override readonly behavior = {
    stampStoryId: { create: true, update: true, delete: true },
    updateOnlyHeldRows: true,
  };
}
