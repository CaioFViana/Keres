import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { resolveEntityReference } from '../EntityReferenceResolver';
import type { EntityDomainHandler } from './contracts';

const stringValue = (row: Record<string, unknown>, field: string) => {
  const value = row[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for a Note attributed to another entity. */
export const noteRelationEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.NoteRelation,
  conflictLabelKey: 'note_relation',
  isConflictRelation: true,
  conflictReferences: [{ kind: 'dynamic', idField: 'relationId', typeField: 'relationType' }],
  referenceFields: { noteId: OperationLogEntityType.Note },
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.NoteRelation, entityId);
    if (!row) return { name: undefined, type: context.translate('note_relation') };
    const [note, target] = await Promise.all([
      resolveEntityReference(
        context,
        OperationLogEntityType.Note,
        stringValue(row, 'noteId') ?? '',
      ),
      resolveEntityReference(
        context,
        stringValue(row, 'relationType') as OperationLogEntityType,
        stringValue(row, 'relationId') ?? '',
      ),
    ]);
    return {
      name: context.translate('note_attributed_to_entity_short', {
        notename: note.name ?? context.translate('unknown_note'),
        entityname: target.name ?? context.translate('unknown_entity'),
        entitytype: target.type ?? context.translate('unknown_entity_type'),
      }),
      type: context.translate('note_relation'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const row = await context.read(OperationLogEntityType.NoteRelation, entityId);
    if (!row) return context.translate('note_relation');
    const [note, target] = await Promise.all([
      resolveEntityReference(
        context,
        OperationLogEntityType.Note,
        stringValue(row, 'noteId') ?? '',
      ),
      resolveEntityReference(
        context,
        stringValue(row, 'relationType') as OperationLogEntityType,
        stringValue(row, 'relationId') ?? '',
      ),
    ]);
    return `${context.translate('note_relation')} - ${context.translate(
      'note_attributed_to_entity',
      {
        notename: note.name ?? context.translate('unknown_note'),
        entityname: target.name ?? context.translate('unknown_entity'),
        entitytype: target.type ?? context.translate('unknown_entity_type'),
      },
    )}`;
  },
};
