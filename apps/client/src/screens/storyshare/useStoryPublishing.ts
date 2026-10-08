import type { PublicationLabelMode, StoryPublication } from '@keres/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';
import { useDrizzle } from '../../db';
import * as schema from '../../db/schema';
import type { ServerSelect, StorySelect } from '../../db/schema';
import { isOfflineError } from '../../services/apiClient';
import {
  publicationApiService,
  type StoryShowcaseState,
} from '../../services/PublicationApiService';
import { createPublicationService } from '../../services/PublicationService';
import { createServerService } from '../../services/ServerService';
import { refreshStaleSketchSnapshots } from '../../services/storymanagement/ManuscriptPagesService';
import { fetchServerStoryPreviews } from '../../services/sync/StoryTransfer';
import { useConnectivityStore } from '../../state/connectivityStore';
import { useNotificationStore } from '../../state/notificationStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { AppAlert } from '../../utils/AppAlert';
import { usePublishManuscript } from './usePublishManuscript';

/**
 * A story's public address.
 *
 * Assembled here from `servers.url` because the app already knows where the server lives - the
 * showcase is served by the same process and on the same origin as the API, under `/showcase` (the
 * web client is under `/client`; see `SHOWCASE_PATH_PREFIX` and `HOSTED_CLIENT_PATH_PREFIX` in
 * apps/api/src/services/hostedClient.ts), so
 * there is nothing to ask the server.
 */
export function buildStoryPublicUrl(serverUrl: string, storyId: string): string {
  return `${serverUrl.replace(/\/+$/, '')}/showcase/story/${storyId}`;
}

/**
 * Why the story cannot be published at all, as opposed to not right now (`reason`): it never left this
 * device, or it is somebody else's. Publishing exposes the story to the world, and that decision belongs
 * to its owner.
 */
export type PublishBlocker = 'no-server' | 'not-owner';

/**
 * Publishing the open story to its server's Showcase.
 *
 * The three conditions for the button (online, no pending operation, the counter matching the server's)
 * are checked again by the server, which returns 409 if they do not match. Here they exist so the person
 * understands *why* they cannot, instead of facing a dead button.
 */
