import type { Choice } from '../entities/Choice';
import type { ChoiceCheck } from '../entities/ChoiceCheck';
import type { ChoiceCheckGroup } from '../entities/ChoiceCheckGroup';
import type { Effect } from '../entities/Effect';
import type { RouteStep } from '../entities/RouteStep';
import {
  applySimulationEffects,
  emptyStorySimulationState,
  enterSimulatedScene,
  evaluateSimulatedChoice,
  type StorySimulationState,
} from './storySimulation';
import { validateRouteSteps, type RouteValidationIssue } from './routeValidation';

export interface RouteTraversalIssue {
  /** A route can be structurally broken, or structurally sound but unavailable at replay time. */
  kind: 'structure' | 'choice_unavailable';
  issue?: RouteValidationIssue;
  stepId?: string;
  sceneId?: string;
  choiceId?: string;
  failedCheckTypes?: Array<'sceneCount' | 'inventory' | 'trigger'>;
}

export interface RouteTraversalResult {
  valid: boolean;
  issues: RouteTraversalIssue[];
  /** The state after the final entered scene. Useful to a reader that needs a faithful replay. */
  finalState: StorySimulationState | null;
}

type TraversalChoice = Pick<Choice, 'id' | 'sceneId' | 'nextSceneId' | 'isDeleted'>;
type TraversalStep = Pick<RouteStep, 'id' | 'position' | 'sceneId' | 'selectedChoiceId' | 'isDeleted'>;
type TraversalGroup = Pick<
  ChoiceCheckGroup,
  'id' | 'choiceId' | 'combinator' | 'isDeleted' | 'order'
>;
type TraversalCheck = Pick<
  ChoiceCheck,
  | 'id'
  | 'order'
  | 'groupId'
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
type TraversalEffect = Pick<
  Effect,
  'id' | 'entityType' | 'entityId' | 'effectType' | 'itemId' | 'triggerName' | 'isDeleted'
>;

/**
 * Replays a saved Route using the exact check/effect semantics used by Story Navigator.
 *
 * Structural validation stays first: it explains a deleted scene or rewired choice precisely. A
 * route that is structurally intact can nevertheless become impossible when an author changes a
 * check or effect; that is reported against the step and choice which can no longer be taken.
 */
export function validateRouteTraversal(input: {
  steps: TraversalStep[];
  sceneIds: Iterable<string>;
  choices: TraversalChoice[];
  groups: TraversalGroup[];
  checks: TraversalCheck[];
  effects: TraversalEffect[];
}): RouteTraversalResult {
  const structuralIssues = validateRouteSteps(input.steps, input.sceneIds, input.choices);
  if (structuralIssues.length) {
    return {
      valid: false,
      issues: structuralIssues.map((issue) => ({ kind: 'structure', issue })),
      finalState: null,
    };
  }

  const activeSteps = input.steps
    .filter((step) => !step.isDeleted)
    .sort((left, right) => left.position - right.position);
  const choiceById = new Map(input.choices.filter((choice) => !choice.isDeleted).map((choice) => [choice.id, choice]));
  const effectsFor = (entityType: 'Scene' | 'Choice', entityId: string) =>
    input.effects.filter((effect) => effect.entityType === entityType && effect.entityId === entityId);

  let state = emptyStorySimulationState();
  for (let index = 0; index < activeSteps.length; index++) {
    const step = activeSteps[index];
    state = enterSimulatedScene(state, step.sceneId, effectsFor('Scene', step.sceneId));
    if (!step.selectedChoiceId) continue;
    const choice = choiceById.get(step.selectedChoiceId);
    // `validateRouteSteps` already proved this. Keeping the guard preserves a safe result for
    // callers that pass data mutated between their two reads.
    if (!choice) {
      return {
        valid: false,
        issues: [{ kind: 'structure', issue: 'choice_missing', stepId: step.id, sceneId: step.sceneId }],
        finalState: null,
      };
    }
    const evaluation = evaluateSimulatedChoice(choice, input.groups, input.checks, state);
    if (!evaluation.available) {
      const failedCheckTypes = [
        ...new Set(
          evaluation.outcomes
            .filter((outcome) => !outcome.passes)
            .flatMap((outcome) => outcome.results.filter((result) => !result.passes))
            .map((result) => result.check.type),
        ),
      ];
      return {
        valid: false,
        issues: [
          {
            kind: 'choice_unavailable',
            stepId: step.id,
            sceneId: step.sceneId,
            choiceId: choice.id,
            failedCheckTypes,
          },
        ],
        finalState: state,
      };
    }
    state = applySimulationEffects(state, effectsFor('Choice', choice.id));
  }
  return { valid: true, issues: [], finalState: state };
}
