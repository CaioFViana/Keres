import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { searchField } from './advancedSearch';
import type { EntityDomainHandler } from './contracts';

const textOf = (row: Record<string, unknown> | undefined) => {
  const value = row?.text;
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for a branching Choice and its source/destination Scenes. */
export const choiceEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.Choice,
  help: {
    source: 'choices',
    fields: ['text', 'sourceScene', 'destinationScene', 'notes', 'choiceSearch'],
  },
  referenceFields: {
    sceneId: OperationLogEntityType.Scene,
    nextSceneId: OperationLogEntityType.Scene,
  },
  advancedSearch: [
    searchField('text', 'text'),
    searchField('choiceSearch', 'choice_text_or_notes'),
  ],
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.Choice, entityId);
    return {
      name: textOf(row),
      type: await context.noun(OperationLogEntityType.Choice),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const row = await context.read(OperationLogEntityType.Choice, entityId);
    const type = await context.noun(OperationLogEntityType.Choice);
    if (!row) {
      return `${type} - ${context.translate('unknown_choice')} ${context.translate('id')}: ${entityId}`;
    }
    const sceneId = typeof row.sceneId === 'string' ? row.sceneId : '';
    const scene = await context.read(OperationLogEntityType.Scene, sceneId);
    const sceneName =
      typeof scene?.name === 'string' && scene.name.trim()
        ? scene.name
        : await context.unknownNoun(OperationLogEntityType.Scene);
    return `${type} - ${await context.fromNoun(OperationLogEntityType.Scene)}: ${sceneName} - ${textOf(row) ?? ''}`;
  },
};
