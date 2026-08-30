import type { Choice } from '../entities/Choice';
import type { RouteStep } from '../entities/RouteStep';

export type RouteValidationIssue =
  | 'empty'
  | 'positions'
  | 'scene_missing'
  | 'choice_missing'
  | 'choice_source_mismatch'
  | 'choice_target_mismatch'
  | 'final_choice';

/** Validates a stored Route without changing it; broken routes remain useful historical intent. */
export function validateRouteSteps(
  steps: Pick<RouteStep, 'position' | 'sceneId' | 'selectedChoiceId' | 'isDeleted'>[],
  scenes: Iterable<string>,
  choices: Iterable<Pick<Choice, 'id' | 'sceneId' | 'nextSceneId' | 'isDeleted'>>,
): RouteValidationIssue[] {
  const active = steps.filter((step) => !step.isDeleted).sort((a, b) => a.position - b.position);
  if (active.length === 0) return ['empty'];
  if (active.some((step, index) => step.position !== index + 1)) return ['positions'];
  const sceneIds = new Set(scenes);
  const choiceById = new Map(
    [...choices].filter((choice) => !choice.isDeleted).map((choice) => [choice.id, choice]),
  );
  const issues: RouteValidationIssue[] = [];
  for (let index = 0; index < active.length; index++) {
    const step = active[index];
    if (!sceneIds.has(step.sceneId)) issues.push('scene_missing');
    const isFinal = index === active.length - 1;
    if (isFinal) {
      if (step.selectedChoiceId) issues.push('final_choice');
      continue;
    }
    const choice = step.selectedChoiceId ? choiceById.get(step.selectedChoiceId) : undefined;
    if (!choice) {
      issues.push('choice_missing');
      continue;
    }
    if (choice.sceneId !== step.sceneId) issues.push('choice_source_mismatch');
    if (choice.nextSceneId !== active[index + 1].sceneId) issues.push('choice_target_mismatch');
  }
  return [...new Set(issues)];
}
