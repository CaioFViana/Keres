import * as schema from '@/src/db/schema';
import { TableClientSyncHandler } from './TableClientSyncHandler';

/** Applies AttributeValue operations received from the server to the local table. */
export class AttributeValueClientSyncHandler extends TableClientSyncHandler<
  typeof schema.attributeValues
> {
  readonly entityName = 'AttributeValue';
  protected readonly table = schema.attributeValues;
  protected override readonly behavior = { stampStoryId: { create: true } };
}
