import { sceneHeadingPlan } from '@keres/shared';
import { useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { SceneSelect } from '@/src/db/schema';
import { createCharacterSceneService } from '@/src/services/storymanagement/CharacterSceneService';
import { createCharacterService } from '@/src/services/storymanagement/CharacterService';
import { createLocationService } from '@/src/services/storymanagement/LocationService';
import { entityEventEmitter } from '@/src/utils/EventEmitter';
import { useSceneArcMedium } from '@/src/hooks/useSceneArcMedium';

export type ScreenplayPlace = {
  name: string;
  intExt: 'interior' | 'exterior' | 'both' | null;
} | null;

/**
 * What the scene's own screenplay screen has to show: the place and whether it is indoors or out, who is
 * in the scene, and where the scene heading comes from. `null` while loading or when the scene is not
 * part of a screenplay.
 */
export function useScreenplaySceneContext(scene: SceneSelect, bodyText: string) {
  const db = useDrizzle();
  const arcMedium = useSceneArcMedium(scene);
  const [place, setPlace] = useState<ScreenplayPlace>(null);
  const [cast, setCast] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const row = scene.locationId
          ? await createLocationService(db).getById(scene.locationId)
          : undefined;
        if (alive) setPlace(row && !row.isDeleted ? { name: row.name, intExt: row.intExt } : null);
        const relations = await createCharacterSceneService(db).getRelationsForScene(
          scene.storyId,
          scene.id,
        );
        const characters = await Promise.all(
          relations.map((relation) => createCharacterService(db).getById(relation.characterId)),
        );
        if (alive) {
          setCast(
            characters.flatMap((character) =>
              character && !character.isDeleted ? [character.name] : [],
            ),
          );
        }
      } catch {
        if (alive) {
          setPlace(null);
          setCast([]);
        }
      }
    };
    void load();
    entityEventEmitter.on('location_changed', load);
    entityEventEmitter.on('character_changed', load);
    return () => {
      alive = false;
      entityEventEmitter.off('location_changed', load);
      entityEventEmitter.off('character_changed', load);
    };
  }, [db, scene.id, scene.locationId, scene.storyId]);

  const plan = useMemo(
    () => sceneHeadingPlan({ body: bodyText, location: place }),
    [bodyText, place],
  );
  return { isScreenplay: arcMedium === 'screenplay', place, cast, plan };
}
