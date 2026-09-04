import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import type { EntitySolverContext } from '../contracts';
import { resolveEntityReference } from '../EntityReferenceResolver';
import type { EntityDomainHandler } from './contracts';

const stringValue = (row: Record<string, unknown>, field: string) => {
  const value = row[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const resolveName = async (context: EntitySolverContext, entityId: string) => {
  const row = await context.read(OperationLogEntityType.SeeAlsoRelation, entityId);
  if (!row) return undefined;
  const [first, second] = await Promise.all([
    resolveEntityReference(
      context,
      stringValue(row, 'entityAType') as OperationLogEntityType,
      stringValue(row, 'entityAId') ?? '',
    ),
    resolveEntityReference(
      context,
      stringValue(row, 'entityBType') as OperationLogEntityType,
      stringValue(row, 'entityBId') ?? '',
    ),
  ]);
  return `${first.name ?? context.translate('unknown_entity')} (${first.type ?? context.translate('unknown_entity_type')}) - ${second.name ?? context.translate('unknown_entity')} (${second.type ?? context.translate('unknown_entity_type')})`;
};

/** Presentation metadata for a bidirectional “see also” relation. */
export const seeAlsoRelationEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.SeeAlsoRelation,
  exportCollection: 'seeAlsoRelations',
  isConflictRelation: true,
  conflictReferences: [
    { kind: 'dynamic', idField: 'entityAId', typeField: 'entityAType' },
    { kind: 'dynamic', idField: 'entityBId', typeField: 'entityBType' },
  ],
  async resolveReference(context, entityId) {
    return {
      name: await resolveName(context, entityId),
      type: context.translate('see_also_relation'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const name = await resolveName(context, entityId);
    const type = context.translate('see_also_relation');
    return name ? `${type} - ${name}` : type;
  },
};
