/**
 * Structural checks on a Story: it is not search, it is finding what a writer would hardly notice on
 * their own (a Character who never appears in any Scene, a Choice pointing at a Scene that no longer
 * exists, a Scene with no path from the start). Pure on purpose, like
 * `storyGraphLayout.ts`/`locationGraphLayout.ts`: it receives lists already loaded from the database and
 * returns finished findings, without touching DB/React - which allows testing each check in isolation
 * and reusing the same result in both the dashboard summary and the report screen.
 */
export {
  COMPLETENESS_FINDING_KEYS,
  StoryAnalysisCancelledError,
  type AnalysisAttributeValue,
  type AnalysisChapter,
  type AnalysisChapterAnchor,
  type AnalysisChoice,
  type AnalysisChoiceCheck,
  type AnalysisChoiceCheckGroup,
  type AnalysisEffect,
  type AnalysisEntityRef,
  type AnalysisRoute,
  type AnalysisRouteStep,
  type AnalysisScene,
  type AnalysisStorySchemaField,
  type ChoiceCheckCombinator,
  type ChoiceCheckItemPresence,
  type ChoiceCheckMode,
  type ChoiceCheckTriggerState,
  type ChoiceCheckType,
  type CompletenessFindingKey,
  type EffectEntityType,
  type EffectType,
  type RunStoryAnalysisOptions,
  type StoryAnalysisCategory,
  type StoryAnalysisFinding,
  type StoryAnalysisInput,
  type StoryAnalysisProgress,
  type StoryAnalysisSeverity,
} from './storyAnalysis/types';

import {
  checkCharacters,
  checkDuplicateRelations,
  checkItems,
  checkLocations,
  checkStorySchema,
  checkTags,
} from './storyAnalysis/completenessChecks';
import {
  checkAnchorsRunForwards,
  checkNarrativeIndexes,
} from './storyAnalysis/narrativeIndexChecks';
import {
  checkBranchingDeadEnds,
  checkChoiceSatisfiability,
  checkChoices,
  checkRouteTraversal,
  checkSceneFinishWithChoices,
  checkSceneReachability,
} from './storyAnalysis/branchingChecks';
import type {
  RunStoryAnalysisOptions,
  StoryAnalysisFinding,
  StoryAnalysisInput,
} from './storyAnalysis/types';
import { StoryAnalysisCancelledError } from './storyAnalysis/types';

/**
 * Fast checks, O(entities) - safe to run every time the story changes (the dashboard badge, say). They
 * do not include Choice reachability or satisfiability: those two walk the Scenes/Choices graph in
 * fixed-point rounds and get expensive on large branching stories, so they only run on demand through
 * `buildStoryAnalysisReport`.
 */
export function buildCheapStoryAnalysisFindings(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  // The four gated checks emit nothing but `COMPLETENESS_FINDING_KEYS`, so the switch is the whole
  // partition - there is no integrity finding hiding inside them that would be lost.
  const completeness = input.includeCompletenessChecks
    ? [
        ...checkCharacters(input),
        ...checkLocations(input),
        ...checkItems(input),
        ...checkTags(input),
      ]
    : [];

  return [
    ...completeness,
    ...checkDuplicateRelations(input),
    ...checkAnchorsRunForwards(input),
    ...checkSceneFinishWithChoices(input),
    ...(input.storyType === 'linear' ? checkNarrativeIndexes(input) : []),
    // Choice integrity is O(choices) and fits here even though it is "branching only" - dangling references
    // are cheap to find, unlike reachability/satisfiability.
    ...(input.storyType === 'branching' ? checkChoices(input) : []),
    ...checkStorySchema(input),
  ];
}

/**
 * The full report: the fast checks + reachability/satisfiability (which only make sense for branching
 * stories). The heavy part (`checkChoiceSatisfiability`) yields control to the event loop between
 * fixed-point rounds and reports progress, so it does not freeze the UI even on large stories - see the
 * feature plan in `StoryAnalysisScreen.tsx`.
 */
export async function buildStoryAnalysisReport(
  input: StoryAnalysisInput,
  options: RunStoryAnalysisOptions = {},
): Promise<StoryAnalysisFinding[]> {
  const cheapFindings = buildCheapStoryAnalysisFindings(input);

  if (input.storyType !== 'branching') {
    options.onProgress?.({ fraction: 1 });
    return cheapFindings;
  }

  const { findings: satisfiabilityFindings, unsatisfiableChoiceIds } =
    await checkChoiceSatisfiability(input, options);
  if (options.signal?.aborted) throw new StoryAnalysisCancelledError();
  const reachabilityFindings = checkSceneReachability(input, unsatisfiableChoiceIds);
  const deadEndFindings = checkBranchingDeadEnds(input, unsatisfiableChoiceIds);
  const routeFindings = checkRouteTraversal(input);
  options.onProgress?.({ fraction: 1 });

  return [
    ...cheapFindings,
    ...reachabilityFindings,
    ...satisfiabilityFindings,
    ...deadEndFindings,
    ...routeFindings,
  ];
}
