import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies Location operations received from the server to the local table. */
export class LocationClientSyncHandler extends TableClientSyncHandler<typeof schema.locations> {
  readonly entityName = 'Location';
  protected readonly table = schema.locations;
  protected override readonly behavior = {
    stampStoryId: { create: true, update: true, delete: true },
  };
}
