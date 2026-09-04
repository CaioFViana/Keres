import type { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import type { EntityDomainHandler } from './contracts';
import { displayField } from './displayName';

export function createSimpleEntityHandler(config: {
  entityType: OperationLogEntityType;
  displayField: string;
  help?: EntityDomainHandler['help'];
  referenceFields?: EntityDomainHandler['referenceFields'];
  conflictLabelKey?: string;
  exportCollection?: string;
  exportReferences?: EntityDomainHandler['exportReferences'];
  previewDetailsFields?: readonly [string, string?];
  advancedSearch?: EntityDomainHandler['advancedSearch'];
}): EntityDomainHandler {
  const resolveReference: NonNullable<EntityDomainHandler['resolveReference']> = async (
    context,
    entityId,
  ) => {
    const row = await context.read(config.entityType, entityId);
    const value = row?.[config.displayField];
    return {
      name: typeof value === 'string' && value.trim() ? value : undefined,
      type: await context.noun(config.entityType),
    };
  };
  return {
    entityType: config.entityType,
    help: config.help,
    referenceFields: config.referenceFields,
    conflictLabelKey: config.conflictLabelKey,
    exportCollection: config.exportCollection,
    exportReferences: config.exportReferences,
    displayName: displayField(config.displayField),
    advancedSearch: config.advancedSearch,
    summarizePreview: config.previewDetailsFields
      ? (row) => ({
          title: stringValue(row[config.displayField]) ?? '',
          primaryDetail: stringValue(row[config.previewDetailsFields![0]]),
          secondaryDetail: config.previewDetailsFields![1]
            ? stringValue(row[config.previewDetailsFields![1]])
            : null,
        })
      : undefined,
    resolveReference,
    async resolveOperationLogName(context, entityId) {
      const reference = await resolveReference(context, entityId);
      return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
    },
  };
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
