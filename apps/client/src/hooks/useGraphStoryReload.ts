import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect } from 'react';
import { entityEventEmitter } from '../utils/EventEmitter';

/**
 * Keeps a graph screen's data current: it reloads when the screen gains focus (its characters,
 * relations or scenes may have changed on another screen) and whenever the story changes elsewhere.
 */
export function useGraphStoryReload(storyId: string | undefined, loadGraph: () => void): void {
  useFocusEffect(
    useCallback(() => {
      loadGraph();
    }, [loadGraph]),
  );

  useEffect(() => {
    const handleRemoteChange = (change: { storyId?: string }) => {
      if (change?.storyId === storyId) {
        loadGraph();
      }
    };
    entityEventEmitter.on('story_data_changed', handleRemoteChange);
    return () => entityEventEmitter.off('story_data_changed', handleRemoteChange);
  }, [storyId, loadGraph]);
}
