import { useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import { createChoiceCheckGroupService } from '@/src/services/storymanagement/choices-stats/ChoiceCheckGroupService';
import { createChoiceCheckService } from '@/src/services/storymanagement/choices-stats/ChoiceCheckService';
import { createChoiceService } from '@/src/services/storymanagement/choices-stats/ChoiceService';
import { createEffectService } from '@/src/services/storymanagement/choices-stats/EffectService';
import { createItemService } from '@/src/services/storymanagement/entities/ItemService';
import { createSceneService } from '@/src/services/storymanagement/scenes-chapters/SceneService';

/** The services the choice detail talks to: the record, its checks and effects, and the names it shows. */
export function useChoiceDetailServices() {
  const drizzleDb = useDrizzle();
  return useMemo(
    () => ({
      choiceService: createChoiceService(drizzleDb),
      checkGroupService: createChoiceCheckGroupService(drizzleDb),
      checkService: createChoiceCheckService(drizzleDb),
      effectService: createEffectService(drizzleDb),
      sceneService: createSceneService(drizzleDb),
      itemService: createItemService(drizzleDb),
    }),
    [drizzleDb],
  );
}

export type ChoiceDetailServices = ReturnType<typeof useChoiceDetailServices>;
