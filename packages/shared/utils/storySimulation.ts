import type { Choice } from '../entities/Choice';
import type { ChoiceCheck } from '../entities/ChoiceCheck';
import type { ChoiceCheckGroup } from '../entities/ChoiceCheckGroup';
import type { Effect } from '../entities/Effect';

export interface StorySimulationState {
  sceneVisits: ReadonlyMap<string, number>;
  inventory: ReadonlySet<string>;
  triggers: ReadonlySet<string>;
}

export const emptyStorySimulationState = (): StorySimulationState => ({
  sceneVisits: new Map(),
  inventory: new Set(),
  triggers: new Set(),
});

type SimulatedCheck = Pick<
  ChoiceCheck,
    | 'groupId'
    | 'id'
    | 'order'
  | 'mode'
  | 'type'
  | 'sceneId'
  | 'minVisits'
  | 'itemId'
  | 'itemPresence'
  | 'triggerName'
  | 'triggerState'
  | 'isDeleted'
>;

function matches(check: SimulatedCheck, state: StorySimulationState) {
  if (check.type === 'sceneCount')
    return (
      Boolean(check.sceneId) &&
      (state.sceneVisits.get(check.sceneId!) ?? 0) >= (check.minVisits ?? 1)
    );
  if (check.type === 'inventory')
    return (
      Boolean(check.itemId) &&
      (check.itemPresence === 'lacks'
        ? !state.inventory.has(check.itemId!)
        : state.inventory.has(check.itemId!))
    );
  return (
    Boolean(check.triggerName) &&
    (check.triggerState === 'unset'
      ? !state.triggers.has(check.triggerName!)
      : state.triggers.has(check.triggerName!))
  );
}

/** Evaluates runtime availability using the same block/enable and AND/OR semantics as analysis. */
export function evaluateSimulatedChoice(
  choice: Pick<Choice, 'id'>,
  groups: Pick<ChoiceCheckGroup, 'id' | 'choiceId' | 'combinator' | 'isDeleted' | 'order'>[],
  checks: SimulatedCheck[],
  state: StorySimulationState,
) {
  const outcomes = groups
    .filter((group) => group.choiceId === choice.id)
    .map((group) => {
      const groupChecks = checks.filter((check) => check.groupId === group.id && !check.isDeleted);
      const results = groupChecks.map((check) => ({
        check,
        matched: matches(check, state),
        passes: check.mode === 'block' ? !matches(check, state) : matches(check, state),
      }));
      return {
        group,
        results,
        passes:
          group.combinator === 'OR'
            ? results.some((result) => result.passes)
            : results.every((result) => result.passes),
      };
    });
  return { available: outcomes.every((outcome) => outcome.passes), outcomes };
}

export function applySimulationEffects(
  state: StorySimulationState,
  effects: Pick<
    Effect,
    'id' | 'entityType' | 'entityId' | 'effectType' | 'itemId' | 'triggerName' | 'isDeleted'
  >[],
): StorySimulationState {
  const inventory = new Set(state.inventory);
  const triggers = new Set(state.triggers);
  for (const effect of effects.filter((effect) => !effect.isDeleted)) {
    if (effect.effectType === 'itemGrant' && effect.itemId) inventory.add(effect.itemId);
    if (effect.effectType === 'itemTake' && effect.itemId) inventory.delete(effect.itemId);
    if (effect.effectType === 'triggerSet' && effect.triggerName) triggers.add(effect.triggerName);
    if (effect.effectType === 'triggerUnset' && effect.triggerName)
      triggers.delete(effect.triggerName);
  }
  return { sceneVisits: new Map(state.sceneVisits), inventory, triggers };
}

export function enterSimulatedScene(
  state: StorySimulationState,
  sceneId: string,
  effects: Pick<
    Effect,
    'id' | 'entityType' | 'entityId' | 'effectType' | 'itemId' | 'triggerName' | 'isDeleted'
  >[],
): StorySimulationState {
  const next = applySimulationEffects(state, effects);
  const visits = new Map(next.sceneVisits);
  visits.set(sceneId, (visits.get(sceneId) ?? 0) + 1);
  return { ...next, sceneVisits: visits };
}
