import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { resolveCompactEntityLabel } from '../compactEntityName';
import type { EntityDomainHandler } from './contracts';

const nameOf = (row: Record<string, unknown> | undefined) => {
  const value = row?.name;
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for a Character appearing in a Scene. */
export const characterSceneEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.CharacterScene,
  exportCollection: 'characterScenes',
  exportReferences: [
    { field: 'characterId', targetEntityType: OperationLogEntityType.Character, required: true },
    { field: 'sceneId', targetEntityType: OperationLogEntityType.Scene, required: true },
  ],
  conflictLabelKey: 'character_scene_relation',
  isConflictRelation: true,
  referenceFields: {
    characterId: OperationLogEntityType.Character,
    sceneId: OperationLogEntityType.Scene,
  },
  summarizeConflictRelation(row, context) {
    return {
      title: context.translate('character_scene_relation'),
      detail: `${context.nameOf(OperationLogEntityType.Character, row.characterId)} - ${context.nameOf(
        OperationLogEntityType.Scene,
        row.sceneId,
      )}`,
    };
  },
  async resolveCompactName(context, entityId) {
    const row = await context.read(OperationLogEntityType.CharacterScene, entityId);
    if (!row) return undefined;
    const [character, scene] = await Promise.all([
      resolveCompactEntityLabel(
        context,
        OperationLogEntityType.Character,
        typeof row.characterId === 'string' ? row.characterId : '',
      ),
      resolveCompactEntityLabel(
        context,
        OperationLogEntityType.Scene,
        typeof row.sceneId === 'string' ? row.sceneId : '',
      ),
    ]);
    return `${character} @ ${scene}`;
  },
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.CharacterScene, entityId);
    if (!row) return { name: undefined, type: context.translate('character_scene_relation') };
    const [character, scene] = await Promise.all([
      context.read(
        OperationLogEntityType.Character,
        typeof row.characterId === 'string' ? row.characterId : '',
      ),
      context.read(
        OperationLogEntityType.Scene,
        typeof row.sceneId === 'string' ? row.sceneId : '',
      ),
    ]);
    return {
      name: context.translate('character_attributed_to_scene', {
        characterName: nameOf(character) ?? context.translate('unknown_character'),
        sceneName: nameOf(scene) ?? (await context.unknownNoun(OperationLogEntityType.Scene)),
      }),
      type: context.translate('character_scene_relation'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await characterSceneEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
