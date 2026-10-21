import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies Choice operations received from the server to the local table. */
export class ChoiceClientSyncHandler extends TableClientSyncHandler<typeof schema.choices> {
  readonly entityName = 'Choice';
  protected readonly table = schema.choices;
}
