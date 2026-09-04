import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import type { EntityDomainHandler } from './contracts';

const nameOf = (row: Record<string, unknown> | undefined) => {
  const value = row?.name;
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for a directional or containment relation between Locations. */
export const locationRelationEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.LocationRelation,
  exportCollection: 'locationRelations',
  exportReferences: [
    { field: 'locationAId', targetEntityType: OperationLogEntityType.Location, required: true },
    { field: 'locationBId', targetEntityType: OperationLogEntityType.Location, required: true },
  ],
  isConflictRelation: true,
  referenceFields: {
    locationAId: OperationLogEntityType.Location,
    locationBId: OperationLogEntityType.Location,
  },
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.LocationRelation, entityId);
    if (!row) return { name: undefined, type: context.translate('location_relation') };
    const [first, second] = await Promise.all([
      context.read(
        OperationLogEntityType.Location,
        typeof row.locationAId === 'string' ? row.locationAId : '',
      ),
      context.read(
        OperationLogEntityType.Location,
        typeof row.locationBId === 'string' ? row.locationBId : '',
      ),
    ]);
    const firstName = nameOf(first) ?? context.translate('unknown_location');
    const secondName = nameOf(second) ?? context.translate('unknown_location');
    return {
      name:
        row.relationType === 'contains'
          ? context.translate('location_contains_location', {
              parentName: firstName,
              childName: secondName,
            })
          : context.translate('location_connected_to_location', {
              locationAName: firstName,
              locationBName: secondName,
            }),
      type: context.translate('location_relation'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await locationRelationEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
