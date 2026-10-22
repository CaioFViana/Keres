import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies RouteStep operations received from the server to the local table. */
export class RouteStepClientSyncHandler extends TableClientSyncHandler<typeof schema.routeSteps> {
  readonly entityName = 'RouteStep';
  protected readonly table = schema.routeSteps;
}
