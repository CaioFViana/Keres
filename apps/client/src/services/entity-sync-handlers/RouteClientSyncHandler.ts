import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies Route operations received from the server to the local table. */
export class RouteClientSyncHandler extends TableClientSyncHandler<typeof schema.routes> {
  readonly entityName = 'Route';
  protected readonly table = schema.routes;
}
