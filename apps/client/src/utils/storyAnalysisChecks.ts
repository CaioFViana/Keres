import { AttributeType, decodeAttributeValue, isValidAttributeDate } from '@keres/shared';
import type { NavigableEntityType } from './entityNavigation';

/**
 * Structural checks on a Story: it is not search, it is finding what a writer would hardly notice on
 * their own (a Character who never appears in any Scene, a Choice pointing at a Scene that no longer
 * exists, a Scene with no path from the start). Pure on purpose, like
 * `storyGraphLayout.ts`/`locationGraphLayout.ts`: it receives lists already loaded from the database and
 * returns finished findings, without touching DB/React - which allows testing each check in isolation
 * and reusing the same result in both the dashboard summary and the report screen.
 */

export type StoryAnalysisCategory =
  | 'characters'
  | 'locations'
  | 'items'
  | 'tags'
  | 'scenes'
  | 'choices'
  | 'storySchema';
export type StoryAnalysisSeverity = 'warning' | 'error';

export interface StoryAnalysisFinding {
  /** Stable across runs - used as a list key, never displayed. */
  id: string;
  category: StoryAnalysisCategory;
  severity: StoryAnalysisSeverity;
  entityType: NavigableEntityType;
  /** Empty for the rare finding of a story with no starting Scene at all - see `checkSceneReachability`. */
  entityId: string;
  entityName: string;
  messageKey: string;
  messageParams?: Record<string, string | number>;
}

export interface AnalysisEntityRef {
  id: string;
  name: string;
}

export interface AnalysisScene {
  id: string;
  name: string;
  locationId: string;
  isStart: boolean;
  isFinish: boolean;
  chapterId: string;
  /** Position within the chapter: 1..N, with no holes and no repeats. */
  index: number;
}

export interface AnalysisChapter {
  id: string;
  name: string;
  /** Position in the story: 1..N, under the same rule as the scenes. */
  index: number;
}

export interface AnalysisChoice {
  id: string;
  sceneId: string;
  nextSceneId: string;
  text: string;
}

export type ChoiceCheckCombinator = 'AND' | 'OR';
export type ChoiceCheckMode = 'block' | 'enable';
export type ChoiceCheckType = 'sceneCount' | 'inventory' | 'trigger';
export type ChoiceCheckItemPresence = 'has' | 'lacks';
export type ChoiceCheckTriggerState = 'set' | 'unset';

export interface AnalysisChoiceCheckGroup {
  id: string;
  choiceId: string;
  combinator: ChoiceCheckCombinator;
}

export interface AnalysisChoiceCheck {
  id: string;
  groupId: string;
  mode: ChoiceCheckMode;
  type: ChoiceCheckType;
  sceneId: string | null;
  minVisits: number | null;
  itemId: string | null;
  itemPresence: ChoiceCheckItemPresence | null;
  triggerName: string | null;
  triggerState: ChoiceCheckTriggerState | null;
}

export type EffectEntityType = 'Scene' | 'Choice';
export type EffectType = 'itemGrant' | 'itemTake' | 'triggerSet' | 'triggerUnset';

export interface AnalysisEffect {
  entityType: EffectEntityType;
  entityId: string;
  effectType: EffectType;
  itemId: string | null;
  triggerName: string | null;
}

export interface AnalysisStorySchemaField {
  id: string;
  entityType: string;
  name: string;
  type: string;
  targetEntityType?: string | null;
  isRequired: boolean;
}

export interface AnalysisAttributeValue {
  fieldId: string;
  entityId: string;
  value: string | null;
}

export interface StoryAnalysisInput {
  storyType: 'linear' | 'branching';
  characters: AnalysisEntityRef[];
  characterScenes: { characterId: string }[];
  characterRelations: { character1Id: string; character2Id: string }[];
  locations: AnalysisEntityRef[];
  locationRelations: { locationAId: string; locationBId: string }[];
  scenes: AnalysisScene[];
  choices: AnalysisChoice[];
  choiceCheckGroups: AnalysisChoiceCheckGroup[];
  choiceChecks: AnalysisChoiceCheck[];
  effects: AnalysisEffect[];
  items: AnalysisEntityRef[];
  itemJourneys: { itemId: string }[];
  tags: AnalysisEntityRef[];
  tagRelations: { tagId: string }[];
  chapters: AnalysisChapter[];
  notes: AnalysisEntityRef[];
  worldRules: AnalysisEntityRef[];
  storySchemaFields: AnalysisStorySchemaField[];
  attributeValues: AnalysisAttributeValue[];
}

export interface StoryAnalysisProgress {
  /** 0 a 1. */
  fraction: number;
}

export interface RunStoryAnalysisOptions {
  onProgress?: (progress: StoryAnalysisProgress) => void;
  signal?: AbortSignal;
}

export class StoryAnalysisCancelledError extends Error {
  constructor() {
    super('Story analysis was cancelled.');
    this.name = 'StoryAnalysisCancelledError';
  }
}

