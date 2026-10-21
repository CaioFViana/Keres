import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies ChoiceCheckGroup operations received from the server to the local table. */
export class ChoiceCheckGroupClientSyncHandler extends TableClientSyncHandler<
  typeof schema.choiceCheckGroups
> {
  readonly entityName = 'ChoiceCheckGroup';
  protected readonly table = schema.choiceCheckGroups;
}
