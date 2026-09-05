import { validateRouteTraversal } from '@keres/shared';
import {
  buildFinding,
  StoryAnalysisCancelledError,
  type AnalysisChoiceCheck,
  type AnalysisChoiceCheckGroup,
  type AnalysisEffect,
  type RunStoryAnalysisOptions,
  type StoryAnalysisFinding,
  type StoryAnalysisInput,
} from './types';

const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new StoryAnalysisCancelledError();
}

/**
 * It reaches out from the starting Scene(s) following the Choices, and marks whoever was not reached.
 * It covers the three ways the request described the same thing ("inaccessible", "isolated", "no path
 * from the start") in a single pass: the message changes depending on whether the Scene has any Choice
 * touching it (genuinely isolated vs. merely out of the start's reach).
 */
export function checkSceneReachability(
  input: StoryAnalysisInput,
  unsatisfiableChoiceIds: Set<string>,
): StoryAnalysisFinding[] {
  const sceneIds = new Set(input.scenes.map((s) => s.id));
  const outgoing = new Map<string, string[]>();
  const touchedByChoice = new Set<string>();

  for (const choice of input.choices) {
    if (!sceneIds.has(choice.sceneId) || !sceneIds.has(choice.nextSceneId)) continue;
    touchedByChoice.add(choice.sceneId);
    touchedByChoice.add(choice.nextSceneId);
    // A Choice whose checks will probably never be satisfied does not count as a live edge - a Scene
    // reachable only through it has to be reported as inaccessible too.
    if (unsatisfiableChoiceIds.has(choice.id)) continue;
    if (!outgoing.has(choice.sceneId)) outgoing.set(choice.sceneId, []);
    outgoing.get(choice.sceneId)!.push(choice.nextSceneId);
  }

  const startIds = input.scenes.filter((s) => s.isStart).map((s) => s.id);

  if (startIds.length === 0) {
    if (input.scenes.length === 0) return [];
    // With no starting Scene there is no way to say what is reachable - reporting every Scene as
    // "inaccessible" would only flood the report and hide the real problem.
    return [
      {
        id: 'scenes:no_start_scene',
        category: 'scenes',
        severity: 'error',
        entityType: 'Scene',
        entityId: '',
        entityName: '',
        messageKey: 'analysis_no_start_scene',
      },
    ];
  }

  const visited = new Set<string>(startIds);
  const queue = [...startIds];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of outgoing.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return input.scenes
    .filter((scene) => !visited.has(scene.id))
    .map((scene) =>
      buildFinding(
        'scenes',
        'error',
        'Scene',
        scene,
        touchedByChoice.has(scene.id) ? 'analysis_scene_unreachable' : 'analysis_scene_isolated',
      ),
    );
}

/** A Scene marked as final that still has a Choice leaving it - a structural contradiction. */
export function checkSceneFinishWithChoices(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const scenesWithOutgoingChoice = new Set(input.choices.map((c) => c.sceneId));
  return input.scenes
    .filter((scene) => scene.isFinish && scenesWithOutgoingChoice.has(scene.id))
    .map((scene) =>
      buildFinding('scenes', 'warning', 'Scene', scene, 'analysis_scene_finish_with_choices'),
    );
}

/**
 * A non-final scene with no viable outgoing Choice strands a route. This is deliberately a full
 * branching check: a Choice known to be unsatisfiable is not an exit, while a regular graph view
 * cannot make that distinction. It does not judge an explicitly marked ending.
 */
export function checkBranchingDeadEnds(
  input: StoryAnalysisInput,
  unsatisfiableChoiceIds: Set<string>,
): StoryAnalysisFinding[] {
  const viableOutgoing = new Set(
    input.choices
      .filter((choice) => !unsatisfiableChoiceIds.has(choice.id))
      .map((choice) => choice.sceneId),
  );
  const declaredOutgoing = new Set(input.choices.map((choice) => choice.sceneId));
  return (
    input.scenes
      // A scene with no choices at all can be an unfinished fragment; report the stronger case where
      // the author did declare exits, but every one is impossible under the current checks.
      .filter(
        (scene) =>
          !scene.isFinish && declaredOutgoing.has(scene.id) && !viableOutgoing.has(scene.id),
      )
      .map((scene) => buildFinding('scenes', 'warning', 'Scene', scene, 'analysis_scene_dead_end'))
  );
}

