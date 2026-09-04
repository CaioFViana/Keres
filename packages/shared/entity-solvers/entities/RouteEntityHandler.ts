import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { searchField } from './advancedSearch';
import type { EntityDomainHandler } from './contracts';

const nameOf = (row: Record<string, unknown> | undefined) => {
  const value = row?.name;
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for a Route. Its steps own the scene and choice references. */
export const routeEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.Route,
  help: {
    source: 'routes',
    fields: ['name', 'details'],
  },
  advancedSearch: [searchField('name', 'field_name'), searchField('details', 'field_details')],
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.Route, entityId);
    return { name: nameOf(row), type: await context.noun(OperationLogEntityType.Route) };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await routeEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
