import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { searchField } from './advancedSearch';
import type { EntityDomainHandler } from './contracts';
import { displayField } from './displayName';

const nameOf = (row: Record<string, unknown> | undefined) => {
  const value = row?.name;
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for a Plot. */
export const plotEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.Plot,
  displayName: displayField('name'),
  help: {
    source: 'plots',
    fields: ['name', 'details', 'note'],
  },
  advancedSearch: [searchField('name', 'field_name'), searchField('details', 'field_details')],
  summarizePreview(row) {
    return {
      title: nameOf(row) ?? '',
      primaryDetail: typeof row.details === 'string' ? row.details : null,
      secondaryDetail: null,
    };
  },
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.Plot, entityId);
    return {
      name: nameOf(row) ?? entityId,
      type: context.translate('plots_title'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await plotEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