/**
 * It gives control back to the event loop between chunks of heavy work, without depending on a Worker
 * (a real one is impossible in RN mobile without a native module) or on another DB connection (drizzle's
 * driver is tied to the main thread) - see the feature plan.
 */
const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new StoryAnalysisCancelledError();
}

/**
 * Fast checks, O(entities) - safe to run every time the story changes (the dashboard badge, say). They
 * do not include Choice reachability or satisfiability: those two walk the Scenes/Choices graph in
 * fixed-point rounds and get expensive on large branching stories, so they only run on demand through
 * `buildStoryAnalysisReport`.
 */
export function buildCheapStoryAnalysisFindings(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  return [
    ...checkCharacters(input),
    ...checkLocations(input),
    ...checkItems(input),
    ...checkTags(input),
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
  throwIfAborted(options.signal);
  const reachabilityFindings = checkSceneReachability(input, unsatisfiableChoiceIds);
  options.onProgress?.({ fraction: 1 });

  return [...cheapFindings, ...reachabilityFindings, ...satisfiabilityFindings];
}

function checkCharacters(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const findings: StoryAnalysisFinding[] = [];
  const charactersWithScenes = new Set(input.characterScenes.map((cs) => cs.characterId));
  const charactersWithRelations = new Set<string>();
  for (const relation of input.characterRelations) {
    charactersWithRelations.add(relation.character1Id);
    charactersWithRelations.add(relation.character2Id);
  }

  for (const character of input.characters) {
    if (!charactersWithScenes.has(character.id)) {
      findings.push(
        buildFinding(
          'characters',
          'warning',
          'Character',
          character,
          'analysis_character_no_scenes',
        ),
      );
    }
    if (!charactersWithRelations.has(character.id)) {
      findings.push(
        buildFinding(
          'characters',
          'warning',
          'Character',
          character,
          'analysis_character_no_relationships',
        ),
      );
    }
  }

  return findings;
}

function checkLocations(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const findings: StoryAnalysisFinding[] = [];
  const usedLocationIds = new Set(input.scenes.map((s) => s.locationId));
  const connectedLocationIds = new Set<string>();
  for (const relation of input.locationRelations) {
    connectedLocationIds.add(relation.locationAId);
    connectedLocationIds.add(relation.locationBId);
  }

  for (const location of input.locations) {
    if (!usedLocationIds.has(location.id)) {
      findings.push(
        buildFinding('locations', 'warning', 'Location', location, 'analysis_location_unused'),
      );
    }
    if (!connectedLocationIds.has(location.id)) {
      findings.push(
        buildFinding(
          'locations',
          'warning',
          'Location',
          location,
          'analysis_location_no_connections',
        ),
      );
    }
  }

  return findings;
}

function checkItems(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const usedItemIds = new Set(input.itemJourneys.map((j) => j.itemId));
  return input.items
    .filter((item) => !usedItemIds.has(item.id))
    .map((item) => buildFinding('items', 'warning', 'Item', item, 'analysis_item_unused'));
}

function checkTags(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const usedTagIds = new Set(input.tagRelations.map((r) => r.tagId));
  return input.tags
    .filter((tag) => !usedTagIds.has(tag.id))
    .map((tag) => buildFinding('tags', 'warning', 'Tag', tag, 'analysis_tag_unused'));
}

/**
 * It reaches out from the starting Scene(s) following the Choices, and marks whoever was not reached.
 * It covers the three ways the request described the same thing ("inaccessible", "isolated", "no path
 * from the start") in a single pass: the message changes depending on whether the Scene has any Choice
 * touching it (genuinely isolated vs. merely out of the start's reach).
 */
function checkSceneReachability(
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
function checkSceneFinishWithChoices(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const scenesWithOutgoingChoice = new Set(input.choices.map((c) => c.sceneId));
  return input.scenes
    .filter((scene) => scene.isFinish && scenesWithOutgoingChoice.has(scene.id))
    .map((scene) =>
      buildFinding('scenes', 'warning', 'Scene', scene, 'analysis_scene_finish_with_choices'),
    );
}

/** `null` when the list is already a contiguous 1..N; otherwise, what is wrong with it. */
function inspectIndexes(indexes: number[]): 'duplicate' | 'start' | 'gap' | null {
  if (indexes.length === 0) return null;
  const sorted = [...indexes].sort((a, b) => a - b);
  if (new Set(sorted).size !== sorted.length) return 'duplicate';
  if (sorted[0] !== 1) return 'start';
  return sorted.every((value, position) => value === position + 1) ? null : 'gap';
}

/**
 * The numbering of chapters (1..N in the story) and of scenes (1..M within the chapter).
 *
 * It is not fussiness: the API refuses a reorder whose indices do not form a contiguous 1..N, so a
 * crooked numbering becomes a synchronization conflict the first time the person drags a scene
 * somewhere else. A repeat is worse than a hole - two scenes with the same number leave the story's
 * order undefined in the Reader, in the Matrix and in the conversion to branching.
 *
 * Linear stories only: that is where the indices' order is the reading order.
 */
function checkNarrativeIndexes(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const findings: StoryAnalysisFinding[] = [];

  const chapterProblem = inspectIndexes(input.chapters.map((chapter) => chapter.index));
  if (chapterProblem && input.chapters.length > 0) {
    findings.push(
      buildFinding(
        'scenes',
        'warning',
        'Chapter',
        input.chapters[0]!,
        `analysis_chapter_index_${chapterProblem}`,
      ),
    );
  }

  for (const chapter of input.chapters) {
    const chapterScenes = input.scenes.filter((scene) => scene.chapterId === chapter.id);
    if (chapterScenes.length === 0) continue;
    const sceneProblem = inspectIndexes(chapterScenes.map((scene) => scene.index));
    if (!sceneProblem) continue;
    findings.push(
      buildFinding(
        'scenes',
        'warning',
        'Chapter',
        chapter,
        `analysis_scene_index_${sceneProblem}`,
        {
          chapterName: chapter.name,
        },
      ),
    );
  }

  return findings;
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
async function checkChoiceSatisfiability(
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

function checkChoices(input: StoryAnalysisInput): StoryAnalysisFinding[] {
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

const STORY_SCHEMA_ENTITY_TYPE_TO_NAVIGABLE: Record<string, NavigableEntityType> = {
  Character: 'Character',
  Location: 'Location',
  Item: 'Item',
  Scene: 'Scene',
  Chapter: 'Chapter',
  Note: 'Note',
  WorldRule: 'WorldRule',
};

/**
 * Required attributes left empty, and values that make no sense for the declared type. "Invalid" is only
 * checked for number/date - `decodeAttributeValue` makes a boolean always turn into a valid value (never
 * detectable as invalid by design, see `attributeValueCodec.ts`), and free text has no wrong shape.
 */
function checkStorySchema(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const findings: StoryAnalysisFinding[] = [];

  const entitiesByType: Record<string, AnalysisEntityRef[]> = {
    Character: input.characters,
    Location: input.locations,
    Item: input.items,
    Scene: input.scenes.map((s) => ({ id: s.id, name: s.name })),
    Chapter: input.chapters,
    Note: input.notes,
    WorldRule: input.worldRules,
  };

  const rawValueByFieldAndEntity = new Map<string, string | null>();
  for (const value of input.attributeValues) {
    rawValueByFieldAndEntity.set(`${value.fieldId}:${value.entityId}`, value.value);
  }

  for (const field of input.storySchemaFields) {
    const navigableType = STORY_SCHEMA_ENTITY_TYPE_TO_NAVIGABLE[field.entityType];
    const entities = entitiesByType[field.entityType];
    if (!navigableType || !entities) continue;

    for (const entity of entities) {
      const raw = rawValueByFieldAndEntity.get(`${field.id}:${entity.id}`) ?? null;
      const decoded = decodeAttributeValue(field.type as AttributeType, raw);

      if (field.isRequired && decoded === null) {
        findings.push(
          buildFinding(
            'storySchema',
            'warning',
            navigableType,
            entity,
            'analysis_attribute_required_missing',
            { fieldName: field.name },
          ),
        );
        continue;
      }

      if (
        field.type === AttributeType.ENTITY &&
        raw !== null &&
        (!field.targetEntityType ||
          !entitiesByType[field.targetEntityType]?.some((target) => target.id === raw))
      ) {
        findings.push(
          buildFinding(
            'storySchema',
            'warning',
            navigableType,
            entity,
            'analysis_attribute_entity_missing',
            { fieldName: field.name },
          ),
        );
        continue;
      }

      if (!raw) continue;

      const isInvalid =
        field.type === AttributeType.NUMBER
          ? decoded === null
          : field.type === AttributeType.DATE
            ? // `Date.parse` continua como segunda chance de propósito: só o formato canônico
              // (`attributeDateValue.ts`) is accepted straight away, but free-text values saved before the date picker
              // existed must not all turn into warnings at once.
              !isValidAttributeDate(raw) && Number.isNaN(Date.parse(raw))
            : false;

      if (isInvalid) {
        findings.push(
          buildFinding(
            'storySchema',
            'warning',
            navigableType,
            entity,
            'analysis_attribute_invalid',
            { fieldName: field.name },
          ),
        );
      }
    }
  }

  return findings;
}

function buildFinding(
  category: StoryAnalysisCategory,
  severity: StoryAnalysisSeverity,
  entityType: NavigableEntityType,
  entity: { id: string; name: string },
  messageKey: string,
  messageParams?: Record<string, string | number>,
): StoryAnalysisFinding {
  return {
    id: `${category}:${messageKey}:${entity.id}`,
    category,
    severity,
    entityType,
    entityId: entity.id,
    entityName: entity.name,
    messageKey,
    messageParams,
  };
}
