import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies WorldRule operations received from the server to the local table. */
export class WorldRuleClientSyncHandler extends TableClientSyncHandler<typeof schema.worldRules> {
  readonly entityName = 'WorldRule';
  protected readonly table = schema.worldRules;
  protected override readonly behavior = {
    stampStoryId: { create: true, update: true, delete: true },
  };
}
