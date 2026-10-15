import { useCallback, useEffect, useState } from 'react';
import type { ChoiceCheck, ChoiceCheckGroup, Effect } from '@keres/shared';
import { useDrizzle } from '@/src/db';
import type { ChoiceSelect, ItemSelect, SceneSelect } from '@/src/db/schema';
import { createChoiceCheckGroupService } from '@/src/services/storymanagement/ChoiceCheckGroupService';
import { createChoiceCheckService } from '@/src/services/storymanagement/ChoiceCheckService';
import { createChoiceService } from '@/src/services/storymanagement/ChoiceService';
import { createEffectService } from '@/src/services/storymanagement/EffectService';
import { createItemService } from '@/src/services/storymanagement/ItemService';
import { createSceneService } from '@/src/services/storymanagement/SceneService';
import { entityEventEmitter } from '@/src/utils/EventEmitter';
import { useEntityInitialLoad } from '@/src/hooks/lists/useEntityRefreshLifecycle';

export interface NavigatorData {
  scenes: SceneSelect[];
  choices: ChoiceSelect[];
  items: ItemSelect[];
  groups: ChoiceCheckGroup[];
  checks: ChoiceCheck[];
  effects: Effect[];
}
const EMPTY: NavigatorData = {
  scenes: [],
  choices: [],
  items: [],
  groups: [],
  checks: [],
  effects: [],
};

/** Read-only data set used by the branching navigator; it never shares mutation state with forms. */
export function useStoryNavigatorData(storyId: string | undefined) {
  const db = useDrizzle();
  const [data, setData] = useState<NavigatorData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!storyId) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    try {
      const [scenes, choices, items, groups, checks, effects] = await Promise.all([
        createSceneService(db).getAllByStoryId(storyId),
        createChoiceService(db).getAllByStoryId(storyId),
        createItemService(db).getAllByStoryId(storyId),
        createChoiceCheckGroupService(db).getAllByStoryId(storyId),
        createChoiceCheckService(db).getAllByStoryId(storyId),
        createEffectService(db).getAllByStoryId(storyId),
      ]);
      setData({ scenes, choices, items, groups, checks, effects });
    } catch (error) {
      console.error('Failed to load story navigator data:', error);
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [db, storyId]);
  useEntityInitialLoad(reload);
  useEffect(() => {
    const events = [
      'scene_changed',
      'choice_changed',
      'choice_check_group_changed',
      'choice_check_changed',
      'effect_changed',
    ];
    events.forEach((event) => entityEventEmitter.on(event, reload));
    return () => events.forEach((event) => entityEventEmitter.off(event, reload));
  }, [reload]);
  return { ...data, loading, reload };
}
