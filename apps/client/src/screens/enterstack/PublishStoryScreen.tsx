import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import type { PublicationLabelMode, StoryPublication } from '@keres/shared';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { and, eq, isNull } from 'drizzle-orm';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDrizzle } from '../../db';
import * as schema from '../../db/schema';
import type { ServerSelect, StorySelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { isOfflineError } from '../../services/apiClient';
import {
  publicationApiService,
  type StoryShowcaseState,
} from '../../services/PublicationApiService';
import { createPublicationService } from '../../services/PublicationService';
import { createServerService } from '../../services/ServerService';
import { useConnectivityStore } from '../../state/connectivityStore';
import { useNotificationStore } from '../../state/notificationStore';
import { useTheme } from '../../theme';
import { AppAlert } from '../../utils/AppAlert';
import { useDocumentTitle } from '../../utils/documentTitle';
import { commonScreenStyleDefs } from '../../theme/commonStyles';

/**
 * Publishing a story to the server's Showcase.
 *
 * Only stories this device can actually publish appear: linked to a server and owned by this account.
 * Somebody else's story, even with write permission, does not make the list - publishing exposes the
 * story to the world, and that decision belongs to its owner.
 *
 * The three conditions for the button (online, no pending operation, the counter matching the
 * server's) are checked again by the server, which returns 409 if they do not match. Here they exist so
 * the person understands *why* they cannot, instead of facing a dead button.
 */

type LabelMode = PublicationLabelMode;

interface StoryRow {
  story: StorySelect;
  server: ServerSelect;
  /** Local operations not yet sent to the server. */
  pendingOperations: number;
}

/**
 * A story's public address.
 *
 * Assembled here from `servers.url` because the app already knows where the server lives - the site is
 * served by the same process and on the same origin as the API (see the catch-all in
 * apps/api/src/index.ts), so there is nothing to ask the server.
 */
export function buildStoryPublicUrl(serverUrl: string, storyId: string): string {
  return `${serverUrl.replace(/\/+$/, '')}/story/${storyId}`;
}

const PublishStoryScreen = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('publish_story_title'));
  const { colors } = useTheme();
  useBackButtonHandler();
  const drizzleDb = useDrizzle();
  const { showNotification } = useNotificationStore();
  const isOffline = useConnectivityStore((state) => state.isOffline);

  const [rows, setRows] = useState<StoryRow[]>([]);
  const [showcaseByStory, setShowcaseByStory] = useState<Record<string, StoryShowcaseState>>({});
  const [expandedStoryId, setExpandedStoryId] = useState<string | null>(null);
  const [labelMode, setLabelMode] = useState<LabelMode>('both');
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [busyStoryId, setBusyStoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const servers = await createServerService(drizzleDb).getAllServers();
      const serverById = new Map(servers.map((server) => [server.id, server]));

      const ownedStories = await drizzleDb.query.stories.findMany({
        where: and(eq(schema.stories.isDeleted, false), eq(schema.stories.myRole, 'owner')),
      });

      const built: StoryRow[] = [];
      for (const story of ownedStories) {
        const server = story.serverId ? serverById.get(story.serverId) : undefined;
        if (!server) {
          continue;
        }
        const pending = await drizzleDb.query.operationLogs.findMany({
          where: and(
            eq(schema.operationLogs.storyId, story.id),
            eq(schema.operationLogs.isSynced, false),
            isNull(schema.operationLogs.conflictState),
          ),
          columns: { id: true },
        });
        built.push({ story, server, pendingOperations: pending.length });
      }
      setRows(built);

      // The local mirror is enough to list them; querying the server is what brings the current visibility,
      // and it is done only for the servers that actually have a story here.
      const publicationService = createPublicationService(drizzleDb);
      const showcase: Record<string, StoryShowcaseState> = {};
      for (const row of built) {
        const localVersions = await publicationService.getPublicationsForStory(row.story.id);
        showcase[row.story.id] = {
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
        };
      }
      setShowcaseByStory(showcase);

      // The authoritative state, when the server answers. Failing here does not spoil the screen - the local
      // mirror above has already made it usable.
      for (const row of built) {
        try {
          const remote = await publicationApiService.getStoryShowcase(row.server, row.story.id);
          setShowcaseByStory((current) => ({ ...current, [row.story.id]: remote }));
        } catch (remoteError) {
          if (!isOfflineError(remoteError)) {
            console.log('PublishStoryScreen: could not read showcase state.', remoteError);
          }
        }
      }
    } catch (loadError) {
      console.log('PublishStoryScreen: failed to load stories.', loadError);
      setError(t('failed_to_load_stories'));
    } finally {
      setLoading(false);
    }
  }, [drizzleDb, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /** Why this story cannot be published right now - or `null` if it can. */
  const blockedReason = useCallback(
    (row: StoryRow): string | null => {
      if (isOffline(row.server.id)) {
        return t('publish_blocked_offline');
      }
      if (row.pendingOperations > 0) {
        return t('publish_blocked_pending_operations', { count: row.pendingOperations });
      }
      if ((row.story.lastServerSyncedLog ?? 0) !== (row.story.lastOperationLog ?? 0)) {
        return t('publish_blocked_not_synced');
      }
      return null;
    },
    [isOffline, t],
  );

  const runPublish = useCallback(
    async (row: StoryRow) => {
      setBusyStoryId(row.story.id);
      try {
        // Visibility travels with the publication, rather than in a second call only when there is a password:
        // that way publishing with the padlock off really does make the story public, and does not silently
        // leave an old password in force.
        const published = await publicationApiService.publish(
          row.server,
          row.story.id,
          row.story.lastOperationLog ?? 0,
          labelMode,
          usePassword ? 'password' : 'public',
          usePassword ? password.trim() : undefined,
        );
        await createPublicationService(drizzleDb).syncPublicationsWithServer(row.server);

        // Publishing without saying where the story ended up leaves the person with nothing in hand - the
        // address is the action's result, so it appears immediately and stays on the screen.
        const url = buildStoryPublicUrl(row.server.url, row.story.id);
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
        } else if (status === 403) {
          showNotification(t('publish_showcase_disabled'), 'error');
        } else if (isOfflineError(publishError)) {
          showNotification(t('publish_blocked_offline'), 'error');
        } else {
          console.log('PublishStoryScreen: publish failed.', publishError);
          showNotification(t('publish_failed'), 'error');
        }
      } finally {
        setBusyStoryId(null);
      }
    },
    [drizzleDb, labelMode, load, password, showNotification, t, usePassword],
  );

  const handlePublish = useCallback(
    (row: StoryRow) => {
      if (usePassword && password.trim().length < 4) {
        showNotification(t('publish_password_too_short'), 'error');
        return;
      }

      // Visibility applies to the whole story: removing the password now also opens the versions that were
      // already published behind it. That is not obvious from a "publish" button, so it is said before it
      // happens, not afterwards.
      const showcase = showcaseByStory[row.story.id];
      const opensProtectedVersions =
        !usePassword && showcase?.visibility === 'password' && showcase.publications.length > 0;

      if (!opensProtectedVersions) {
        void runPublish(row);
        return;
      }

      AppAlert.alert(
        t('publish_opening_protected_title'),
        t('publish_opening_protected_message', { count: showcase.publications.length }),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('publish_opening_protected_confirm'), onPress: () => void runPublish(row) },
        ],
      );
    },
    [password, runPublish, showcaseByStory, showNotification, t, usePassword],
  );

  const handleDeleteVersion = useCallback(
    (row: StoryRow, publication: StoryPublication) => {
      AppAlert.alert(
        t('publish_delete_version_title'),
        t('publish_delete_version_message', { label: publication.label }),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: async () => {
              setBusyStoryId(row.story.id);
              try {
                await publicationApiService.deletePublication(
                  row.server,
                  row.story.id,
                  publication.id,
                );
                await createPublicationService(drizzleDb).syncPublicationsWithServer(row.server);
                showNotification(t('publish_version_deleted'), 'success');
                await load();
              } catch (deleteError) {
                console.log('PublishStoryScreen: delete failed.', deleteError);
                showNotification(t('publish_failed'), 'error');
              } finally {
                setBusyStoryId(null);
              }
            },
          },
        ],
      );
    },
    [drizzleDb, load, showNotification, t],
  );

  const handleUnpublish = useCallback(
    (row: StoryRow) => {
      AppAlert.alert(t('publish_unpublish_title'), t('publish_unpublish_message'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('publish_unpublish_confirm'),
          style: 'destructive',
          onPress: async () => {
            setBusyStoryId(row.story.id);
            try {
              await publicationApiService.unpublish(row.server, row.story.id);
              await createPublicationService(drizzleDb).syncPublicationsWithServer(row.server);
              showNotification(t('publish_unpublished'), 'success');
              await load();
            } catch (unpublishError) {
              console.log('PublishStoryScreen: unpublish failed.', unpublishError);
              showNotification(t('publish_failed'), 'error');
            } finally {
              setBusyStoryId(null);
            }
          },
        },
      ]);
    },
    [drizzleDb, load, showNotification, t],
  );

  const styles = StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    content: { padding: 20, paddingBottom: 60 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 6 },
    sectionDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 18,
      lineHeight: 20,
    },
    storyCard: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      marginBottom: 12,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    storyHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
    storyInfo: { flex: 1, marginRight: 12 },
    storyTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text },
    storyMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    blockedText: { fontSize: 12, color: colors.error, marginTop: 4 },
    body: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      padding: 14,
    },
    label: { fontSize: 13, fontWeight: 'bold', color: colors.text, marginBottom: 8 },
    modeRow: { flexDirection: 'row', marginBottom: 16 },
    modeOption: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      marginRight: 8,
    },
    modeOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    modeText: { fontSize: 13, color: colors.text },
    modeTextActive: { color: colors.onPrimary, fontWeight: 'bold' },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      paddingVertical: 10,
      paddingHorizontal: 12,
      color: colors.text,
      backgroundColor: colors.background,
      marginBottom: 16,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 13,
    },
    primaryButtonDisabled: { opacity: 0.5 },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: 'bold',
      marginLeft: 8,
    },
    versionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 9,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    versionInfo: { flex: 1 },
    versionLabel: { fontSize: 14, color: colors.text },
    versionMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    unpublishButton: { marginTop: 14, alignItems: 'center' },
    unpublishText: { color: colors.error, fontSize: 14 },
    emptyText: { fontSize: 14, color: colors.textSecondary, fontStyle: 'italic' },
    hint: { fontSize: 12, color: colors.textSecondary, marginTop: -8, marginBottom: 16 },
    linkBox: {
      marginTop: 16,
      padding: 12,
      borderRadius: 6,
      backgroundColor: colors.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    linkText: { fontSize: 13, color: colors.text, marginBottom: 8 },
    linkButton: { flexDirection: 'row', alignItems: 'center' },
    linkButtonText: { color: colors.primary, fontSize: 13, marginLeft: 6 },
  });

  if (loading) {
    return <ScreenLoading />;
  }
  if (error) {
    return <ScreenError message={error} padded />;
  }

  const modes: LabelMode[] = ['both', 'version', 'date'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>{t('publish_story_title')}</Text>
      <Text style={styles.sectionDescription}>{t('publish_story_description')}</Text>

      {rows.length === 0 ? (
        <Text style={styles.emptyText}>{t('publish_no_eligible_stories')}</Text>
      ) : (
        rows.map((row) => {
          const showcase = showcaseByStory[row.story.id];
          const reason = blockedReason(row);
          const expanded = expandedStoryId === row.story.id;
          const busy = busyStoryId === row.story.id;

          return (
            <View key={row.story.id} style={styles.storyCard}>
              <TouchableOpacity
                style={styles.storyHeader}
                onPress={() => {
                  // On opening, the padlock starts by reflecting how the story is published today: a control saying "no
                  // password" on a protected story would make the person believe they had already made it public without
                  // having done anything.
                  if (!expanded) {
                    setUsePassword(showcase?.visibility === 'password');
                    setPassword('');
                    setLabelMode(showcase?.labelMode ?? 'both');
                  }
                  setExpandedStoryId(expanded ? null : row.story.id);
                }}
              >
                <View style={styles.storyInfo}>
                  <Text style={styles.storyTitle}>{row.story.title}</Text>
                  <Text style={styles.storyMeta}>
                    {row.server.name} · {t('publish_local_version')}{' '}
                    {row.story.lastOperationLog ?? 0}
                    {showcase?.isPublished
                      ? ` · ${t('publish_versions_count', {
                          count: showcase.publications.length,
                        })}`
                      : ` · ${t('publish_not_published')}`}
                    {showcase?.visibility === 'password'
                      ? ` · ${t('publish_password_protected')}`
                      : ''}
                  </Text>
                  {reason && <Text style={styles.blockedText}>{reason}</Text>}
                </View>
                <Ionicons
                  name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {expanded && (
                <View style={styles.body}>
                  <Text style={styles.label}>{t('publish_label_style')}</Text>
                  <View style={styles.modeRow}>
                    {modes.map((mode) => (
                      <TouchableOpacity
                        key={mode}
                        style={[styles.modeOption, labelMode === mode && styles.modeOptionActive]}
                        onPress={() => setLabelMode(mode)}
                      >
                        <Text
                          style={[styles.modeText, labelMode === mode && styles.modeTextActive]}
                        >
                          {t(`publish_label_style_${mode}`)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.switchRow}>
                    <Text style={styles.label}>{t('publish_use_password')}</Text>
                    <ThemedSwitch
                      value={usePassword}
                      onValueChange={setUsePassword}
                      testID={`publish-password-switch-${row.story.id}`}
                    />
                  </View>
                  {/*
                    A proteção é da história, não de cada versão: o site mostra uma página por
                    história, com todas as versões dentro dela. Quem tem mais de uma versão
                    publicada precisa saber que esta escolha vale para todas - inclusive as que
                    já estavam no ar.
                  */}
                  {(showcase?.publications.length ?? 0) > 1 && (
                    <Text style={styles.hint}>
                      {t('publish_visibility_applies_to_all', {
                        count: showcase?.publications.length ?? 0,
                      })}
                    </Text>
                  )}
                  {usePassword && (
                    <>
                      <TextInput
                        style={styles.input}
                        value={password}
                        onChangeText={setPassword}
                        placeholder={t('publish_password_placeholder')}
                        placeholderTextColor={colors.textSecondary}
                        secureTextEntry
                      />
                      {showcase?.hasPassword && (
                        // Publishing again saves the password typed now, so leaving the field blank is not "keep the existing
                        // one" - it is publishing with no password.
                        <Text style={styles.hint}>{t('publish_password_replaces_previous')}</Text>
                      )}
                    </>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      (!!reason || busy) && styles.primaryButtonDisabled,
                    ]}
                    onPress={() => handlePublish(row)}
                    disabled={!!reason || busy}
                  >
                    <Ionicons name="cloud-upload-outline" size={18} color={colors.onPrimary} />
                    <Text style={styles.primaryButtonText}>
                      {busy ? t('publish_in_progress') : t('publish_create_version')}
                    </Text>
                  </TouchableOpacity>

                  {showcase?.isPublished && (
                    // The address stays in sight whenever the story is published, not only at the instant it is published:
                    // it is what the person needs to copy to send to somebody, and they are not going to republish just to
                    // see it again.
                    <View style={styles.linkBox}>
                      <Text style={styles.label}>{t('publish_public_link')}</Text>
                      <Text style={styles.linkText} selectable>
                        {buildStoryPublicUrl(row.server.url, row.story.id)}
                      </Text>
                      <TouchableOpacity
                        style={styles.linkButton}
                        onPress={() =>
                          void Linking.openURL(buildStoryPublicUrl(row.server.url, row.story.id))
                        }
                      >
                        <Ionicons name="open-outline" size={16} color={colors.primary} />
                        <Text style={styles.linkButtonText}>{t('publish_open_link')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {showcase?.publications.map((publication) => (
                    <View key={publication.id} style={styles.versionRow}>
                      <View style={styles.versionInfo}>
                        <Text style={styles.versionLabel}>{publication.label}</Text>
                        <Text style={styles.versionMeta}>
                          {new Date(publication.createdAt).toLocaleDateString()} ·{' '}
                          {Math.max(1, Math.round(publication.byteSize / 1024))} KB
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteVersion(row, publication)}
                        disabled={busy}
                      >
                        <Ionicons name="trash-outline" size={20} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {showcase?.isPublished && (
                    <TouchableOpacity
                      style={styles.unpublishButton}
                      onPress={() => handleUnpublish(row)}
                      disabled={busy}
                    >
                      <Text style={styles.unpublishText}>{t('publish_unpublish_confirm')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
};

export default PublishStoryScreen;
