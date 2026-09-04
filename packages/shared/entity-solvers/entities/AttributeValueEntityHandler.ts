import { AttributeType } from '../../metadata/AttributeType';
import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { decodeAttributeValue } from '../../utils/attributeValueCodec';
import { resolveEntityReference } from '../EntityReferenceResolver';
import type { EntityDomainHandler } from './contracts';
import { displayField } from './displayName';

const stringValue = (row: Record<string, unknown> | undefined, field: string) => {
  const value = row?.[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for an entity's value in a custom-attribute field. */
export const attributeValueEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.AttributeValue,
  displayName: displayField('value'),
  referenceFields: { fieldId: OperationLogEntityType.StorySchemaField },
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.AttributeValue, entityId);
    if (!row) return { name: undefined, type: context.translate('custom_attribute_value') };
    const [field, owner] = await Promise.all([
      context.read(OperationLogEntityType.StorySchemaField, stringValue(row, 'fieldId') ?? ''),
      resolveEntityReference(
        context,
        stringValue(row, 'entityType') as OperationLogEntityType,
        stringValue(row, 'entityId') ?? '',
      ),
    ]);
    const rawValue = typeof row.value === 'string' || row.value === null ? row.value : undefined;
    const decodedValue = field
      ? decodeAttributeValue(field.type as AttributeType, rawValue)
      : rawValue;
    const targetEntityType = stringValue(field, 'targetEntityType');
    const entityReference =
      field?.type === AttributeType.ENTITY && targetEntityType && typeof decodedValue === 'string'
        ? await resolveEntityReference(
            context,
            targetEntityType as OperationLogEntityType,
            decodedValue,
          )
        : undefined;
    const value =
      decodedValue === null || decodedValue === undefined
        ? context.translate('common_na')
        : (entityReference?.name ??
          (Array.isArray(decodedValue) ? decodedValue.join(', ') : String(decodedValue)));
    return {
      name: context.translate('attribute_value_attributed_to_entity', {
        fieldname: stringValue(field, 'name') ?? context.translate('unknown_attribute'),
        value,
        entityname: owner.name ?? context.translate('unknown_entity'),
        entitytype: owner.type ?? context.translate('unknown_entity_type'),
      }),
      type: context.translate('custom_attribute_value'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await attributeValueEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
