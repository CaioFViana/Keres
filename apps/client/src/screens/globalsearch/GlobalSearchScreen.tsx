import { Ionicons } from '@expo/vector-icons';
import { GlobalSearchEntityType } from '@keres/shared/metadata/globalSearchFields';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import GlobalSearchResultItem from '@/src/components/features/list-items/GlobalSearchResultItem';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import {
  createGlobalSearchService,
  GlobalSearchResult,
} from '../../services/storymanagement/GlobalSearchService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { FavoriteFilterState } from '../../types/entityFilters';
import { debounce } from '../../utils/debounce';
import { setDocumentTitle } from '../../utils/documentTitle';
import { navigateToEntityDetail } from '../../utils/entityNavigation';
import { useUserSettingsStore } from '../../state/userSettingsStore';

type GlobalSearchScreenNavigationProp = DrawerNavigationProp<
  MainSystemDrawerParamList,
  'GlobalSearch'
>;

/** Fixed display order, matching `globalSearchFieldConfig`. Reuses the plural titles every drawer entry already defines. */
const SECTION_ORDER: { entityType: GlobalSearchEntityType; titleKey: string }[] = [
  { entityType: 'Character', titleKey: 'characters_title' },
  { entityType: 'Location', titleKey: 'locations_title' },
  { entityType: 'Chapter', titleKey: 'chapters_title' },
  { entityType: 'Scene', titleKey: 'scenes_title' },
  { entityType: 'Choice', titleKey: 'choices_title' },
  { entityType: 'Item', titleKey: 'items_title' },
  { entityType: 'ItemJourney', titleKey: 'item_journeys_title' },
  { entityType: 'Tag', titleKey: 'tags_title' },
  { entityType: 'Note', titleKey: 'notes_title' },
  { entityType: 'WorldRule', titleKey: 'world_rules_title' },
  { entityType: 'Plot', titleKey: 'plots_title' },
];

const SEARCH_DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;

interface ResultSection {
  entityType: GlobalSearchEntityType;
  title: string;
  data: GlobalSearchResult[];
}

const GlobalSearchScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<GlobalSearchScreenNavigationProp>();
  const drizzleDb = useDrizzle();
  const { selectedStory } = useStoryStore();
  const { userId } = useUserSettingsStore();
  const storyId = selectedStory?.id;

  const globalSearchService = useRef(createGlobalSearchService(drizzleDb)).current;

  const [query, setQuery] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [favoriteFilterState, setFavoriteFilterState] = useState<FavoriteFilterState>('all');

  const debouncedSetCommittedQuery = useMemo(
    () => debounce((value: string) => setCommittedQuery(value), SEARCH_DEBOUNCE_MS),
    [],
  );

  useEffect(() => {
    debouncedSetCommittedQuery(query);
    return () => {
      debouncedSetCommittedQuery.cancel?.();
    };
  }, [query, debouncedSetCommittedQuery]);

  useEffect(() => {
    let cancelled = false;

    const trimmed = committedQuery.trim();
    if (!storyId || !userId || trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    globalSearchService
      .searchAllEntities(storyId, trimmed, userId)
      .then((found) => {
        if (!cancelled) setResults(found);
      })
      .catch((err) => {
        console.error('Global search failed:', err);
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [committedQuery, storyId, userId, globalSearchService]);

  useFocusEffect(
    useCallback(() => {
      // GlobalSearch is a direct Drawer.Screen (no nested Stack in between, unlike the entity
      // list/detail/form screens), so `navigation` here already IS the Drawer's own nav object -
      // `.getParent()` would target the Root Stack above it instead, one level too far up.
      navigation.setOptions({ title: t('global_search_title') });
      setDocumentTitle(t('global_search_title'));
    }, [navigation, t]),
  );

  const sections = useMemo<ResultSection[]>(() => {
    const byEntityType = new Map<GlobalSearchEntityType, GlobalSearchResult[]>();
    const filteredResults =
      favoriteFilterState === 'all'
        ? results
        : results.filter(
            (result) =>
              result.isFavorite !== null &&
              (favoriteFilterState === 'favorite' ? result.isFavorite : !result.isFavorite),
          );
    for (const result of filteredResults) {
      if (!byEntityType.has(result.entityType)) byEntityType.set(result.entityType, []);
      byEntityType.get(result.entityType)!.push(result);
    }
    return SECTION_ORDER.filter(
      ({ entityType }) => (byEntityType.get(entityType)?.length ?? 0) > 0,
    ).map(({ entityType, titleKey }) => ({
      entityType,
      title: `${t(titleKey)} (${byEntityType.get(entityType)!.length})`,
      data: byEntityType.get(entityType)!,
    }));
  }, [favoriteFilterState, results, t]);

  const handleFavoriteFilterToggle = useCallback(() => {
    setFavoriteFilterState((current) =>
      current === 'all' ? 'favorite' : current === 'favorite' ? 'not-favorite' : 'all',
    );
  }, []);

  const favoriteFilterIcon: keyof typeof Ionicons.glyphMap =
    favoriteFilterState === 'favorite'
      ? 'star'
      : favoriteFilterState === 'not-favorite'
        ? 'ban-outline'
        : 'star-outline';
  const favoriteFilterColor =
    favoriteFilterState === 'favorite'
      ? colors.accent
      : favoriteFilterState === 'not-favorite'
        ? colors.notification
        : colors.primary;

  const handleResultPress = useCallback(
    (result: GlobalSearchResult) => {
      navigateToEntityDetail(navigation, result.entityType, result.id);
    },
    [navigation],
  );

  const trimmedQuery = query.trim();
  const showPrompt = trimmedQuery.length < MIN_QUERY_LENGTH;
  const showNoResults = !showPrompt && !loading && sections.length === 0;

  return (
    <View style={styles(colors).container}>
      <View style={styles(colors).searchContainer}>
        <View style={styles(colors).searchRow}>
          <TextInput
            placeholder={t('global_search_placeholder')}
            value={query}
            onChangeText={setQuery}
            autoFocus
            style={styles(colors).searchInput}
          />
          <TouchableOpacity
            onPress={handleFavoriteFilterToggle}
            style={[styles(colors).favoriteFilterButton, { backgroundColor: favoriteFilterColor }]}
          >
            <Ionicons name={favoriteFilterIcon} size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {loading && (
        <ActivityIndicator
          size="small"
          color={colors.primary}
          style={styles(colors).loadingIndicator}
        />
      )}

      {showPrompt && (
        <View style={styles(colors).messageContainer}>
          <Text style={styles(colors).messageText}>{t('global_search_prompt')}</Text>
        </View>
      )}

      {showNoResults && (
        <View style={styles(colors).messageContainer}>
          <Text style={styles(colors).messageText}>
            {t('global_search_no_results', { term: trimmedQuery })}
          </Text>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.entityType}:${item.id}`}
        renderItem={({ item }) => (
          <GlobalSearchResultItem result={item} onPress={handleResultPress} />
        )}
        renderSectionHeader={({ section }) => (
          <Text style={styles(colors).sectionHeader}>{section.title}</Text>
        )}
        style={styles(colors).list}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
};

const styles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 10,
      backgroundColor: colors.background,
    },
    searchContainer: {
      paddingTop: 5,
    },
    searchRow: {
      alignItems: 'center',
      flexDirection: 'row',
    },
    searchInput: {
      flex: 1,
    },
    favoriteFilterButton: {
      alignItems: 'center',
      borderRadius: 5,
      justifyContent: 'center',
      marginBottom: 20,
      marginLeft: 10,
      padding: 12,
    },
    loadingIndicator: {
      marginVertical: 8,
    },
    messageContainer: {
      padding: 20,
      alignItems: 'center',
    },
    messageText: {
      color: colors.textSecondary,
      textAlign: 'center',
      fontSize: 15,
    },
    list: {
      flex: 1,
    },
    sectionHeader: {
      fontSize: 14,
      fontWeight: 'bold',
      color: colors.primary,
      backgroundColor: colors.background,
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
  });

export default GlobalSearchScreen;
