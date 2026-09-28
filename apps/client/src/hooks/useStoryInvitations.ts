import { useEffect, useState } from 'react';
import { useDrizzle } from '../db';
import {
  createStoryInvitationService,
  STORY_INVITATIONS_CHANGED,
  type ServerStoryInvitation,
} from '../services/StoryInvitationService';
import { entityEventEmitter } from '../utils/EventEmitter';

/**
 * The open story invitations of every registered server, as last synced - read from the local copy,
 * so they stay visible offline - and reloaded whenever a sync changes that copy.
 */
export function useStoryInvitations(): ServerStoryInvitation[] {
  const db = useDrizzle();
  const [invitations, setInvitations] = useState<ServerStoryInvitation[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void (async () => {
        try {
          const rows = await createStoryInvitationService(db).getAll();
          if (!cancelled) setInvitations(rows);
        } catch (error) {
          console.log('useStoryInvitations: could not read the local invitations.', error);
        }
      })();
    };
    load();
    entityEventEmitter.on(STORY_INVITATIONS_CHANGED, load);
    return () => {
      cancelled = true;
      entityEventEmitter.off(STORY_INVITATIONS_CHANGED, load);
    };
  }, [db]);

  return invitations;
}
