/**
 * Choice check and effect sentences, shared by every manuscript producer.
 *
 * The client renders these sentences on detail screens (localized through its own
 * catalog) and the manuscript pipeline embeds them under choice blocks - on the
 * device at export time and on the API at publication time. Both producers share this
 * module so a choice can never read one way on screen and another on paper.
 *
 * Localization arrives as a formatter: the client passes one bound to its catalog, the
 * API uses the English defaults below (the same arrangement as `ManuscriptLabels`).
 * Placeholders interpolate `{{likeThis}}`.
 */

/** Every sentence template the annotations need. */
export interface ChoiceAnnotationLabels {
  checkPrefixBlock: string;
  checkPrefixEnable: string;
  checkSceneCount: string;
  checkInventoryHas: string;
  checkInventoryLacks: string;
  checkTriggerSet: string;
  checkTriggerUnset: string;
  effectItemGrant: string;
  effectItemTake: string;
  effectTriggerSet: string;
  effectTriggerUnset: string;
  groupCombinatorAnd: string;
  groupCombinatorOr: string;
  effectsTitle: string;
  notApplicable: string;
}

export type ChoiceAnnotationLabelName = keyof ChoiceAnnotationLabels;

export type ChoiceAnnotationParams = Record<string, string | number>;

/** English defaults, matching the client's check/effect strings verbatim. */
export const DEFAULT_CHOICE_ANNOTATION_LABELS: ChoiceAnnotationLabels = {
  checkPrefixBlock: 'Blocks this choice if:',
  checkPrefixEnable: 'Enables this choice if:',
  checkSceneCount: 'Scene "{{scene}}" has been visited at least {{count}} time(s)',
  checkInventoryHas: '"{{item}}" is in the inventory',
  checkInventoryLacks: '"{{item}}" is not in the inventory',
  checkTriggerSet: 'Trigger "{{trigger}}" is set',
  checkTriggerUnset: 'Trigger "{{trigger}}" is unset',
  effectItemGrant: 'Grants item "{{item}}"',
  effectItemTake: 'Takes item "{{item}}"',
  effectTriggerSet: 'Sets trigger "{{trigger}}"',
  effectTriggerUnset: 'Unsets trigger "{{trigger}}"',
  groupCombinatorAnd: 'All of the checks below must be true (AND)',
  groupCombinatorOr: 'Any of the checks below must be true (OR)',
  effectsTitle: 'Effects',
  notApplicable: 'N/A',
};

/** Formats one sentence: the client binds this to its catalog, the API takes the default. */
export type ChoiceAnnotationFormatter = (
  name: ChoiceAnnotationLabelName,
  params?: ChoiceAnnotationParams,
) => string;

export function interpolateAnnotationLabel(
  template: string,
  params: ChoiceAnnotationParams = {},
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? '' : String(value);
  });
}

export function formatDefaultChoiceAnnotationLabel(
  name: ChoiceAnnotationLabelName,
  params: ChoiceAnnotationParams = {},
): string {
  return interpolateAnnotationLabel(DEFAULT_CHOICE_ANNOTATION_LABELS[name], params);
}

/** The fields the sentences read; both the client entities and the export rows satisfy it. */
export interface AnnotationCheckGroup {
  id: string;
  choiceId: string;
  combinator: 'AND' | 'OR';
  order: number;
  isDeleted: boolean;
}

export interface AnnotationCheck {
  groupId: string;
  mode: 'block' | 'enable';
  type: 'sceneCount' | 'inventory' | 'trigger';
  order: number;
  sceneId: string | null;
  minVisits: number | null;
  itemId: string | null;
  itemPresence: 'has' | 'lacks' | null;
  triggerName: string | null;
  triggerState: 'set' | 'unset' | null;
  isDeleted: boolean;
}

export interface AnnotationEffect {
  entityType: string;
  entityId: string;
  effectType: string;
  itemId: string | null;
  triggerName: string | null;
  isDeleted: boolean;
}

function describeCheckCondition(
  check: AnnotationCheck,
  sceneNamesById: Record<string, string>,
  itemNamesById: Record<string, string>,
  format: ChoiceAnnotationFormatter,
): string {
  switch (check.type) {
    case 'sceneCount':
      return format('checkSceneCount', {
        scene: (check.sceneId && sceneNamesById[check.sceneId]) || format('notApplicable'),
        count: Math.max(check.minVisits ?? 1, 1),
      });
    case 'inventory': {
      const item = (check.itemId && itemNamesById[check.itemId]) || format('notApplicable');
      return format(check.itemPresence === 'lacks' ? 'checkInventoryLacks' : 'checkInventoryHas', {
        item,
      });
    }
    case 'trigger': {
      const trigger = check.triggerName || format('notApplicable');
      return format(check.triggerState === 'unset' ? 'checkTriggerUnset' : 'checkTriggerSet', {
        trigger,
      });
    }
    default:
      return '';
  }
}

