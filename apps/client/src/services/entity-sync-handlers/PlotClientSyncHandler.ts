import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies Plot operations received from the server to the local table. */
export class PlotClientSyncHandler extends TableClientSyncHandler<typeof schema.plots> {
  readonly entityName = 'Plot';
  protected readonly table = schema.plots;
}
