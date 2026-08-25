import type { TFunction } from 'i18next';
import type { ChoiceCheck } from '@keres/shared/entities/ChoiceCheck';
import type { Effect } from '@keres/shared/entities/Effect';

/**
 * Readable phrases for a ChoiceCheck/Effect, shared between `ChoiceDetailScreen` (the full list, by
 * group) and the story map (`ChoiceViewScreen`, a compact summary per Choice) - a single place decides
 * how a condition or an effect becomes text, and the two never describe the same Choice in different
 * ways.
 */

function describeCheckCondition(
  check: ChoiceCheck,
  sceneNamesById: Record<string, string>,
  itemNamesById: Record<string, string>,
  t: TFunction,
): string {
  switch (check.type) {
    case 'sceneCount': {
      const sceneName = (check.sceneId && sceneNamesById[check.sceneId]) || t('common_na');
      return t('check_condition_scene_count', { scene: sceneName, count: check.minVisits ?? 1 });
    }
    case 'inventory': {
      const itemName = (check.itemId && itemNamesById[check.itemId]) || t('common_na');
      return check.itemPresence === 'lacks'
        ? t('check_condition_inventory_lacks', { item: itemName })
        : t('check_condition_inventory_has', { item: itemName });
    }
    case 'trigger': {
      const triggerName = check.triggerName || t('common_na');
      return check.triggerState === 'unset'
        ? t('check_condition_trigger_unset', { trigger: triggerName })
        : t('check_condition_trigger_set', { trigger: triggerName });
    }
    default:
      return '';
  }
}

export function describeChoiceCheck(
  check: ChoiceCheck,
  sceneNamesById: Record<string, string>,
  itemNamesById: Record<string, string>,
  t: TFunction,
): string {
  const prefix =
    check.mode === 'block' ? t('check_condition_prefix_block') : t('check_condition_prefix_enable');
  return `${prefix} ${describeCheckCondition(check, sceneNamesById, itemNamesById, t)}`;
}

export function describeEffect(
  effect: Effect,
  itemNamesById: Record<string, string>,
  t: TFunction,
): string {
  switch (effect.effectType) {
    case 'itemGrant':
      return t('effect_description_item_grant', {
        item: (effect.itemId && itemNamesById[effect.itemId]) || t('common_na'),
      });
    case 'itemTake':
      return t('effect_description_item_take', {
        item: (effect.itemId && itemNamesById[effect.itemId]) || t('common_na'),
      });
    case 'triggerSet':
      return t('effect_description_trigger_set', { trigger: effect.triggerName || t('common_na') });
    case 'triggerUnset':
      return t('effect_description_trigger_unset', {
        trigger: effect.triggerName || t('common_na'),
      });
    default:
      return '';
  }
}