/** One check as a sentence; '' when the check type is unknown to this build. */
export function describeChoiceCheck(
  check: AnnotationCheck,
  sceneNamesById: Record<string, string>,
  itemNamesById: Record<string, string>,
  format: ChoiceAnnotationFormatter = formatDefaultChoiceAnnotationLabel,
): string {
  const condition = describeCheckCondition(check, sceneNamesById, itemNamesById, format);
  if (!condition) return '';
  const prefix = format(check.mode === 'block' ? 'checkPrefixBlock' : 'checkPrefixEnable');
  return `${prefix} ${condition}`;
}

/** One effect as a sentence; '' when the effect type is unknown to this build. */
export function describeEffect(
  effect: AnnotationEffect,
  itemNamesById: Record<string, string>,
  format: ChoiceAnnotationFormatter = formatDefaultChoiceAnnotationLabel,
): string {
  if (effect.effectType === 'itemGrant' || effect.effectType === 'itemTake') {
    const item = (effect.itemId && itemNamesById[effect.itemId]) || format('notApplicable');
    return format(effect.effectType === 'itemGrant' ? 'effectItemGrant' : 'effectItemTake', {
      item,
    });
  }
  if (effect.effectType === 'triggerSet' || effect.effectType === 'triggerUnset') {
    const trigger = effect.triggerName || format('notApplicable');
    return format(effect.effectType === 'triggerSet' ? 'effectTriggerSet' : 'effectTriggerUnset', {
      trigger,
    });
  }
  return '';
}

export interface ChoiceAnnotationLines {
  requirements: string[];
  effects: string[];
}

export interface ChoiceAnnotationInput {
  groups: AnnotationCheckGroup[];
  checks: AnnotationCheck[];
  effects: AnnotationEffect[];
  sceneNamesById: Record<string, string>;
  itemNamesById: Record<string, string>;
  format?: ChoiceAnnotationFormatter;
}

/**
 * The manuscript's choice annotations: check groups become requirement lines, choice
 * effects become effect lines. Only choices with at least one line get an entry; group
 * headers appear only when the combinator can change the reading (several groups, or
 * several checks in one). Deleted rows are skipped and both levels sort explicitly, so
 * device rows and export rows annotate identically no matter what order they arrive in.
 */
export function describeChoiceAnnotations({
  groups,
  checks,
  effects,
  sceneNamesById,
  itemNamesById,
  format = formatDefaultChoiceAnnotationLabel,
}: ChoiceAnnotationInput): Map<string, ChoiceAnnotationLines> {
  const liveGroups = groups.filter((group) => !group.isDeleted);
  const positionByGroupId = new Map(
    [...liveGroups].sort((a, b) => a.order - b.order).map((group, index) => [group.id, index]),
  );
  const groupById = new Map(liveGroups.map((group) => [group.id, group]));
  const orderedChecks = checks
    .filter((check) => !check.isDeleted && groupById.has(check.groupId))
    .sort(
      (a, b) =>
        positionByGroupId.get(a.groupId)! - positionByGroupId.get(b.groupId)! || a.order - b.order,
    );
  const checksByGroupId = new Map<string, AnnotationCheck[]>();
  for (const check of orderedChecks) {
    const list = checksByGroupId.get(check.groupId) ?? [];
    list.push(check);
    checksByGroupId.set(check.groupId, list);
  }
  const groupsByChoiceId = new Map<string, AnnotationCheckGroup[]>();
  for (const group of [...liveGroups].sort((a, b) => a.order - b.order)) {
    const list = groupsByChoiceId.get(group.choiceId) ?? [];
    list.push(group);
    groupsByChoiceId.set(group.choiceId, list);
  }
  const effectsByChoiceId = new Map<string, AnnotationEffect[]>();
  for (const effect of effects) {
    if (effect.isDeleted || effect.entityType !== 'Choice') continue;
    const list = effectsByChoiceId.get(effect.entityId) ?? [];
    list.push(effect);
    effectsByChoiceId.set(effect.entityId, list);
  }

  const annotations = new Map<string, ChoiceAnnotationLines>();
  for (const choiceId of new Set([...groupsByChoiceId.keys(), ...effectsByChoiceId.keys()])) {
    const rendered = (groupsByChoiceId.get(choiceId) ?? []).flatMap((group) => {
      const lines = (checksByGroupId.get(group.id) ?? [])
        .map((check) => describeChoiceCheck(check, sceneNamesById, itemNamesById, format))
        .filter((line) => line !== '');
      return lines.length > 0 ? [{ group, lines }] : [];
    });
    const requirements: string[] = [];
    for (const { group, lines } of rendered) {
      if (rendered.length > 1 || lines.length > 1) {
        requirements.push(
          format(group.combinator === 'OR' ? 'groupCombinatorOr' : 'groupCombinatorAnd'),
        );
      }
      for (const line of lines) requirements.push(`• ${line}`);
    }
    const effectLines = (effectsByChoiceId.get(choiceId) ?? [])
      .map((effect) => describeEffect(effect, itemNamesById, format))
      .filter((line) => line !== '');
    const effectBlock =
      effectLines.length > 0
        ? [format('effectsTitle'), ...effectLines.map((line) => `• ${line}`)]
        : [];
    if (requirements.length > 0 || effectBlock.length > 0) {
      annotations.set(choiceId, { requirements, effects: effectBlock });
    }
  }
  return annotations;
}