export function useStoryPublishing(storyId: string | undefined) {
  const { t, i18n } = useTranslation();
  const drizzleDb = useDrizzle();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const userId = useUserSettingsStore((state) => state.userId);
  const isOffline = useConnectivityStore((state) => state.isOffline);
  const manuscript = usePublishManuscript(drizzleDb);
  const { resetForStory } = manuscript;
  /** The story whose choices (label, padlock, manuscript) were last seeded: reloading must not undo the person's picks. */
  const seededStoryId = useRef<string | null>(null);

  const [story, setStory] = useState<StorySelect | null>(null);
  const [server, setServer] = useState<ServerSelect | null>(null);
  const [blocker, setBlocker] = useState<PublishBlocker | null>(null);
  const [pendingOperations, setPendingOperations] = useState(0);
  const [showcase, setShowcase] = useState<StoryShowcaseState | null>(null);
  /** The story's current version on its server, when the server answered. */
  const [serverVersion, setServerVersion] = useState<number | undefined>(undefined);
  const [labelMode, setLabelMode] = useState<PublicationLabelMode>('both');
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!storyId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const found = await drizzleDb.query.stories.findFirst({
        where: and(eq(schema.stories.id, storyId), eq(schema.stories.isDeleted, false)),
      });
      const servers = await createServerService(drizzleDb).getAllServers();
      const linked = found?.serverId
        ? servers.find((item) => item.id === found.serverId)
        : undefined;

      setStory(found ?? null);
      setServer(linked ?? null);
      if (!found || !linked) {
        setBlocker('no-server');
        return;
      }
      if (found.myRole !== 'owner') {
        setBlocker('not-owner');
        return;
      }
      setBlocker(null);

      const pending = await drizzleDb.query.operationLogs.findMany({
        where: and(
          eq(schema.operationLogs.storyId, found.id),
          eq(schema.operationLogs.isSynced, false),
          isNull(schema.operationLogs.conflictState),
        ),
        columns: { id: true },
      });
      setPendingOperations(pending.length);

      // Where the server's sequence stands. `lastServerSyncedLog` counts in that same sequence (how far this
      // device has read it); `lastOperationLog` is the device's own counter and never matches it after the
      // story was sent up, since an upload restarts the server's sequence at 0.
      const previews = await fetchServerStoryPreviews(linked);
      setServerVersion(
        previews.find((preview) => preview.storyId === found.id)?.lastOperationVersion,
      );

      // The local mirror is enough to show the versions; the server is what brings the current visibility.
      const localVersions = await createPublicationService(drizzleDb).getPublicationsForStory(
        found.id,
      );
      setShowcase({
        isPublished: localVersions.length > 0,
        visibility: 'public',
        labelMode: 'both',
        hasPassword: false,
        publications: localVersions.map(
          (version) =>
            ({
              id: version.id,
              storyId: version.storyId,
              label: version.label,
              operationVersion: version.operationVersion,
              byteSize: version.byteSize,
              createdAt: version.createdAt,
            }) as StoryPublication,
        ),
      });

      // The authoritative state, when the server answers. Failing here does not spoil the screen - the local
      // mirror above has already made it usable.
      let remote: StoryShowcaseState | null = null;
      try {
        remote = await publicationApiService.getStoryShowcase(linked, found.id);
        setShowcase(remote);
      } catch (remoteError) {
        if (!isOfflineError(remoteError)) {
          console.log('useStoryPublishing: could not read showcase state.', remoteError);
        }
      }

      // The padlock and the label start by reflecting how the story is published today: a control saying
      // "no password" on a protected story would make the person believe they had already made it public.
      if (seededStoryId.current !== found.id) {
        seededStoryId.current = found.id;
        setUsePassword(remote?.visibility === 'password');
        setLabelMode(remote?.labelMode ?? 'both');
        setPassword('');
        resetForStory(found);
      }
    } catch (loadError) {
      console.log('useStoryPublishing: failed to load the story.', loadError);
      setError(t('failed_to_load_story'));
    } finally {
      setLoading(false);
    }
  }, [drizzleDb, resetForStory, storyId, t]);

  /** Why the story cannot be published right now - or `null` if it can. */
  const reason = (() => {
    if (!story || !server) return null;
    if (isOffline(server.id)) return t('publish_blocked_offline');
    if (pendingOperations > 0) {
      return t('publish_blocked_pending_operations', { count: pendingOperations });
    }
    // Unknown when the server did not answer: its own check (409) still refuses a stale publish.
    if (serverVersion !== undefined && (story.lastServerSyncedLog ?? 0) < serverVersion) {
      return t('publish_blocked_not_synced');
    }
    return null;
  })();

  const runPublish = useCallback(async () => {
    if (!story || !server) return;
    setBusy(true);
    try {
      // The server compiles the pages from what it was sent, so a Sketch changed since its snapshot is
      // redrawn first. The new snapshot is a change like any other: it has to sync before it can be published.
      const redrawn = userId ? await refreshStaleSketchSnapshots(drizzleDb, userId, story.id) : 0;
      if (redrawn > 0) {
        showNotification(t('publish_snapshots_redrawn', { count: redrawn }), 'warning');
        await load();
        return;
      }
      // Visibility travels with the publication, rather than in a second call only when there is a password:
      // that way publishing with the padlock off really does make the story public, and does not silently
      // leave an old password in force.
      const manuscriptOptions = manuscript.buildOptions(story, t, i18n.language);
      const readerOptions = manuscript.buildReaderOptions(story, t, i18n.language);
      const published = await publicationApiService.publish(
        server,
        story.id,
        // The server's sequence, as far as this device has read it - what the server checks against.
        story.lastServerSyncedLog ?? 0,
        labelMode,
        usePassword ? 'password' : 'public',
        usePassword ? password.trim() : undefined,
        manuscriptOptions,
        readerOptions,
        manuscript.includePackage,
        manuscript.releaseArcId ?? undefined,
      );
      // A server that predates these extras publishes the version and drops them without a word:
      // saying so beats a page that silently lacks the button.
      const droppedExtras =
        (manuscriptOptions && !published.manuscriptFormat) ||
        (readerOptions && published.readerByteSize == null);
      if (droppedExtras) {
        showNotification(t('publish_extras_ignored'), 'error');
      }
      await createPublicationService(drizzleDb).syncPublicationsWithServer(server);

      // Publishing without saying where the story ended up leaves the person with nothing in hand - the
      // address is the action's result, so it appears immediately and stays on the screen.
      const url = buildStoryPublicUrl(server.url, story.id);
      AppAlert.alert(
        t('publish_version_created'),
        `${t('publish_link_intro', { label: published.label })}\n\n${url}${
          usePassword ? `\n\n${t('publish_link_password_reminder')}` : ''
        }`,
        [
          { text: t('publish_open_link'), onPress: () => void Linking.openURL(url) },
          { text: t('close'), style: 'cancel' },
        ],
      );
      setPassword('');
      await load();
    } catch (publishError) {
      const status = (publishError as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        // The server disagrees with our counter: synchronizing is the only way.
        showNotification(t('publish_blocked_not_synced'), 'error');
      } else if (status === 429) {
        // The plan's daily number of publications is used up, or the works it may show at once.
        showNotification(
          t(manuscript.releaseArcId ? 'publish_works_limit_reached' : 'publish_limit_reached'),
          'error',
        );
      } else if (status === 403) {
        showNotification(t('publish_showcase_disabled'), 'error');
      } else if (isOfflineError(publishError)) {
        showNotification(t('publish_blocked_offline'), 'error');
      } else {
        console.log('useStoryPublishing: publish failed.', publishError);
        showNotification(t('publish_failed'), 'error');
      }
    } finally {
      setBusy(false);
    }
  }, [
    drizzleDb,
    i18n,
    labelMode,
    load,
    manuscript,
    password,
    server,
    showNotification,
    story,
    t,
    usePassword,
    userId,
  ]);

  const publish = useCallback(() => {
    if (usePassword && password.trim().length < 4) {
      showNotification(t('publish_password_too_short'), 'error');
      return;
    }
    if (manuscript.nothingSelected) {
      showNotification(t('publish_select_one'), 'error');
      return;
    }

    // Visibility applies to the whole story: removing the password now also opens the versions that were
    // already published behind it. That is not obvious from a "publish" button, so it is said before it
    // happens, not afterwards.
    const opensProtectedVersions =
      !usePassword && showcase?.visibility === 'password' && showcase.publications.length > 0;

    if (!opensProtectedVersions) {
      void runPublish();
      return;
    }

    AppAlert.alert(
      t('publish_opening_protected_title'),
      t('publish_opening_protected_message', { count: showcase.publications.length }),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('publish_opening_protected_confirm'), onPress: () => void runPublish() },
      ],
    );
  }, [manuscript, password, runPublish, showcase, showNotification, t, usePassword]);

  const deleteVersion = useCallback(
    (publication: StoryPublication) => {
      if (!story || !server) return;
      AppAlert.alert(
        t('publish_delete_version_title'),
        t('publish_delete_version_message', { label: publication.label }),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: async () => {
              setBusy(true);
              try {
                await publicationApiService.deletePublication(server, story.id, publication.id);
                await createPublicationService(drizzleDb).syncPublicationsWithServer(server);
                showNotification(t('publish_version_deleted'), 'success');
                await load();
              } catch (deleteError) {
                console.log('useStoryPublishing: delete failed.', deleteError);
                showNotification(t('publish_failed'), 'error');
              } finally {
                setBusy(false);
              }
            },
          },
        ],
      );
    },
    [drizzleDb, load, server, showNotification, story, t],
  );

  const unpublish = useCallback(() => {
    if (!story || !server) return;
    AppAlert.alert(t('publish_unpublish_title'), t('publish_unpublish_message'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('publish_unpublish_confirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await publicationApiService.unpublish(server, story.id);
            await createPublicationService(drizzleDb).syncPublicationsWithServer(server);
            showNotification(t('publish_unpublished'), 'success');
            await load();
          } catch (unpublishError) {
            console.log('useStoryPublishing: unpublish failed.', unpublishError);
            showNotification(t('publish_failed'), 'error');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [drizzleDb, load, server, showNotification, story, t]);

  return {
    loading,
    error,
    blocker,
    story,
    server,
    showcase,
    reason,
    manuscript,
    labelMode,
    setLabelMode,
    usePassword,
    setUsePassword,
    password,
    setPassword,
    busy,
    load,
    publish,
    deleteVersion,
    unpublish,
  };
}
