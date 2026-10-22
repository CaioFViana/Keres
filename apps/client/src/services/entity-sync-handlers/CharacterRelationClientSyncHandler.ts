import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/**
 * Mirrors the server's character relations. The server refuses a second relation of one pair
 * (`duplicate`), and the device that made it folds its own row into the first: a relation
 * arriving here is one the server holds, never one to judge.
 */
export class CharacterRelationClientSyncHandler extends TableClientSyncHandler<
  typeof schema.characterRelations
> {
  readonly entityName = 'CharacterRelation';
  protected readonly table = schema.characterRelations;
  protected override readonly behavior = {
    stampStoryId: { create: true, update: true, delete: true },
    updateOnlyHeldRows: true,
  };
}
