import type { ShowcaseStoryDetail } from '@keres/shared';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import ShowcaseGuestBanner from '@/src/components/features/showcase/ShowcaseGuestBanner';
import ShowcasePasswordGate from '@/src/components/features/showcase/ShowcasePasswordGate';
import ShowcaseVersionRow from '@/src/components/features/showcase/ShowcaseVersionRow';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import type {
  ShowcaseStackParamList,
  ShowcaseSourceParams,
} from '@/src/navigation/stacks/StorySelectionStack';
import { showcaseSourceUrl, type ShowcaseSource } from '@/src/services/api/ShowcaseApiService';
import { type ThemeColors } from '@/src/theme';
import { commonScreenStyleDefs } from '@/src/theme/commonStyles';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { buildStoryPublicUrl } from '@/src/utils/format/showcaseUrls';
import { groupShowcaseVersions } from '@/src/utils/format/showcaseVersions';
import { useShowcaseSource } from './useShowcaseSource';
import { useShowcaseStory } from './useShowcaseStory';
import { useShowcaseVersionActions } from './useShowcaseVersionActions';

type Route = RouteProp<ShowcaseStackParamList, 'ShowcaseStory'>;
type Navigation = NativeStackNavigationProp<ShowcaseStackParamList, 'ShowcaseStory'>;

interface OpenStoryProps {
  source: ShowcaseSource;
  story: ShowcaseStoryDetail;
  unlockToken: string | null;
}

/** A story that is open to read: what it is, and each of its versions with what can be done with them. */
const OpenStory = ({ source, story, unlockToken }: OpenStoryProps) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const actions = useShowcaseVersionActions({ source, story, unlockToken });
  const groups = useMemo(() => groupShowcaseVersions(story.versions), [story.versions]);
  const newestId = story.versions[0]?.id;
  const { snapshot, owner } = story;
  const facts = [
    snapshot.genre,
    snapshot.language,
    t(snapshot.type === 'branching' ? 'showcase_type_branching' : 'showcase_type_linear'),
  ].filter(Boolean);

  return (
    <>
      <Text style={styles.title} accessibilityRole="header">
        {snapshot.title}
      </Text>
      <Text style={styles.byline}>
        {t('showcase_published_by', { name: owner.username, tag: owner.tag })}
        {snapshot.author && snapshot.author !== owner.username
          ? ` · ${t('showcase_author_credit', { name: snapshot.author })}`
          : ''}
      </Text>
      <Text style={styles.facts}>{facts.join(' · ')}</Text>
      {snapshot.description ? <Text style={styles.description}>{snapshot.description}</Text> : null}

      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t('showcase_versions_title')}
      </Text>
      {groups.map((group) => (
        <View key={group.key} testID={`showcase-group-${group.key || 'universe'}`}>
          {group.arc ? <Text style={styles.groupTitle}>{group.arc.title}</Text> : null}
          {group.versions.map((version) => (
            <ShowcaseVersionRow
              key={version.id}
              version={version}
              newest={version.id === newestId}
              busy={actions.busy?.versionId === version.id ? actions.busy : null}
              disabled={actions.busy !== null}
              onRead={() => void actions.readOnline(version)}
              onDownload={() => void actions.downloadPackage(version)}
              onImport={() => actions.importCopy(version)}
            />
          ))}
        </View>
      ))}
    </>
  );
};

/**
 * A story of a server's public site, inside the app: the same page the website draws, with the same
 * password gate, and with the ways out - read it online, take its package as a file, or import a copy.
 */
const ShowcaseStoryScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { storyId, serverId, guestOrigin } = route.params;
  const params: ShowcaseSourceParams = { serverId, guestOrigin };
  const { source, loading, missing } = useShowcaseSource(params);
  const handle = useShowcaseStory(source, storyId);
  const styles = useThemedStyles(createStyles);
  const { state } = handle;

  const openInBrowser = source
    ? () => void Linking.openURL(buildStoryPublicUrl(showcaseSourceUrl(source), storyId))
    : undefined;
  useScreenHeader({
    target: 'parent',
    title: t('showcase_story_title'),
    actions: [
      {
        id: 'open-in-browser',
        icon: 'open-outline',
        label: t('showcase_open_in_browser'),
        onPress: () => openInBrowser?.(),
        visible: !!openInBrowser,
      },
    ],
  });

  if (missing) {
    return <ScreenError message={t('server_not_found')} onGoBack={() => navigation.goBack()} />;
  }
  if (loading || state.status === 'loading') {
    return <ScreenLoading message={t('loading')} />;
  }
  if (state.status === 'not_found' || state.status === 'unreachable' || state.status === 'failed') {
    return (
      <ScreenError
        message={t(`showcase_story_${state.status}`)}
        onGoBack={() => navigation.goBack()}
      />
    );
  }

  const unlockError = handle.unlockFailure ? t(`showcase_unlock_${handle.unlockFailure}`) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {source?.kind === 'guest' ? (
        <ShowcaseGuestBanner
          origin={source.origin}
          onRegister={() =>
            navigation.getParent()?.navigate('ServerManagementDrawer', {
              screen: 'ServerRegistration',
              params: { address: source.origin },
            })
          }
        />
      ) : null}
      {state.status === 'locked' ? (
        <ShowcasePasswordGate
          onSubmit={(password) => void handle.unlock(password)}
          busy={handle.unlocking}
          error={unlockError}
        />
      ) : (
        <OpenStory source={source!} story={state.story} unlockToken={handle.unlockToken} />
      )}
      {openInBrowser ? (
        <View style={styles.footer}>
          <Button
            variant="secondary"
            icon="open-outline"
            onPress={openInBrowser}
            testID="showcase-story-browser"
          >
            {t('showcase_open_in_browser')}
          </Button>
        </View>
      ) : null}
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    content: { padding: 20, paddingBottom: 60 },
    title: { fontSize: 26, fontWeight: 'bold', color: colors.text },
    byline: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
    facts: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
    description: { fontSize: 15, lineHeight: 22, color: colors.text, marginTop: 14 },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 24,
      marginBottom: 10,
    },
    groupTitle: { fontSize: 15, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
    footer: { marginTop: 18, alignItems: 'flex-start' },
  });

export default ShowcaseStoryScreen;
