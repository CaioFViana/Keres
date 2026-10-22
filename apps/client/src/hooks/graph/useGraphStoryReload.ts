import { useFocusEffect } from '@react-navigation/native';
import { fireAndLog } from '@/src/utils/logging/fireAndLog';
import { useCallback, useEffect } from 'react';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';

/**
 * Keeps a graph screen's data current: it reloads when the screen gains focus (its characters,
 * relations or scenes may have changed on another screen) and whenever the story changes elsewhere.
 */
export function useGraphStoryReload(
  storyId: string | undefined,
  loadGraph: () => void | Promise<void>,
): void {
  useFocusEffect(
    useCallback(() => {
      fireAndLog(loadGraph(), 'The graph reload');
    }, [loadGraph]),
  );

  useEffect(() => {
    const handleRemoteChange = (change: { storyId?: string }) => {
      if (change?.storyId === storyId) {
        fireAndLog(loadGraph(), 'The graph reload');
      }
    };
    entityEventEmitter.on('story_data_changed', handleRemoteChange);
    return () => entityEventEmitter.off('story_data_changed', handleRemoteChange);
  }, [storyId, loadGraph]);
}
