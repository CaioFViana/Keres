import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import type { EntitySolverContext } from '../contracts';
import { resolveEntityReference } from '../EntityReferenceResolver';
import type { EntityDomainHandler } from './contracts';

const stringValue = (row: Record<string, unknown>, field: string) => {
  const value = row[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const resolveName = async (context: EntitySolverContext, entityId: string) => {
  const row = await context.read(OperationLogEntityType.TagRelation, entityId);
  if (!row) return undefined;
  const [tag, target] = await Promise.all([
    resolveEntityReference(context, OperationLogEntityType.Tag, stringValue(row, 'tagId') ?? ''),
    resolveEntityReference(
      context,
      stringValue(row, 'relationType') as OperationLogEntityType,
      stringValue(row, 'relationId') ?? '',
    ),
  ]);
  return context.translate('tag_attributed_to_entity', {
    tagname: tag.name ?? context.translate('unknown_tag'),
    entityname: target.name ?? context.translate('unknown_entity'),
    entitytype: target.type ?? context.translate('unknown_entity_type'),
  });
};

/** Presentation metadata for a Tag attributed to another entity. */
export const tagRelationEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.TagRelation,
  conflictLabelKey: 'tag_relation',
  isConflictRelation: true,
  conflictReferences: [{ kind: 'dynamic', idField: 'relationId', typeField: 'relationType' }],
  referenceFields: { tagId: OperationLogEntityType.Tag },
  async resolveReference(context, entityId) {
    return {
      name: await resolveName(context, entityId),
      type: context.translate('tag_relation'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const name = await resolveName(context, entityId);
    const type = context.translate('tag_relation');
    return name ? `${type} - ${name}` : type;
  },
};
