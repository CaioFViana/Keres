import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { logger } from '@/src/utils/logging/logger';
import { readStoredSceneBodyText } from './useSceneBodyDraft';

/**
 * Whether a stored draft of the scene body exists AND differs from the saved body: a draft that
 * already matches (saved elsewhere, then revisited) reads clean, and corrupt or missing rows read
 * as no draft rather than failing the screen.
 *
 * It re-reads when the screen gains focus too: leaving the editor without saving emits no scene
 * event, so the data alone would leave a stale indicator behind. An answer is only used for the
 * scene and body it was read for.
 */
export function useSceneDraftFlag(
  storyId: string | undefined,
  sceneId: string,
  body: string | null | undefined,
): boolean {
  const key = storyId ? `${storyId}:${sceneId}:${body ?? ''}` : null;
  const [read, setRead] = useState<{ key: string; hasDraft: boolean } | null>(null);

  const refresh = useCallback(async () => {
    if (!key || !storyId) return;
    try {
      const draft = await readStoredSceneBodyText(storyId, sceneId);
      setRead({ key, hasDraft: !!draft && draft !== (body ?? '') });
    } catch (error) {
      logger.error('Failed to read the stored scene draft:', error);
    }
  }, [key, storyId, sceneId, body]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return key !== null && read?.key === key && read.hasDraft;
}
