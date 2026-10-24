import type { ShowcaseStoryDetail } from '@keres/shared';
import { isProtectedStub } from '@keres/shared';
import { useCallback, useMemo, useState } from 'react';
import { useLoadedResource } from '@/src/hooks/lists/useLoadedResource';
import {
  showcaseApiService,
  ShowcaseUnlockError,
  type ShowcaseSource,
  type ShowcaseUnlockFailure,
} from '@/src/services/api/ShowcaseApiService';
import { showcaseReadFailure } from './showcaseReadStatus';

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
  const [unlocked, setUnlocked] = useState<ShowcaseStoryDetail | null>(null);
  const [unlockToken, setUnlockToken] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockFailure, setUnlockFailure] = useState<ShowcaseUnlockFailure | null>(null);

  const load = useMemo(
    () => (source ? () => showcaseApiService.getStory(source, storyId) : null),
    [source, storyId],
  );
  const { data, failed, error, retry } = useLoadedResource<Awaited<
    ReturnType<typeof showcaseApiService.getStory>
  > | null>({ load, initial: null, label: 'the story', quiet: true });

  const state = useMemo<ShowcaseStoryState>(() => {
    if (unlocked) return { status: 'open', story: unlocked };
    if (data) return isProtectedStub(data) ? { status: 'locked' } : { status: 'open', story: data };
    return failed ? { status: showcaseReadFailure(error) } : { status: 'loading' };
  }, [unlocked, data, failed, error]);

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
        setUnlocked(result);
      } catch (error) {
        setUnlockFailure(error instanceof ShowcaseUnlockError ? error.reason : 'failed');
      } finally {
        setUnlocking(false);
      }
    },
    [source, storyId],
  );

  const reload = useCallback(() => {
    setUnlocked(null);
    retry();
  }, [retry]);

  return { state, unlockToken, unlocking, unlockFailure, unlock, reload };
}
