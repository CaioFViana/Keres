import type { AppDrizzleClient } from '../../db';
import type { ServerSelect } from '../../db/schema';
import { useStoryListStore } from '../../state/storyListStore';
import type { ServerStoryPreview } from '../SyncEngineService';
import { createStoryService } from '../storymanagement/StoryService';
import { dropRevokedServerStories } from './dropRevokedServerStories';

export interface StoryImportEngine {
  fetchServerStoryPreviews(server: ServerSelect): Promise<ServerStoryPreview[]>;
  /** Where present, what the server did not list is acted on too (copies of lost access are removed). */
  fetchServerStoryPreviewsOrNull?(server: ServerSelect): Promise<ServerStoryPreview[] | null>;
  downloadAndImportStory(
    queriedServerId: string,
    storyId: string,
    userId: string,
    role: ServerStoryPreview['role'],
  ): Promise<void>;
}

/** One queue per server: every import sees what the previous one already saved. */
const queues = new Map<string, Promise<unknown>>();

/**
 * Downloads every story the server lets this user read that the device does not have yet, then
 * refreshes the story list. Runs are queued per server - accepting an invitation and the realtime
 * nudge that follows it both land here, and two concurrent runs would each see the story as missing
 * and import it twice. Resolves whether anything arrived.
 */
export function importNewServerStories(
  db: AppDrizzleClient,
  engine: StoryImportEngine,
  server: ServerSelect,
): Promise<boolean> {
  const previous = queues.get(server.id) ?? Promise.resolve();
  const run = previous
    .catch(() => undefined)
    .then(async () => {
      // A list the server really answered lets the device also drop what it lost access to; a failed
      // request is not an empty list, and is never acted on as one.
      const answered = engine.fetchServerStoryPreviewsOrNull
        ? await engine.fetchServerStoryPreviewsOrNull(server)
        : undefined;
      const previews =
        answered ??
        (engine.fetchServerStoryPreviewsOrNull
          ? []
          : await engine.fetchServerStoryPreviews(server));
      if (answered) await dropRevokedServerStories(db, server, answered);
      const localStories = await db.query.stories.findMany({ columns: { id: true } });
      const localIds = new Set(localStories.map((story) => story.id));
      let downloadedAny = false;
      for (const preview of previews) {
        if (localIds.has(preview.storyId)) continue;
        await engine.downloadAndImportStory(
          server.id,
          preview.storyId,
          server.idUser,
          preview.role,
        );
        downloadedAny = true;
      }
      // A story saved locally stays invisible in `StorySelectionScreen` until the list store is
      // asked for a fresh `fetchStories`.
      if (downloadedAny) {
        await useStoryListStore.getState().fetchStories(createStoryService(db));
      }
      return downloadedAny;
    });
  queues.set(server.id, run);
  return run;
}
