import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import type { EntityDomainHandler } from './contracts';
import { displayField } from './displayName';

const stringValue = (row: Record<string, unknown> | undefined, field: string) => {
  const value = row?.[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for a custom-attribute definition. */
export const storySchemaFieldEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.StorySchemaField,
  exportCollection: 'storySchemaFields',
  displayName: displayField('name'),
  help: {
    source: 'custom-attributes',
    fields: ['displayName', 'type', 'targetEntityType', 'required', 'defaultValue'],
  },
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.StorySchemaField, entityId);
    const entityType = stringValue(row, 'entityType');
    const ownerType = entityType
      ? await context.noun(entityType as OperationLogEntityType)
      : context.translate('unknown_entity_type');
    return {
      name: row ? `${stringValue(row, 'name') ?? ''} (${ownerType})` : undefined,
      type: context.translate('custom_attribute'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await storySchemaFieldEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
