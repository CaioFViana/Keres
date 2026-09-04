import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { resolveEntityReference } from '../EntityReferenceResolver';
import type { EntityDomainHandler } from './contracts';

const stringValue = (row: Record<string, unknown> | undefined, field: string) => {
  const value = row?.[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for a comment made on an entity or custom field. */
export const commentEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.Comment,
  referenceFields: { fieldId: OperationLogEntityType.StorySchemaField },
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.Comment, entityId);
    if (!row) return { name: undefined, type: context.translate('comment') };
    const [target, field] = await Promise.all([
      resolveEntityReference(
        context,
        stringValue(row, 'entityType') as OperationLogEntityType,
        stringValue(row, 'entityId') ?? '',
      ),
      stringValue(row, 'fieldId')
        ? context.read(OperationLogEntityType.StorySchemaField, stringValue(row, 'fieldId')!)
        : undefined,
    ]);
    const comment = stringValue(row, 'commentText') ?? '';
    const snippet = comment.length > 60 ? `${comment.slice(0, 60)}...` : comment;
    const fieldLabel = stringValue(field, 'name') ?? stringValue(row, 'fieldKey') ?? '';
    return {
      name: `${target.name ?? context.translate('unknown_entity')} (${target.type ?? context.translate('unknown_entity_type')}) - ${fieldLabel}: "${snippet}"`,
      type: context.translate('comment'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await commentEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
