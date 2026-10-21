import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies Tag operations received from the server to the local table. */
export class TagClientSyncHandler extends TableClientSyncHandler<typeof schema.tags> {
  readonly entityName = 'Tag';
  protected readonly table = schema.tags;
  protected override readonly behavior = { stampStoryId: { create: true } };
}
