import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies ItemJourney operations received from the server to the local table. */
export class ItemJourneyClientSyncHandler extends TableClientSyncHandler<
  typeof schema.itemJourneys
> {
  readonly entityName = 'ItemJourney';
  protected readonly table = schema.itemJourneys;
}