/** Saved routes are author intent, so edits never rewrite them; analysis makes a stale route visible. */
export function checkRouteTraversal(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const routes = input.routes ?? [];
  const steps = input.routeSteps ?? [];
  return routes.flatMap((route) => {
    const result = validateRouteTraversal({
      steps: steps
        .filter((step) => step.routeId === route.id)
        .map((step) => ({ ...step, isDeleted: false })),
      sceneIds: input.scenes.map((scene) => scene.id),
      choices: input.choices.map((choice) => ({ ...choice, isDeleted: false })),
      groups: input.choiceCheckGroups.map((group, index) => ({
        ...group,
        order: index,
        isDeleted: false,
      })),
      checks: input.choiceChecks.map((check, index) => ({
        ...check,
        order: index,
        isDeleted: false,
      })),
      effects: input.effects.map((effect, index) => ({
        ...effect,
        id: `analysis-effect-${index}`,
        isDeleted: false,
      })),
    });
    if (result.valid) return [];
    const isUnavailable = result.issues.some((issue) => issue.kind === 'choice_unavailable');
    return [
      buildFinding(
        'routes',
        isUnavailable ? 'warning' : 'error',
        'Route',
        route,
        isUnavailable ? 'analysis_route_choice_unavailable' : 'analysis_route_invalid',
      ),
    ];
  });
}

/**
 * A structural heuristic (it does not simulate state exhaustively - see the feature plan) that decides
 * whether a Choice with Checks has any chance of ever becoming available. It uses the reachability BFS's
 * level (from the starting Scenes) as an approximation of "before/after" for inventory/trigger checks,
 * and cycle detection for sceneCount > 1 (revisitable indefinitely, so N does not matter once the cycle
 * exists). "lacks"/"unset" are always satisfiable by default - we do not track "guaranteed and never
 * undone" in v1, a limitation documented in the plan.
 *
 * It runs to a fixed point: an unreachable Choice can make a Scene unreachable, which in turn makes
 * ANOTHER Choice unreachable if it requires that Scene ("Scene X visited at least once", say). A single
 * pass does not catch that cascade - it repeats, rebuilding the graph without the already-failed
 * Choices, until a round finds nothing new. `unsatisfiableChoiceIds` only grows (it never removes an
 * already-failed Choice), which guarantees termination in at most `choices.length` rounds even if a
 * check in `block` mode were to "improve" with less reach.
 */
