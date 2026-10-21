import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/**
 * Mirrors the server's location relations. The server refuses a second connection of one pair
 * or a second parent of one child (`duplicate`), and the device that made it folds its own row
 * into the first: a relation arriving here is one the server holds, never one to judge.
 */
export class LocationRelationClientSyncHandler extends TableClientSyncHandler<
  typeof schema.locationRelations
> {
  readonly entityName = 'LocationRelation';
  protected readonly table = schema.locationRelations;
  protected override readonly behavior = {
    stampStoryId: { create: true, update: true, delete: true },
    updateOnlyHeldRows: true,
    defaultMissingUpdatedAt: true,
  };
}
