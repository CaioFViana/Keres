import type { PublicationLabelMode, StoryPublication } from '@keres/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';
import { useDrizzle } from '@/src/db';
import * as schema from '@/src/db/schema';
import type { ServerSelect, StorySelect } from '@/src/db/schema';
import { isAbortError, isOfflineError } from '@/src/services/api/apiClient';
import {
  type CompiledPublishUpload,
  publicationApiService,
  type PublishManuscriptOptions,
  type PublishReaderOptions,
  type StoryShowcaseState,
} from '@/src/services/api/PublicationApiService';
import { createPublicationService } from '@/src/services/publication/PublicationService';
import { createServerService } from '@/src/services/servers/ServerService';
import { compilePublishArtifacts } from '@/src/services/storymanagement/scenes-chapters/PublishCompileService';
import { fetchServerStoryPreviews } from '@/src/services/sync/StoryTransfer';
import { useConnectivityStore } from '@/src/state/sync/connectivityStore';
import { useNotificationStore } from '@/src/state/ui/notificationStore';
import { AppAlert } from '@/src/state/ui/AppAlert';
import { usePublishManuscript } from './usePublishManuscript';
import { logger } from '@/src/utils/logging/logger';

/**
 * A story's public address.
 *
 * Assembled here from `servers.url` because the app already knows where the server lives - the
 * showcase is served by the same process and on the same origin as the API, under `/showcase` (the
 * web client is under `/client`; see `SHOWCASE_PATH_PREFIX` and `HOSTED_CLIENT_PATH_PREFIX` in
 * apps/api/src/services/static-delivery/hostedClient.ts), so
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
 * Where a publish stands, so the screen can tell compiling the bytes apart
 * from uploading them: one `busy` cannot say which is happening.
 */
export type PublishPhase = 'idle' | 'compiling' | 'uploading';

/**
 * A publish that did not finish: the message already toasted (the card
 * repeats it so it outlives the toast) and whether trying again can help. A
 * refused upload (409/429/403/400/413/415) fails the same bytes again, so it
 * offers no retry; a lost connection or an unknown failure does.
 */
export interface PublishError {
  message: string;
  kind: 'compile' | 'upload';
  retryable: boolean;
}

