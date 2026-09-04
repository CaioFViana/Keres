import { OperationLogEntityType } from '../metadata/OperationLogEntityType';
import type { EntitySolverContext } from './contracts';
import { resolveEntityReference } from './EntityReferenceResolver';

const EFFECT_TYPE_LABEL_KEYS: Record<string, string> = {
  itemGrant: 'effect_item_grant',
  itemTake: 'effect_item_take',
  triggerSet: 'effect_trigger_set',
  triggerUnset: 'effect_trigger_unset',
};

const stringValue = (row: Record<string, unknown> | undefined, field: string) => {
  const value = row?.[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const numberValue = (row: Record<string, unknown> | undefined, field: string) => {
  const value = row?.[field];
  return typeof value === 'number' ? value : undefined;
};

const named = (type: string, name: string | undefined) => (name ? `${type} - ${name}` : type);

/**
 * Rich operation-log names whose identity is composed from several rows. The host only provides
 * reads and translations, so Admin and client keep identical wording without sharing persistence.
 */
export async function resolveAdvancedOperationLogEntityName(
  context: EntitySolverContext,
  entityType: OperationLogEntityType,
  entityId: string,
): Promise<string | undefined> {
  switch (entityType) {
    case OperationLogEntityType.SeeAlsoRelation: {
      const row = await context.read(entityType, entityId);
      if (!row) return context.translate('see_also_relation');
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
      return named(
        context.translate('see_also_relation'),
        `${first.name ?? context.translate('unknown_entity')} (${first.type ?? context.translate('unknown_entity_type')}) - ${second.name ?? context.translate('unknown_entity')} (${second.type ?? context.translate('unknown_entity_type')})`,
      );
    }
    case OperationLogEntityType.Comment: {
      const row = await context.read(entityType, entityId);
      if (!row) return context.translate('comment');
      const target = await resolveEntityReference(
        context,
        stringValue(row, 'entityType') as OperationLogEntityType,
        stringValue(row, 'entityId') ?? '',
      );
      const field = stringValue(row, 'fieldId')
        ? await context.read(OperationLogEntityType.StorySchemaField, stringValue(row, 'fieldId')!)
        : undefined;
      const comment = stringValue(row, 'commentText') ?? '';
      const snippet = comment.length > 60 ? `${comment.slice(0, 60)}...` : comment;
      const fieldLabel = stringValue(field, 'name') ?? stringValue(row, 'fieldKey') ?? '';
      return named(
        context.translate('comment'),
        `${target.name ?? context.translate('unknown_entity')} (${target.type ?? context.translate('unknown_entity_type')}) - ${fieldLabel}: "${snippet}"`,
      );
    }
    case OperationLogEntityType.ChoiceCheckGroup: {
      const row = await context.read(entityType, entityId);
      const choice = row
        ? await context.read(OperationLogEntityType.Choice, stringValue(row, 'choiceId') ?? '')
        : undefined;
      return named(
        context.translate('choice_check_group'),
        stringValue(choice, 'text') ?? context.translate('unknown_choice'),
      );
    }
    case OperationLogEntityType.ChoiceCheck: {
      const row = await context.read(entityType, entityId);
      const group = row
        ? await context.read(
            OperationLogEntityType.ChoiceCheckGroup,
            stringValue(row, 'groupId') ?? '',
          )
        : undefined;
      const choice = group
        ? await context.read(OperationLogEntityType.Choice, stringValue(group, 'choiceId') ?? '')
        : undefined;
      return named(
        context.translate('choice_check'),
        stringValue(choice, 'text') ?? context.translate('unknown_choice'),
      );
    }
    case OperationLogEntityType.Effect: {
      const row = await context.read(entityType, entityId);
      if (!row) return context.translate('effect');
      const effectType = stringValue(row, 'effectType') ?? '';
      const item = await context.read(
        OperationLogEntityType.Item,
        stringValue(row, 'itemId') ?? '',
      );
      const target =
        effectType === 'itemGrant' || effectType === 'itemTake'
          ? (stringValue(item, 'name') ?? context.translate('unknown_item'))
          : (stringValue(row, 'triggerName') ?? context.translate('unknown_trigger'));
      return named(
        context.translate('effect'),
        `${context.translate(EFFECT_TYPE_LABEL_KEYS[effectType] ?? effectType)}: ${target}`,
      );
    }
    case OperationLogEntityType.Stat:
      return named(
        context.translate('stat'),
        stringValue(await context.read(entityType, entityId), 'name'),
      );
    case OperationLogEntityType.Mode: {
      const row = await context.read(entityType, entityId);
      const owner = row
        ? await context.read(
            OperationLogEntityType.Character,
            stringValue(row, 'characterId') ?? '',
          )
        : undefined;
      return named(
        context.translate('mode'),
        row
          ? context.translate('mode_of_character', {
              modename: stringValue(row, 'name') ?? '',
              charactername: stringValue(owner, 'name') ?? context.translate('unknown_character'),
            })
          : undefined,
      );
    }
    case OperationLogEntityType.StatStrength: {
      const row = await context.read(entityType, entityId);
      if (!row) return context.translate('stat_strength');
      const statId = stringValue(row, 'statId');
      const stat = statId ? await context.read(OperationLogEntityType.Stat, statId) : undefined;
      const ladder = statId
        ? context.translate('stat_ladder_of_stat', {
            statname: stringValue(stat, 'name') ?? context.translate('unknown_stat'),
          })
        : context.translate('stat_ladder_story_default');
      return named(
        context.translate('stat_strength'),
        `${ladder} - ${stringValue(row, 'label') ?? ''} (${numberValue(row, 'minValue') ?? ''})`,
      );
    }
    case OperationLogEntityType.StatRelation: {
      const row = await context.read(entityType, entityId);
      if (!row) return context.translate('stat_relation');
      const [stat, owner, mode] = await Promise.all([
        context.read(OperationLogEntityType.Stat, stringValue(row, 'statId') ?? ''),
        context.read(OperationLogEntityType.Character, stringValue(row, 'characterId') ?? ''),
        stringValue(row, 'modeId')
          ? context.read(OperationLogEntityType.Mode, stringValue(row, 'modeId')!)
          : undefined,
      ]);
      const ownerName = stringValue(mode, 'name')
        ? `${stringValue(owner, 'name') ?? context.translate('unknown_character')} · ${stringValue(mode, 'name')}`
        : (stringValue(owner, 'name') ?? context.translate('unknown_character'));
      return named(
        context.translate('stat_relation'),
        `${context.translate('stat_value_of_entity', {
          statname: stringValue(stat, 'name') ?? context.translate('unknown_stat'),
          entityname: ownerName,
        })}: ${numberValue(row, 'value') ?? ''}`,
      );
    }
    case OperationLogEntityType.ChapterAnchor: {
      const row = await context.read(entityType, entityId);
      if (!row) return context.translate('chapter_anchor');
      const [chapter, scene] = await Promise.all([
        context.read(OperationLogEntityType.Chapter, stringValue(row, 'chapterId') ?? ''),
        context.read(OperationLogEntityType.Scene, stringValue(row, 'startSceneId') ?? ''),
      ]);
      return named(
        context.translate('chapter_anchor'),
        `${stringValue(chapter, 'name') ?? context.translate('unknown_chapter')} · ${stringValue(scene, 'name') ?? context.translate('unknown_scene')}`,
      );
    }
    case OperationLogEntityType.StoryCalendar:
      return named(
        context.translate('calendar'),
        stringValue(await context.read(entityType, entityId), 'name'),
      );
    default:
      return undefined;
  }
}
