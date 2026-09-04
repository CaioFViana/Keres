import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import type { EntityDomainHandler } from './contracts';

const textOf = (row: Record<string, unknown> | undefined) =>
  typeof row?.text === 'string' && row.text.trim() ? row.text : undefined;

/** Presentation metadata for the check group belonging to a choice. */
export const choiceCheckGroupEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.ChoiceCheckGroup,
  exportCollection: 'choiceCheckGroups',
  exportReferences: [
    { field: 'choiceId', targetEntityType: OperationLogEntityType.Choice, required: true },
  ],
  referenceFields: { choiceId: OperationLogEntityType.Choice },
  async resolveReference(context, entityId) {
    const group = await context.read(OperationLogEntityType.ChoiceCheckGroup, entityId);
    const choice = group
      ? await context.read(
          OperationLogEntityType.Choice,
          typeof group.choiceId === 'string' ? group.choiceId : '',
        )
      : undefined;
    return {
      name: textOf(choice) ?? context.translate('unknown_choice'),
      type: context.translate('choice_check_group'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await choiceCheckGroupEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
