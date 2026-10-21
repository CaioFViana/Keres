import type { ShowcaseStoryDetail } from '@keres/shared';
import { isProtectedStub } from '@keres/shared';
import { useCallback, useEffect, useState } from 'react';
import { isNotFoundError, isOfflineError } from '@/src/services/api/apiClient';
import {
  showcaseApiService,
  ShowcaseUnlockError,
  type ShowcaseSource,
  type ShowcaseUnlockFailure,
} from '@/src/services/api/ShowcaseApiService';
import { logger } from '@/src/utils/logging/logger';

export type ShowcaseStoryState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'unreachable' }
  | { status: 'failed' }
  | { status: 'locked' }
  | { status: 'open'; story: ShowcaseStoryDetail };

export interface ShowcaseStoryHandle {
  state: ShowcaseStoryState;
  /** The token the password gave, for the calls that open the story's files; `null` while it is not behind one. */
  unlockToken: string | null;
  unlocking: boolean;
  /** Why the last attempt to unlock did not work; cleared by the next attempt. */
  unlockFailure: ShowcaseUnlockFailure | null;
  unlock: (password: string) => Promise<void>;
  reload: () => void;
}

/**
 * A story of a server's public site: it is read, and when it turns out to be behind a password the person
 * unlocks it from here. The token is kept in the screen only: it lasts an hour, is good for this one story,
 * and leaving the screen is a fine moment to forget it.
 */
export function useShowcaseStory(
  source: ShowcaseSource | null,
  storyId: string,
): ShowcaseStoryHandle {
  const [state, setState] = useState<ShowcaseStoryState>({ status: 'loading' });
  const [unlockToken, setUnlockToken] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockFailure, setUnlockFailure] = useState<ShowcaseUnlockFailure | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (!source) return undefined;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- going back to "loading" belongs to starting the read.
    setState({ status: 'loading' });
    showcaseApiService
      .getStory(source, storyId)
      .then((result) => {
        if (cancelled) return;
        setState(
          isProtectedStub(result) ? { status: 'locked' } : { status: 'open', story: result },
        );
      })
      .catch((error) => {
        if (cancelled) return;
        logger.debug('useShowcaseStory: could not read the story.', error);
        setState({
          status: isNotFoundError(error)
            ? 'not_found'
            : isOfflineError(error)
              ? 'unreachable'
              : 'failed',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [source, storyId, reloads]);

  const unlock = useCallback(
    async (password: string) => {
      if (!source) return;
      setUnlocking(true);
      setUnlockFailure(null);
      try {
        const token = await showcaseApiService.unlockStory(source, storyId, password);
        const result = await showcaseApiService.getStory(source, storyId, token);
        if (isProtectedStub(result)) {
          setUnlockFailure('failed');
          return;
        }
        setUnlockToken(token);
        setState({ status: 'open', story: result });
      } catch (error) {
        setUnlockFailure(error instanceof ShowcaseUnlockError ? error.reason : 'failed');
      } finally {
        setUnlocking(false);
      }
    },
    [source, storyId],
  );

  const reload = useCallback(() => setReloads((count) => count + 1), []);

  return { state, unlockToken, unlocking, unlockFailure, unlock, reload };
}
