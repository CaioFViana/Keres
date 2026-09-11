import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { resolveCompactEntityLabel } from '../compactEntityName';
import type { EntityDomainHandler } from './contracts';

const textOf = (row: Record<string, unknown> | undefined) =>
  typeof row?.text === 'string' && row.text.trim() ? row.text : undefined;

/** Presentation metadata for an individual check within a choice check group. */
export const choiceCheckEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.ChoiceCheck,
  exportCollection: 'choiceChecks',
  exportReferences: [
    {
      field: 'groupId',
      targetEntityType: OperationLogEntityType.ChoiceCheckGroup,
      required: true,
    },
    { field: 'sceneId', targetEntityType: OperationLogEntityType.Scene, required: false },
    { field: 'itemId', targetEntityType: OperationLogEntityType.Item, required: false },
  ],
  referenceFields: {
    groupId: OperationLogEntityType.ChoiceCheckGroup,
    itemId: OperationLogEntityType.Item,
    sceneId: OperationLogEntityType.Scene,
  },
  async resolveCompactName(context, entityId) {
    const row = await context.read(OperationLogEntityType.ChoiceCheck, entityId);
    if (!row) return undefined;
    const group = await context.read(
      OperationLogEntityType.ChoiceCheckGroup,
      typeof row.groupId === 'string' ? row.groupId : '',
    );
    const choiceId = typeof group?.choiceId === 'string' ? group.choiceId : undefined;
    const choice = choiceId
      ? await resolveCompactEntityLabel(context, OperationLogEntityType.Choice, choiceId)
      : undefined;
    const result = [choice, row.mode, row.type]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' · ');
    return result || undefined;
  },
  async resolveReference(context, entityId) {
    const check = await context.read(OperationLogEntityType.ChoiceCheck, entityId);
    const group = check
      ? await context.read(
          OperationLogEntityType.ChoiceCheckGroup,
          typeof check.groupId === 'string' ? check.groupId : '',
        )
      : undefined;
    const choice = group
      ? await context.read(
          OperationLogEntityType.Choice,
          typeof group.choiceId === 'string' ? group.choiceId : '',
        )
      : undefined;
    return {
      name: textOf(choice) ?? context.translate('unknown_choice'),
      type: context.translate('choice_check'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await choiceCheckEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
