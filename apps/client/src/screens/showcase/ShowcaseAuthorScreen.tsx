import type { ProfileLink } from '@keres/shared';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '@/src/components/common/display/Avatar/Avatar';
import Button from '@/src/components/common/controls/Button/Button';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import ShowcaseGuestBanner from '@/src/components/features/showcase/ShowcaseGuestBanner';
import ShowcaseStoryRow from '@/src/components/features/showcase/ShowcaseStoryRow';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import type { ShowcaseStackParamList } from '@/src/navigation/stacks/StorySelectionStack';
import { showcaseCoverUrl, showcaseSourceUrl } from '@/src/services/api/ShowcaseApiService';
import { type ThemeColors, useTheme } from '@/src/theme';
import { commonScreenStyleDefs } from '@/src/theme/commonStyles';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { buildAuthorPublicUrl } from '@/src/utils/format/showcaseUrls';
import { useShowcaseAuthor } from './useShowcaseAuthor';
import { useShowcaseSource } from './useShowcaseSource';

type Route = RouteProp<ShowcaseStackParamList, 'ShowcaseAuthor'>;
type Navigation = NativeStackNavigationProp<ShowcaseStackParamList, 'ShowcaseAuthor'>;

/** Where a link goes, for the person to see before they follow it. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const isWebLink = (link: ProfileLink) => /^https?:\/\//i.test(link.url);

/**
 * An author's page of a server's public site, inside the app: their biography and links, written for this
 * page, and the stories they have on show.
 */
const ShowcaseAuthorScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { serverId, guestOrigin, username } = route.params;
  const { source, loading, missing } = useShowcaseSource({ serverId, guestOrigin });
  const state = useShowcaseAuthor(source, username);
  const styles = useThemedStyles(createStyles);

  const openInBrowser = source
    ? () => void Linking.openURL(buildAuthorPublicUrl(showcaseSourceUrl(source), username))
    : undefined;
  useScreenHeader({
    target: 'parent',
    title: t('showcase_author_title'),
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
  if (state.status !== 'ready') {
    return (
      <ScreenError
        message={t(`showcase_author_${state.status}`)}
        onGoBack={() => navigation.goBack()}
      />
    );
  }

  const { page } = state;
  const { owner } = page;

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

      <View style={styles.profile}>
        <Avatar color={owner.avatarColor} icon={owner.avatarIcon} seed={owner.username} size={72} />
        <View style={styles.names}>
          <Text style={styles.name} accessibilityRole="header">
            {owner.username}
          </Text>
          <Text style={styles.tag}>
            {`@${owner.tag} · ${t('showcase_story_count', { count: page.stories.length })}`}
          </Text>
        </View>
      </View>

      {page.biography ? <Text style={styles.biography}>{page.biography}</Text> : null}

      {page.links.filter(isWebLink).length > 0 ? (
        <View style={styles.links} testID="showcase-author-links">
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {t('showcase_author_links')}
          </Text>
          {page.links.filter(isWebLink).map((link) => (
            <TouchableOpacity
              key={`${link.label}|${link.url}`}
              accessibilityRole="link"
              onPress={() => void Linking.openURL(link.url)}
              style={[styles.link, { borderColor: colors.border, backgroundColor: colors.surface }]}
              testID={`showcase-author-link-${link.label}`}
            >
              <View style={styles.linkTexts}>
                <Text style={styles.linkLabel} numberOfLines={1}>
                  {link.label}
                </Text>
                <Text style={styles.linkHost} numberOfLines={1}>
                  {hostOf(link.url)}
                </Text>
              </View>
              <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t('showcase_author_stories')}
      </Text>
      {page.stories.map((story) => (
        <ShowcaseStoryRow
          key={story.storyId}
          story={story}
          showOwner={false}
          coverUrl={story.hasCover && source ? showcaseCoverUrl(source, story.storyId) : null}
          onPress={() =>
            navigation.navigate('ShowcaseStory', { serverId, guestOrigin, storyId: story.storyId })
          }
        />
      ))}

      {openInBrowser ? (
        <View style={styles.footer}>
          <Button
            variant="secondary"
            icon="open-outline"
            onPress={openInBrowser}
            testID="showcase-author-browser"
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
    profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    names: { flex: 1, minWidth: 0 },
    name: { fontSize: 24, fontWeight: 'bold', color: colors.text },
    tag: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
    biography: { fontSize: 15, lineHeight: 22, color: colors.text, marginTop: 16 },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 24,
      marginBottom: 10,
    },
    links: { marginTop: 4 },
    link: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    linkTexts: { flex: 1, minWidth: 0 },
    linkLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
    linkHost: { fontSize: 13, color: colors.textSecondary },
    footer: { marginTop: 18, alignItems: 'flex-start' },
  });

export default ShowcaseAuthorScreen;
