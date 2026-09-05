import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { resolveCompactEntityLabel } from '../compactEntityName';
import { getEntityDomainHandler } from './EntityRegistry';
import type { EntityDomainHandler } from './contracts';

const stringValue = (row: Record<string, unknown> | undefined, field: string) => {
  const value = row?.[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for a favorite marker attached to another entity. */
export const favoriteEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.Favorite,
  exportCollection: 'favorites',
  conflictReferences: [{ kind: 'dynamic', idField: 'entityId', typeField: 'entityType' }],
  async resolveCompactName(context, entityId) {
    const row = await context.read(OperationLogEntityType.Favorite, entityId);
    if (!row) return undefined;
    const targetType = stringValue(row, 'entityType') ?? '?';
    const target = await resolveCompactEntityLabel(
      context,
      targetType as OperationLogEntityType,
      stringValue(row, 'entityId') ?? '',
    );
    return `★ ${targetType}:${target}`;
  },
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.Favorite, entityId);
    const targetType = stringValue(row, 'entityType') as OperationLogEntityType;
    const target = row
      ? await getEntityDomainHandler(targetType)?.resolveOperationLogName?.(
          context,
          stringValue(row, 'entityId') ?? '',
        )
      : undefined;
    return {
      name: target,
      type: context.translate('favorite'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await favoriteEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
