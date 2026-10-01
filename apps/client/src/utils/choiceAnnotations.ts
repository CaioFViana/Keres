import type { TFunction } from 'i18next';
import {
  describeChoiceAnnotations as describeSharedChoiceAnnotations,
  type ChoiceAnnotationInput as SharedChoiceAnnotationInput,
  type ChoiceAnnotationLines,
} from '@keres/shared';
import type { AppDrizzleClient } from '../db';
import { createChoiceCheckGroupService } from '../services/storymanagement/ChoiceCheckGroupService';
import { createChoiceCheckService } from '../services/storymanagement/ChoiceCheckService';
import { createEffectService } from '../services/storymanagement/EffectService';
import { createItemService } from '../services/storymanagement/ItemService';
import { choiceAnnotationFormatterFromT } from './choiceCheckEffectDescriptions';

export type { ChoiceAnnotationLines };

export type ChoiceAnnotationInput = Omit<SharedChoiceAnnotationInput, 'format'> & { t: TFunction };

/**
 * The export's choice annotations through the shared describer the API also uses -
 * same sentences on device and in publications. Only choices with at least one line get
 * an entry; group headers appear only when the combinator can change the reading.
 */
export function describeChoiceAnnotations({
  t,
  ...input
}: ChoiceAnnotationInput): Map<string, ChoiceAnnotationLines> {
  return describeSharedChoiceAnnotations({
    ...input,
    format: choiceAnnotationFormatterFromT(t),
  });
}

/**
 * Export-time loader for the annotations above: check groups, checks, choice effects and
 * the item names they resolve. Deliberately on demand (export only) - the manuscript's
 * read model stays free of checks and effects.
 */
export async function loadChoiceAnnotations(
  db: AppDrizzleClient,
  storyId: string,
  scenes: { id: string; name: string }[],
  t: TFunction,
): Promise<Map<string, ChoiceAnnotationLines>> {
  const [groups, checks, effects, items] = await Promise.all([
    createChoiceCheckGroupService(db).getAllByStoryId(storyId),
    createChoiceCheckService(db).getAllByStoryId(storyId),
    createEffectService(db).getAllByStoryId(storyId),
    createItemService(db).getItemsByStoryId(storyId),
  ]);
  return describeChoiceAnnotations({
    groups,
    checks,
    effects,
    sceneNamesById: Object.fromEntries(scenes.map((scene) => [scene.id, scene.name])),
    itemNamesById: Object.fromEntries(items.map((item) => [item.id, item.name])),
    t,
  });
}
