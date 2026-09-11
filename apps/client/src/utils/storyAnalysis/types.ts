import type { ChapterType } from '@keres/shared';
import type { NavigableEntityType } from '../entityNavigation';

export type StoryAnalysisCategory =
  | 'characters'
  | 'locations'
  | 'items'
  | 'tags'
  | 'scenes'
  | 'choices'
  | 'routes'
  | 'storySchema';
export type StoryAnalysisSeverity = 'warning' | 'error';

/**
 * The findings that are an opinion about the writer's work rather than a defect in it.
 *
 * Everything else this module reports is integrity: a reference pointing at something that does not
 * exist, a graph that cannot be traversed, a numbering the API will refuse to reorder. Those are
 * true whatever the story is for, and whatever medium it serves.
 *
 * These six are not. An unused tag, a location in no scene, a character with no relationships - in a
 * story bible each of those is simply something that exists in the world. Reporting them as problems
 * is the app telling a writer their worldbuilding is wrong, so they are behind `completenessChecks`
 * and off by default.
 *
 * `analysis_attribute_required_missing` deliberately stays out of this list: it fires because the
 * *writer* marked the field required. Holding somebody to a rule they declared is not an opinion.
 */
export const COMPLETENESS_FINDING_KEYS = [
  'analysis_character_no_scenes',
  'analysis_character_no_relationships',
  'analysis_location_unused',
  'analysis_location_no_connections',
  'analysis_item_unused',
  'analysis_tag_unused',
] as const;

export type CompletenessFindingKey = (typeof COMPLETENESS_FINDING_KEYS)[number];

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
  locationId: string | null;
  isStart: boolean;
  isFinish: boolean;
  chapterId: string | null;
  /** Position within the chapter: 1..N, with no holes and no repeats. Null-chapter scenes skip this. */
  index: number;
}

/** One stretch of story time a container occupies, as the analysis reads it. */
export interface AnalysisChapterAnchor {
  chapterId: string;
  order: number;
  startSceneId: string;
  startPosition: string;
  endSceneId: string | null;
  endPosition: string | null;
}

export interface AnalysisChapter {
  id: string;
  name: string;
  /** Position within its own kind: 1..N, under the same rule as the scenes. */
  index: number;
  /**
   * Chapter or event. The two keep separate 1..N spaces in the same table, so the numbering check
   * has to partition them - see `checkNarrativeIndexes`. Optional because every caller predating
   * events means the spine.
   */
  type?: ChapterType;
}

export interface AnalysisChoice {
  id: string;
  sceneId: string;
  nextSceneId: string;
  text: string;
}

export type AnalysisRoute = AnalysisEntityRef;

export interface AnalysisRouteStep {
  id: string;
  routeId: string;
  position: number;
  sceneId: string;
  selectedChoiceId: string | null;
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
  /** `Story.completenessChecks`. Off means the six keys in `COMPLETENESS_FINDING_KEYS` never appear. */
  includeCompletenessChecks: boolean;
  characters: AnalysisEntityRef[];
  characterScenes: { characterId: string }[];
  characterRelations: { character1Id: string; character2Id: string }[];
  locations: AnalysisEntityRef[];
  locationRelations: { locationAId: string; locationBId: string; relationType: string }[];
  scenes: AnalysisScene[];
  choices: AnalysisChoice[];
  routes?: AnalysisRoute[];
  routeSteps?: AnalysisRouteStep[];
  choiceCheckGroups: AnalysisChoiceCheckGroup[];
  choiceChecks: AnalysisChoiceCheck[];
  effects: AnalysisEffect[];
  items: AnalysisEntityRef[];
  itemJourneys: { itemId: string }[];
  tags: AnalysisEntityRef[];
  tagRelations: { tagId: string }[];
  chapters: AnalysisChapter[];
  /** Optional so a caller predating chronology keeps working; absent means none stated. */
  chapterAnchors?: AnalysisChapterAnchor[];
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

export function buildFinding(
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
