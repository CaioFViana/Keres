import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import PasswordInput from '@/src/components/common/inputs/PasswordInput/PasswordInput';
import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import { useNavigateAcrossStacks } from '@/src/hooks/useNavigateAcrossStacks';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import type { PublicationLabelMode } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import { PublishManuscriptSection } from './PublishManuscriptSection';
import { buildStoryPublicUrl, useStoryPublishing } from './useStoryPublishing';

const LABEL_MODES: PublicationLabelMode[] = ['both', 'version', 'date'];

/**
 * Publishing the open story to its server's public page: where it stands, a new version, and the versions
 * already out. The decisions the screen cannot make for the person - a story that never left the device,
 * or that is somebody else's - are said in its place, not hidden.
 */
const StoryPublishScreen = () => {
  const { t } = useTranslation();
  useScreenHeader({ target: 'parent', title: t('publish_story_title') });
  const { colors } = useTheme();
  // Opened from the dashboard's card as well as from the hub: the header's back takes the way back registered
  // for it (the dashboard) or, from the hub, goes back one screen.
  useBackButtonHandler({ showWebBackButton: true });
  const navigateAcross = useNavigateAcrossStacks();
  const storyId = useStoryStore((state) => state.selectedStory?.id);
  const publishing = useStoryPublishing(storyId);
  const { load } = publishing;

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const styles = StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    content: { padding: 20, paddingBottom: 60 },
    description: { fontSize: 14, color: colors.textSecondary, marginBottom: 16, lineHeight: 20 },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      marginBottom: 20,
      padding: 14,
    },
    statusRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
    statusBody: { flex: 1 },
    statusTitle: { color: colors.text, fontSize: 16, fontWeight: 'bold' },
    statusMeta: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
    blocked: { color: colors.error, fontSize: 13, lineHeight: 18, marginTop: 10 },
    label: { fontSize: 13, fontWeight: 'bold', color: colors.text, marginBottom: 8 },
    modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    modeOption: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
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
    hint: { fontSize: 12, color: colors.textSecondary, marginTop: -4, marginBottom: 16 },
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
    linkText: { fontSize: 13, color: colors.text, marginBottom: 8 },
    linkButton: { flexDirection: 'row', alignItems: 'center' },
    linkButtonText: { color: colors.primary, fontSize: 13, marginLeft: 6 },
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
    outlineButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderColor: colors.primary,
      borderRadius: 8,
      borderWidth: 1,
      marginTop: 12,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    outlineButtonText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  });

  if (publishing.loading) return <ScreenLoading />;
  if (publishing.error) return <ScreenError message={publishing.error} padded />;

  if (publishing.blocker || !publishing.story || !publishing.server || !publishing.showcase) {
    const noServer = publishing.blocker !== 'not-owner';
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Ionicons
              name={noServer ? 'cloud-offline-outline' : 'lock-closed-outline'}
              size={28}
              color={colors.textSecondary}
            />
            <View style={styles.statusBody}>
              <Text style={styles.statusTitle}>
                {t(noServer ? 'story_publish_no_server_title' : 'story_publish_not_owner_title')}
              </Text>
              <Text style={styles.statusMeta}>
                {t(noServer ? 'story_publish_no_server_body' : 'story_publish_not_owner_body')}
              </Text>
            </View>
          </View>
          {noServer ? (
            <TouchableOpacity
              style={styles.outlineButton}
              testID="story-publish-open-collaboration"
              onPress={() => navigateAcross('StorySettings', 'StorySettingsCollaboration', {})}
            >
              <Text style={styles.outlineButtonText}>{t('story_publish_send_to_server')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    );
  }

  const { story, server, showcase, reason, manuscript, busy } = publishing;
  const url = buildStoryPublicUrl(server.url, story.id);
  const cannotPublish = !!reason || busy || manuscript.nothingSelected;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.description}>{t('publish_story_description')}</Text>

      <View style={styles.card} testID="story-publish-status">
        <View style={styles.statusRow}>
          <Ionicons
            name={showcase.isPublished ? 'cloud-done-outline' : 'cloud-upload-outline'}
            size={28}
            color={showcase.isPublished ? colors.primary : colors.textSecondary}
          />
          <View style={styles.statusBody}>
            <Text style={styles.statusTitle}>
              {showcase.isPublished
                ? t('publish_versions_count', { count: showcase.publications.length })
                : t('publish_not_published')}
            </Text>
            <Text style={styles.statusMeta}>
              {[
                server.name,
                t('publish_synced_version', { version: story.lastServerSyncedLog ?? 0 }),
                showcase.visibility === 'password' ? t('publish_password_protected') : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
        {reason ? <Text style={styles.blocked}>{reason}</Text> : null}
      </View>

      <ScreenSection title={t('story_publish_step_what')} />
      <PublishManuscriptSection story={story} manuscript={manuscript} />

      <ScreenSection title={t('story_publish_step_who')} />
      <Text style={styles.label}>{t('publish_label_style')}</Text>
      <View style={styles.modeRow}>
        {LABEL_MODES.map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.modeOption, publishing.labelMode === mode && styles.modeOptionActive]}
            onPress={() => publishing.setLabelMode(mode)}
          >
            <Text style={[styles.modeText, publishing.labelMode === mode && styles.modeTextActive]}>
              {t(`publish_label_style_${mode}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.label}>{t('publish_use_password')}</Text>
        <ThemedSwitch
          value={publishing.usePassword}
          onValueChange={publishing.setUsePassword}
          testID="publish-password-switch"
        />
      </View>
      {/*
        The protection belongs to the story, not to each version: the site shows one page per story with
        every version inside it. Someone with more than one version out has to know this choice covers all
        of them - the ones already online included.
      */}
      {showcase.publications.length > 1 && (
        <Text style={styles.hint}>
          {t('publish_visibility_applies_to_all', { count: showcase.publications.length })}
        </Text>
      )}
      {publishing.usePassword && (
        <>
          <PasswordInput
            value={publishing.password}
            onChangeText={publishing.setPassword}
            placeholder={t('publish_password_placeholder')}
          />
          {showcase.hasPassword && (
            // Publishing again saves the password typed now, so leaving the field blank is not "keep the existing
            // one" - it is publishing with no password.
            <Text style={styles.hint}>{t('publish_password_replaces_previous')}</Text>
          )}
        </>
      )}

      <TouchableOpacity
        style={[styles.primaryButton, cannotPublish && styles.primaryButtonDisabled]}
        onPress={publishing.publish}
        disabled={cannotPublish}
        testID="story-publish-submit"
      >
        <Ionicons name="cloud-upload-outline" size={18} color={colors.onPrimary} />
        <Text style={styles.primaryButtonText}>
          {busy ? t('publish_in_progress') : t('publish_create_version')}
        </Text>
      </TouchableOpacity>

      {showcase.isPublished && (
        <>
          <View style={{ height: 24 }} />
          <ScreenSection title={t('publish_public_link')} />
          {/*
            The address stays in sight whenever the story is published, not only at the instant it is published:
            it is what the person needs to copy to send to somebody, and they are not going to republish just to
            see it again.
          */}
          <View style={styles.card}>
            <Text style={styles.linkText} selectable>
              {url}
            </Text>
            <TouchableOpacity style={styles.linkButton} onPress={() => void Linking.openURL(url)}>
              <Ionicons name="open-outline" size={16} color={colors.primary} />
              <Text style={styles.linkButtonText}>{t('publish_open_link')}</Text>
            </TouchableOpacity>
          </View>

          <ScreenSection title={t('story_publish_versions')} />
          {showcase.publications.map((publication) => (
            <View key={publication.id} style={styles.versionRow}>
              <View style={styles.versionInfo}>
                <Text style={styles.versionLabel}>{publication.label}</Text>
                <Text style={styles.versionMeta}>
                  {publication.arcId
                    ? `${manuscript.manuscriptArcs.find((work) => work.id === publication.arcId)?.title ?? t('publish_removed_work')} · `
                    : ''}
                  {new Date(publication.createdAt).toLocaleDateString()} ·{' '}
                  {Math.max(1, Math.round(publication.byteSize / 1024))} KB
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => publishing.deleteVersion(publication)}
                disabled={busy}
                accessibilityLabel={t('delete')}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity
            style={styles.unpublishButton}
            onPress={publishing.unpublish}
            disabled={busy}
          >
            <Text style={styles.unpublishText}>{t('publish_unpublish_confirm')}</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
};

export default StoryPublishScreen;
