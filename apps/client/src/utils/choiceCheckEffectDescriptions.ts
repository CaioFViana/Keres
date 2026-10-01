import type { TFunction } from 'i18next';
import {
  describeChoiceCheck as describeSharedChoiceCheck,
  describeEffect as describeSharedEffect,
  type AnnotationCheck,
  type AnnotationEffect,
  type ChoiceAnnotationFormatter,
  type ChoiceAnnotationLabelName,
} from '@keres/shared';
import type { ChoiceCheck } from '@keres/shared/entities/ChoiceCheck';
import type { Effect } from '@keres/shared/entities/Effect';

/** Shared sentence names to the client catalog keys carrying their templates. */
export const CHOICE_ANNOTATION_LABEL_KEYS: Record<ChoiceAnnotationLabelName, string> = {
  checkPrefixBlock: 'check_condition_prefix_block',
  checkPrefixEnable: 'check_condition_prefix_enable',
  checkSceneCount: 'check_condition_scene_count',
  checkInventoryHas: 'check_condition_inventory_has',
  checkInventoryLacks: 'check_condition_inventory_lacks',
  checkTriggerSet: 'check_condition_trigger_set',
  checkTriggerUnset: 'check_condition_trigger_unset',
  effectItemGrant: 'effect_description_item_grant',
  effectItemTake: 'effect_description_item_take',
  effectTriggerSet: 'effect_description_trigger_set',
  effectTriggerUnset: 'effect_description_trigger_unset',
  groupCombinatorAnd: 'check_group_combinator_and_label',
  groupCombinatorOr: 'check_group_combinator_or_label',
  effectsTitle: 'effects_title',
  notApplicable: 'common_na',
};

export function choiceAnnotationFormatterFromT(t: TFunction): ChoiceAnnotationFormatter {
  return (name, params = {}) => t(CHOICE_ANNOTATION_LABEL_KEYS[name], params);
}

/**
 * One check as a sentence, through the shared describer the manuscript pipeline also
 * uses - a choice never reads one way on screen and another on paper.
 */
export function describeChoiceCheck(
  check: ChoiceCheck | AnnotationCheck,
  sceneNamesById: Record<string, string>,
  itemNamesById: Record<string, string>,
  t: TFunction,
): string {
  return describeSharedChoiceCheck(
    check,
    sceneNamesById,
    itemNamesById,
    choiceAnnotationFormatterFromT(t),
  );
}

/** One effect as a sentence; '' when the effect type is unknown to this build. */
export function describeEffect(
  effect: Effect | AnnotationEffect,
  itemNamesById: Record<string, string>,
  t: TFunction,
): string {
  return describeSharedEffect(effect, itemNamesById, choiceAnnotationFormatterFromT(t));
}