export async function checkChoiceSatisfiability(
  input: StoryAnalysisInput,
  { onProgress, signal }: RunStoryAnalysisOptions,
): Promise<{
  findings: StoryAnalysisFinding[];
  unsatisfiableChoiceIds: Set<string>;
}> {
  const sceneIds = new Set(input.scenes.map((s) => s.id));
  const startIds = input.scenes.filter((s) => s.isStart).map((s) => s.id);
  const choiceById = new Map(input.choices.map((c) => [c.id, c]));

  const checksByGroup = new Map<string, AnalysisChoiceCheck[]>();
  for (const check of input.choiceChecks) {
    if (!checksByGroup.has(check.groupId)) checksByGroup.set(check.groupId, []);
    checksByGroup.get(check.groupId)!.push(check);
  }
  const groupsByChoice = new Map<string, AnalysisChoiceCheckGroup[]>();
  for (const group of input.choiceCheckGroups) {
    if (!groupsByChoice.has(group.choiceId)) groupsByChoice.set(group.choiceId, []);
    groupsByChoice.get(group.choiceId)!.push(group);
  }
  const itemGrantEffects = input.effects.filter((e) => e.effectType === 'itemGrant');
  const triggerSetEffects = input.effects.filter((e) => e.effectType === 'triggerSet');

  const unsatisfiableChoiceIds = new Set<string>();
  const maxIterations = input.choices.length + 1;
  let changed = true;
  let iterations = 0;

  while (changed && iterations <= maxIterations) {
    throwIfAborted(signal);
    changed = false;
    iterations++;

    const outgoing = new Map<string, string[]>();
    for (const choice of input.choices) {
      if (!sceneIds.has(choice.sceneId) || !sceneIds.has(choice.nextSceneId)) continue;
      if (unsatisfiableChoiceIds.has(choice.id)) continue;
      if (!outgoing.has(choice.sceneId)) outgoing.set(choice.sceneId, []);
      outgoing.get(choice.sceneId)!.push(choice.nextSceneId);
    }

    const levelByScene = new Map<string, number>();
    const queue: string[] = [];
    for (const id of startIds) {
      if (!levelByScene.has(id)) {
        levelByScene.set(id, 0);
        queue.push(id);
      }
    }
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentLevel = levelByScene.get(current)!;
      for (const next of outgoing.get(current) ?? []) {
        if (!levelByScene.has(next)) {
          levelByScene.set(next, currentLevel + 1);
          queue.push(next);
        }
      }
    }

    function canReachSelf(sceneId: string): boolean {
      const visited = new Set<string>();
      const stack = [...(outgoing.get(sceneId) ?? [])];
      while (stack.length > 0) {
        const current = stack.pop()!;
        if (current === sceneId) return true;
        if (visited.has(current)) continue;
        visited.add(current);
        stack.push(...(outgoing.get(current) ?? []));
      }
      return false;
    }

    function effectLevel(effect: AnalysisEffect): number | undefined {
      if (effect.entityType === 'Scene') return levelByScene.get(effect.entityId);
      if (unsatisfiableChoiceIds.has(effect.entityId)) return undefined;
      const choice = choiceById.get(effect.entityId);
      return choice ? levelByScene.get(choice.sceneId) : undefined;
    }

    function isReachableBeforeOrAt(effects: AnalysisEffect[], maxLevel: number): boolean {
      return effects.some((effect) => {
        const level = effectLevel(effect);
        return level !== undefined && level <= maxLevel;
      });
    }

    function evaluateRawCondition(check: AnalysisChoiceCheck, choiceLevel: number): boolean {
      switch (check.type) {
        case 'sceneCount': {
          if (!check.sceneId) return false;
          const sceneLevel = levelByScene.get(check.sceneId);
          if (sceneLevel === undefined) return false;
          if ((check.minVisits ?? 1) <= 1) return true;
          return canReachSelf(check.sceneId);
        }
        case 'inventory': {
          if (!check.itemId) return false;
          if (check.itemPresence === 'lacks') return true;
          return isReachableBeforeOrAt(
            itemGrantEffects.filter((e) => e.itemId === check.itemId),
            choiceLevel,
          );
        }
        case 'trigger': {
          if (!check.triggerName) return false;
          if (check.triggerState === 'unset') return true;
          return isReachableBeforeOrAt(
            triggerSetEffects.filter((e) => e.triggerName === check.triggerName),
            choiceLevel,
          );
        }
        default:
          return false;
      }
    }

    for (const choice of input.choices) {
      if (unsatisfiableChoiceIds.has(choice.id)) continue;
      const groups = groupsByChoice.get(choice.id);
      if (!groups || groups.length === 0) continue;
      const choiceLevel = levelByScene.get(choice.sceneId);
      if (choiceLevel === undefined) continue; // already reported by checkSceneReachability/checkChoices

      const satisfiable = groups.every((group) => {
        const checks = checksByGroup.get(group.id) ?? [];
        if (checks.length === 0) return true;
        const results = checks.map((check) => {
          const raw = evaluateRawCondition(check, choiceLevel);
          return check.mode === 'block' ? !raw : raw;
        });
        return group.combinator === 'OR' ? results.some(Boolean) : results.every(Boolean);
      });

      if (!satisfiable) {
        unsatisfiableChoiceIds.add(choice.id);
        changed = true;
      }
    }

    onProgress?.({ fraction: Math.min(iterations / maxIterations, 1) });
    // It yields control to the event loop on every round - each round is O(scenes + choices), so a large
    // story still yields several times a second, keeping the UI responsive.
    await yieldToEventLoop();
  }

  const findings = [...unsatisfiableChoiceIds].map((id) =>
    buildFinding(
      'choices',
      'warning',
      'Choice',
      { id, name: choiceById.get(id)?.text || id },
      'analysis_choice_never_satisfiable',
    ),
  );

  return { findings, unsatisfiableChoiceIds };
}

export function checkChoices(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const sceneIds = new Set(input.scenes.map((s) => s.id));
  const findings: StoryAnalysisFinding[] = [];

  for (const choice of input.choices) {
    const ref = { id: choice.id, name: choice.text || choice.id };
    if (!sceneIds.has(choice.sceneId)) {
      findings.push(
        buildFinding('choices', 'error', 'Choice', ref, 'analysis_choice_dangling_scene'),
      );
    }
    if (!sceneIds.has(choice.nextSceneId)) {
      findings.push(
        buildFinding('choices', 'error', 'Choice', ref, 'analysis_choice_dangling_next_scene'),
      );
    }
  }

  return findings;
}
