import { useMemo } from 'react';
import { useStoryEntities } from '@/src/hooks/lists/useStoryEntities';
import type { ChoiceDetailServices } from './useChoiceDetailServices';

const CHECK_GROUP_EVENTS = ['choice_check_group_changed'] as const;
const CHECK_EVENTS = ['choice_check_group_changed', 'choice_check_changed'] as const;
const EFFECT_EVENTS = ['effect_changed'] as const;
const SCENE_EVENTS = ['scene_changed'] as const;
const ITEM_EVENTS = ['item_changed'] as const;

/**
 * What a branching choice shows besides itself: the check groups and checks that gate it, the
 * effects it has, and the names of the scenes and items they point to.
 */
export function useChoiceDetailLists(
  {
    checkGroupService,
    checkService,
    effectService,
    sceneService,
    itemService,
  }: ChoiceDetailServices,
  storyId: string | undefined,
  choiceId: string,
  enabled: boolean,
) {
  const loadCheckGroups = useMemo(
    () => (id: string) => checkGroupService.getChoiceCheckGroupsByChoiceId(id, choiceId),
    [checkGroupService, choiceId],
  );
  const loadChecks = useMemo(
    () => async (id: string) => {
      const groups = await checkGroupService.getChoiceCheckGroupsByChoiceId(id, choiceId);
      const checksByGroup = await Promise.all(
        groups.map((group) => checkService.getChoiceChecksByGroupId(id, group.id)),
      );
      return checksByGroup.flat();
    },
    [checkGroupService, checkService, choiceId],
  );
  const loadEffects = useMemo(
    () => (id: string) => effectService.getEffectsByEntity(id, 'Choice', choiceId),
    [effectService, choiceId],
  );

  const checkGroups = useStoryEntities({
    storyId,
    enabled,
    load: loadCheckGroups,
    events: CHECK_GROUP_EVENTS,
    label: 'choice check groups',
  });
  const checks = useStoryEntities({
    storyId,
    enabled,
    load: loadChecks,
    events: CHECK_EVENTS,
    label: 'choice checks',
  });
  const effects = useStoryEntities({
    storyId,
    enabled,
    load: loadEffects,
    events: EFFECT_EVENTS,
    label: 'choice effects',
  });
  const scenes = useStoryEntities({
    storyId,
    enabled,
    load: sceneService.getAllByStoryId,
    events: SCENE_EVENTS,
    label: 'scene names',
  });
  const items = useStoryEntities({
    storyId,
    enabled,
    load: itemService.getItemsByStoryId,
    events: ITEM_EVENTS,
    label: 'item names',
  });

  const sceneNamesById = useMemo(
    () => Object.fromEntries(scenes.map((scene) => [scene.id, scene.name])),
    [scenes],
  );
  const itemNamesById = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, item.name])),
    [items],
  );

  return { checkGroups, checks, effects, sceneNamesById, itemNamesById };
}
