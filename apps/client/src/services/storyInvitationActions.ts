import type { AppDrizzleClient } from '../db';
import type { ServerSelect } from '../db/schema';
import { storyInvitationApi } from './StoryInvitationApiService';
import { createStoryInvitationService, type ServerStoryInvitation } from './StoryInvitationService';
import { syncEngine } from './sync/appSyncEngine';
import { importNewServerStories } from './sync/importNewServerStories';

/**
 * Accepts an invitation and brings the story in right away, without waiting for the realtime nudge
 * (which may never come on a flaky socket). The import is queued per server, so the nudge arriving
 * too does not download the story twice.
 */
export async function acceptStoryInvitation(
  db: AppDrizzleClient,
  server: ServerSelect,
  invitation: ServerStoryInvitation,
): Promise<void> {
  await storyInvitationApi.accept(server, invitation.id);
  await createStoryInvitationService(db).syncWithServer(server);
  await importNewServerStories(db, syncEngine, server);
}

/** Declines (invitee) or withdraws (owner) an invitation. */
export async function closeStoryInvitation(
  db: AppDrizzleClient,
  server: ServerSelect,
  invitation: Pick<ServerStoryInvitation, 'id'>,
): Promise<void> {
  await storyInvitationApi.remove(server, invitation.id);
  await createStoryInvitationService(db).syncWithServer(server);
}
