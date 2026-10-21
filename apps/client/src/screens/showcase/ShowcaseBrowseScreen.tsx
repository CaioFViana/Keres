import type { ShowcaseFacets } from '@keres/shared';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import ShowcaseAuthorRow from '@/src/components/features/showcase/ShowcaseAuthorRow';
import ShowcaseFiltersBar from '@/src/components/features/showcase/ShowcaseFiltersBar';
import ShowcaseGuestBanner from '@/src/components/features/showcase/ShowcaseGuestBanner';
import ShowcaseStoryRow from '@/src/components/features/showcase/ShowcaseStoryRow';
import ShowcaseTabs from '@/src/components/features/showcase/ShowcaseTabs';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import { useDebouncedValue } from '@/src/hooks/ui/useDebouncedValue';
import type {
  ShowcaseStackParamList,
  ShowcaseTab,
} from '@/src/navigation/stacks/StorySelectionStack';
import {
  showcaseApiService,
  showcaseCoverUrl,
  showcaseSourceUrl,
} from '@/src/services/api/ShowcaseApiService';
import { type ThemeColors } from '@/src/theme';
import { commonScreenStyleDefs } from '@/src/theme/commonStyles';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import {
  hasActiveShowcaseFilters,
  NO_SHOWCASE_FILTERS,
  storyQueryOf,
} from '@/src/utils/format/showcaseFilters';
import { logger } from '@/src/utils/logging/logger';
import { usePagedShowcase } from './usePagedShowcase';
import { useShowcaseSource } from './useShowcaseSource';

type Route = RouteProp<ShowcaseStackParamList, 'ShowcaseBrowse'>;
type Navigation = NativeStackNavigationProp<ShowcaseStackParamList, 'ShowcaseBrowse'>;

/**
 * The stories and the authors of one server's public site, as the website lists them: a search, the filters
 * the server offers (with how many stories carry each value) and pages that grow on request. A server the person
 * registered is read as theirs; one they only have a link to, as a guest.
 */
const ShowcaseBrowseScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { serverId, guestOrigin, tab: initialTab } = route.params;
  const { source, loading: sourceLoading, missing } = useShowcaseSource({ serverId, guestOrigin });
  const styles = useThemedStyles(createStyles);

  const [tab, setTab] = useState<ShowcaseTab>(initialTab ?? 'stories');
  const [filters, setFilters] = useState(NO_SHOWCASE_FILTERS);
  const settledQuery = useDebouncedValue(filters.q, 300);
  const settled = useMemo(() => ({ ...filters, q: settledQuery }), [filters, settledQuery]);
  const [facets, setFacets] = useState<ShowcaseFacets | null>(null);
  const sourceKey = source ? showcaseSourceUrl(source) : '';

  const title =
    source?.kind === 'server'
      ? (source.server.name ?? source.server.url)
      : sourceKey.replace(/^https?:\/\//, '') || t('showcase_title');
  useScreenHeader({ target: 'parent', title });

  useEffect(() => {
    if (!source) return undefined;
    let cancelled = false;
    showcaseApiService
      .getFacets(source)
      .then((found) => !cancelled && setFacets(found))
      .catch((error) => {
        logger.debug('ShowcaseBrowseScreen: no facets.', error);
        if (!cancelled) setFacets(null);
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  const stories = usePagedShowcase(
    `stories|${sourceKey}|${JSON.stringify(settled)}`,
    (offset, limit) =>
      showcaseApiService.listStories(source!, storyQueryOf(settled, offset, limit)),
    !!source && tab === 'stories',
  );
  const authors = usePagedShowcase(
    `authors|${sourceKey}|${settledQuery}`,
    (offset, limit) =>
      showcaseApiService.listAuthors(source!, { q: settledQuery.trim(), limit, offset }),
    !!source && tab === 'authors',
  );
  const list = tab === 'stories' ? stories : authors;
  const sourceParams = { serverId, guestOrigin };

  if (missing) {
    return <ScreenError message={t('server_not_found')} onGoBack={() => navigation.goBack()} />;
  }
  if (sourceLoading || !source) {
    return <ScreenLoading message={t('loading')} />;
  }

  const filtered = tab === 'stories' ? hasActiveShowcaseFilters(settled) : !!settledQuery.trim();

  const header = (
    <View style={styles.header}>
      {source.kind === 'guest' ? (
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
      <ShowcaseTabs
        tabs={[
          { key: 'stories', label: t('showcase_tab_stories') },
          { key: 'authors', label: t('showcase_tab_authors') },
        ]}
        value={tab}
        onChange={setTab}
      />
      <TextInput
        style={styles.search}
        value={filters.q}
        onChangeText={(q) => setFilters((current) => ({ ...current, q }))}
        placeholder={t(tab === 'stories' ? 'showcase_search_stories' : 'showcase_search_authors')}
        accessibilityLabel={t('showcase_search')}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        testID="showcase-search"
      />
      {tab === 'stories' ? (
        <ShowcaseFiltersBar filters={filters} onChange={setFilters} facets={facets} />
      ) : null}
      {list.total !== null && !list.loading && !list.failed ? (
        <Text style={styles.count} testID="showcase-count">
          {t(tab === 'stories' ? 'showcase_story_count' : 'showcase_author_count', {
            count: list.total,
          })}
        </Text>
      ) : null}
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      {list.loadingMore ? <ActivityIndicator testID="showcase-loading-more" /> : null}
      {list.hasMore && !list.loadingMore ? (
        <Button variant="secondary" onPress={list.loadMore} testID="showcase-more">
          {t('showcase_show_more')}
        </Button>
      ) : null}
    </View>
  );

  const empty = list.loading ? (
    <ActivityIndicator style={styles.state} testID="showcase-loading" />
  ) : list.failed ? (
    <View style={styles.state}>
      <Text style={styles.stateText}>{t('showcase_list_failed')}</Text>
      <Button
        variant="secondary"
        icon="refresh-outline"
        onPress={list.reload}
        testID="showcase-retry"
      >
        {t('showcase_retry')}
      </Button>
    </View>
  ) : (
    <Text style={[styles.state, styles.stateText]} testID="showcase-empty">
      {t(
        filtered
          ? 'showcase_empty_filtered'
          : tab === 'stories'
            ? 'showcase_empty_stories'
            : 'showcase_empty_authors',
      )}
    </Text>
  );

  if (tab === 'stories') {
    return (
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={stories.items}
        keyExtractor={(story) => story.storyId}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        renderItem={({ item }) => (
          <ShowcaseStoryRow
            story={item}
            coverUrl={item.hasCover ? showcaseCoverUrl(source, item.storyId) : null}
            onPress={() =>
              navigation.navigate('ShowcaseStory', { ...sourceParams, storyId: item.storyId })
            }
          />
        )}
      />
    );
  }
  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={authors.items}
      keyExtractor={(author) => author.owner.username}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={footer}
      renderItem={({ item }) => (
        <ShowcaseAuthorRow
          author={item}
          onPress={() =>
            navigation.navigate('ShowcaseAuthor', {
              ...sourceParams,
              username: item.owner.username,
            })
          }
        />
      )}
    />
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    content: { padding: 20, paddingBottom: 60 },
    header: { marginBottom: 14, gap: 10 },
    search: { marginTop: 4 },
    count: { fontSize: 13, color: colors.textSecondary },
    footer: { alignItems: 'center', marginTop: 6 },
    state: { marginTop: 24, alignItems: 'center', gap: 12 },
    stateText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  });

export default ShowcaseBrowseScreen;