/** The bytes a failed upload keeps: a retry re-enters at the upload with these. */
interface CompiledPublishAttempt {
  storyId: string;
  operationVersion: number;
  manuscriptOptions: PublishManuscriptOptions | undefined;
  readerOptions: PublishReaderOptions | undefined;
  arcId: string | undefined;
  files: { manuscript?: CompiledPublishUpload; reader?: CompiledPublishUpload };
}

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
  /** Whether the server's public pages are on, when it said; publishing is refused where they are off. */
  const [showcaseEnabled, setShowcaseEnabled] = useState<boolean | undefined>(undefined);
  const [labelMode, setLabelMode] = useState<PublicationLabelMode>('both');
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<PublishPhase>('idle');
  /** 0–1 while bytes go up; null on the legacy call, whose body is only options. */
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [publishError, setPublishError] = useState<PublishError | null>(null);
  /** The last compiled bytes, kept only for an upload retry; cleared everywhere else. */
  const compiledAttempt = useRef<CompiledPublishAttempt | null>(null);
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

      setShowcaseEnabled(await publicationApiService.isShowcaseEnabled(linked));

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
          logger.debug('useStoryPublishing: could not read showcase state.', remoteError);
        }
      }

      // The padlock and the label start by reflecting how the story is published today: a control saying
      // "no password" on a protected story would make the person believe they had already made it public.
      if (seededStoryId.current !== found.id) {
        seededStoryId.current = found.id;
        setUsePassword(remote?.visibility === 'password');
        setLabelMode(remote?.labelMode ?? 'both');
        setPassword('');
        // Another story's bytes and failures stay with it: retrying them here would upload the wrong book.
        compiledAttempt.current = null;
        setPublishError(null);
        setPhase('idle');
        setUploadProgress(null);
        resetForStory(found);
      }
    } catch (loadError) {
      logger.debug('useStoryPublishing: failed to load the story.', loadError);
      setError(t('failed_to_load_story'));
    } finally {
      setLoading(false);
    }
  }, [drizzleDb, resetForStory, storyId, t]);

  /** Why the story cannot be published right now - or `null` if it can. */
  const reason = (() => {
    if (!story || !server) return null;
    if (isOffline(server.id)) return t('publish_blocked_offline');
    // Said before the button is pressed, not as the server's refusal after it.
    if (showcaseEnabled === false) return t('publish_blocked_showcase_off');
    if (pendingOperations > 0) {
      return t('publish_blocked_pending_operations', { count: pendingOperations });
    }
    // Unknown when the server did not answer: its own check (409) still refuses a stale publish.
    if (serverVersion !== undefined && (story.lastServerSyncedLog ?? 0) < serverVersion) {
      return t('publish_blocked_not_synced');
    }
    return null;
  })();

  /** Cancels a publish in flight: the compile between its stages, or the upload. */
  const publishController = useRef<AbortController | null>(null);

  const cancelPublish = useCallback(() => {
    publishController.current?.abort();
  }, []);

  /**
   * Maps an upload failure to its message and its card: the toast stays what
   * it always was, and a refusal (the same bytes fail again) offers no retry.
   * A retry repeats the same words, so it pushes past the store's dedupe.
   */
  const reportUploadError = useCallback(
    (uploadError: unknown, isRetry: boolean) => {
      const notifyFailure = (message: string) => {
        if (isRetry) showNotification(message, 'error', { force: true });
        else showNotification(message, 'error');
      };
      const status = (uploadError as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        // The server disagrees with our counter: synchronizing is the only way.
        // After an upload this still only means sync-then-retry, never success.
        const message = t('publish_blocked_not_synced');
        setPublishError({ message, kind: 'upload', retryable: false });
        notifyFailure(message);
      } else if (status === 429) {
        // The plan's daily number of publications is used up, or the works it may show at once.
        const message = t(
          manuscript.releaseArcId ? 'publish_works_limit_reached' : 'publish_limit_reached',
        );
        setPublishError({ message, kind: 'upload', retryable: false });
        notifyFailure(message);
      } else if (status === 403) {
        const message = t('publish_showcase_disabled');
        setPublishError({ message, kind: 'upload', retryable: false });
        notifyFailure(message);
      } else if (status === 400 || status === 413 || status === 415) {
        // A verdict on the bytes themselves (rejected options, over the
        // ceiling, unsupported type): retrying the same bytes changes nothing,
        // so it is told once and never retried blindly.
        logger.debug('useStoryPublishing: publish refused.', uploadError);
        const message = t('publish_failed');
        setPublishError({ message, kind: 'upload', retryable: false });
        notifyFailure(message);
      } else if (isOfflineError(uploadError)) {
        const message = t('publish_blocked_offline');
        setPublishError({ message, kind: 'upload', retryable: true });
        notifyFailure(message);
      } else {
        logger.debug('useStoryPublishing: publish failed.', uploadError);
        const message = t('publish_failed');
        setPublishError({ message, kind: 'upload', retryable: true });
        notifyFailure(message);
      }
    },
    [manuscript.releaseArcId, showNotification, t],
  );

  /**
   * What a finished upload does, however it went up: the dropped-extras
   * notice, the mirror sync, and the public address in hand.
   */
  const finishPublish = useCallback(
    async (
      serverValue: ServerSelect,
      storyValue: StorySelect,
      published: StoryPublication,
      manuscriptOptions: PublishManuscriptOptions | undefined,
      readerOptions: PublishReaderOptions | undefined,
      passwordProtected: boolean,
    ) => {
      // A server that predates these extras publishes the version and drops them without a word:
      // saying so beats a page that silently lacks the button.
      const droppedExtras =
        (manuscriptOptions && !published.manuscriptFormat) ||
        (readerOptions && published.readerByteSize == null);
      if (droppedExtras) {
        showNotification(t('publish_extras_ignored'), 'error');
      }
      await createPublicationService(drizzleDb).syncPublicationsWithServer(serverValue);

      // Publishing without saying where the story ended up leaves the person with nothing in hand - the
      // address is the action's result, so it appears immediately and stays on the screen.
      const url = buildStoryPublicUrl(serverValue.url, storyValue.id);
      AppAlert.alert(
        t('publish_version_created'),
        `${t('publish_link_intro', { label: published.label })}\n\n${url}${
          passwordProtected ? `\n\n${t('publish_link_password_reminder')}` : ''
        }`,
        [
          { text: t('publish_open_link'), onPress: () => void Linking.openURL(url) },
          { text: t('close'), style: 'cancel' },
        ],
      );
      setPassword('');
      await load();
    },
    [drizzleDb, load, showNotification, t],
  );

  const runPublish = useCallback(async () => {
    if (!story || !server) return;
    // Said before the button is pressed, not as the server's refusal after
    // it: a blocked publish compiles nothing and uploads nothing.
    if (reason) {
      showNotification(reason, 'error');
      return;
    }
    if (busy) return;
    const controller = new AbortController();
    publishController.current = controller;
    setBusy(true);
    setPublishError(null);
    setUploadProgress(null);
    try {
      // Visibility travels with the publication, rather than in a second call only when there is a password:
      // that way publishing with the padlock off really does make the story public, and does not silently
      // leave an old password in force.
      const manuscriptOptions = manuscript.buildOptions(story, t, i18n.language);
      const readerOptions = manuscript.buildReaderOptions(story, t, i18n.language);
      // The server's sequence, as far as this device has read it - what the server checks against.
      const operationVersion = story.lastServerSyncedLog ?? 0;
      const visibility = usePassword ? 'password' : 'public';
      const publishPassword = usePassword ? password.trim() : undefined;
      const arcId = manuscript.releaseArcId ?? undefined;
      // A fresh publish supersedes bytes kept for a retry: they belong to older choices.
      compiledAttempt.current = null;
      let published: Awaited<ReturnType<typeof publicationApiService.publish>>;
      if (!manuscriptOptions && !readerOptions) {
        // The story file alone: no bytes to compile, the legacy call as it always was.
        setPhase('uploading');
        published = await publicationApiService.publish(
          server,
          story.id,
          operationVersion,
          labelMode,
          visibility,
          publishPassword,
          manuscriptOptions,
          readerOptions,
          manuscript.includePackage,
          arcId,
        );
      } else if (!(await publicationApiService.supportsCompiledUpload(server))) {
        // An older server only speaks the legacy publication: the options go
        // over and it compiles from its own copy, exactly as before.
        setPhase('uploading');
        published = await publicationApiService.publish(
          server,
          story.id,
          operationVersion,
          labelMode,
          visibility,
          publishPassword,
          manuscriptOptions,
          readerOptions,
          manuscript.includePackage,
          arcId,
        );
      } else {
        // The manuscript and the reader are compiled on this device - drawn
        // straight from their content, writing nothing to the Gallery - and
        // ride up with the publication for the server to store as sent.
        setPhase('compiling');
        let compiled: Awaited<ReturnType<typeof compilePublishArtifacts>>;
        try {
          compiled = await compilePublishArtifacts(
            drizzleDb,
            story,
            manuscriptOptions,
            readerOptions,
            t,
            controller.signal,
          );
        } catch (compileError) {
          // Cancelled mid-compile: stopping is the answer, not a notice.
          if (isAbortError(compileError)) {
            return;
          }
          // Nothing compiled, so there is nothing to upload and nothing to
          // keep: a retry rebuilds from scratch.
          logger.debug('useStoryPublishing: compile failed.', compileError);
          const message = t('publish_compile_failed');
          setPublishError({ message, kind: 'compile', retryable: true });
          showNotification(message, 'error');
          return;
        }
        const files = {
          ...(compiled.manuscript
            ? {
                manuscript: {
                  bytes: compiled.manuscript.bytes,
                  filename: `manuscript.${compiled.manuscript.extension}`,
                  mimeType: compiled.manuscript.mimeType,
                },
              }
            : {}),
          ...(compiled.reader
            ? {
                reader: {
                  bytes: compiled.reader.bytes,
                  filename: 'reader.html',
                  mimeType: compiled.reader.mimeType,
                },
              }
            : {}),
        };
        // The bytes for a retry: it re-enters at the upload with these.
        compiledAttempt.current = {
          storyId: story.id,
          operationVersion,
          manuscriptOptions,
          readerOptions,
          arcId,
          files,
        };
        setPhase('uploading');
        published = await publicationApiService.publishCompiled(
          server,
          story.id,
          operationVersion,
          labelMode,
          visibility,
          publishPassword,
          manuscriptOptions,
          readerOptions,
          manuscript.includePackage,
          arcId,
          files,
          {
            signal: controller.signal,
            onUploadProgress: (fraction) => setUploadProgress(fraction),
          },
        );
      }
      await finishPublish(server, story, published, manuscriptOptions, readerOptions, usePassword);
      compiledAttempt.current = null;
    } catch (publishError) {
      // Cancelled mid-compile or mid-upload: stopping is the answer, not a notice.
      if (isAbortError(publishError)) {
        return;
      }
      reportUploadError(publishError, false);
    } finally {
      if (publishController.current === controller) {
        publishController.current = null;
      }
      setPhase('idle');
      setUploadProgress(null);
      setBusy(false);
    }
  }, [
    busy,
    drizzleDb,
    finishPublish,
    i18n,
    labelMode,
    manuscript,
    password,
    reason,
    reportUploadError,
    server,
    showNotification,
    story,
    t,
    usePassword,
  ]);

  /**
   * Tries a failed publish again. A failed upload re-enters at the upload
   * with the kept bytes, compiling nothing again; anything else (a failed
   * compile kept no bytes, a legacy call never compiled) starts over.
   */
  const retryPublish = useCallback(async () => {
    // Only a failed publish offers a retry, and only one attempt runs at a time.
    if (busy || !publishError?.retryable) return;
    const attempt = compiledAttempt.current;
    if (!attempt || !story || !server || attempt.storyId !== story.id) {
      await runPublish();
      return;
    }
    if (reason) {
      showNotification(reason, 'error');
      return;
    }
    const controller = new AbortController();
    publishController.current = controller;
    setBusy(true);
    setPublishError(null);
    setUploadProgress(null);
    setPhase('uploading');
    try {
      // The bytes (and the choices they were compiled from) are the attempt's;
      // the label, the padlock and the package are the person's latest.
      const visibility = usePassword ? 'password' : 'public';
      const publishPassword = usePassword ? password.trim() : undefined;
      const published = await publicationApiService.publishCompiled(
        server,
        attempt.storyId,
        attempt.operationVersion,
        labelMode,
        visibility,
        publishPassword,
        attempt.manuscriptOptions,
        attempt.readerOptions,
        manuscript.includePackage,
        attempt.arcId,
        attempt.files,
        {
          signal: controller.signal,
          onUploadProgress: (fraction) => setUploadProgress(fraction),
        },
      );
      await finishPublish(
        server,
        story,
        published,
        attempt.manuscriptOptions,
        attempt.readerOptions,
        usePassword,
      );
      compiledAttempt.current = null;
    } catch (uploadError) {
      // Cancelled mid-upload: stopping is the answer, not a notice.
      if (isAbortError(uploadError)) {
        return;
      }
      reportUploadError(uploadError, true);
    } finally {
      if (publishController.current === controller) {
        publishController.current = null;
      }
      setPhase('idle');
      setUploadProgress(null);
      setBusy(false);
    }
  }, [
    busy,
    finishPublish,
    labelMode,
    manuscript,
    password,
    publishError,
    reason,
    reportUploadError,
    runPublish,
    server,
    showNotification,
    story,
    usePassword,
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
                logger.debug('useStoryPublishing: delete failed.', deleteError);
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
            logger.debug('useStoryPublishing: unpublish failed.', unpublishError);
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
    phase,
    uploadProgress,
    publishError,
    load,
    publish,
    retryPublish,
    cancelPublish,
    deleteVersion,
    unpublish,
  };
}
