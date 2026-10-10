import { useEffect, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { SceneSelect } from '@/src/db/schema';
import { createSceneService } from '@/src/services/storymanagement/SceneService';

/** A scene of the local database: `undefined` while it is read, `null` when it is missing or deleted. */
export function useSceneRecord(sceneId: string): SceneSelect | null | undefined {
  const db = useDrizzle();
  const [scene, setScene] = useState<SceneSelect | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    void createSceneService(db)
      .getById(sceneId)
      .then((row) => {
        if (alive) setScene(row && !row.isDeleted ? row : null);
      })
      .catch(() => {
        if (alive) setScene(null);
      });
    return () => {
      alive = false;
    };
  }, [db, sceneId]);

  return scene;
}
