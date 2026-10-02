import { useEffect } from 'react';
import { AppState } from 'react-native';
import { flushPendingCanvasDrafts } from '../services/canvasDraftPersistence';
import { flushPendingEditorDrafts } from '../services/EditorDraftService';

/**
 * Drafts are written a moment after the last keystroke, not on every one. A phone that sends the app to the
 * background may suspend or kill it before that moment comes, and the last thing typed would be the one thing
 * lost - so whatever is still waiting is written as the app leaves the foreground.
 */
export function useFlushDraftsOnBackground(): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      void Promise.all([flushPendingEditorDrafts(), flushPendingCanvasDrafts()]).catch((error) => {
        console.error('Failed to flush pending drafts:', error);
      });
    });
    return () => subscription.remove();
  }, []);
}
