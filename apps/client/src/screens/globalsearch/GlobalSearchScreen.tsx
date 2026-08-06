import { GlobalSearchEntityType } from '@keres/shared/metadata/globalSearchFields';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from 'react-native';
import TextInput from '../../components/common/TextInput/TextInput';
import GlobalSearchResultItem from '../../components/listitem/GlobalSearchResultItem';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { createGlobalSearchService, GlobalSearchResult } from '../../services/storymanagement/GlobalSearchService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { debounce } from '../../utils/debounce';
import { navigateToEntityDetail } from '../../utils/entityNavigation';

type GlobalSearchScreenNavigationProp = DrawerNavigationProp<MainSystemDrawerParamList, 'GlobalSearch'>;

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
];

const SEARCH_DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;

interface ResultSection {
  entityType: GlobalSearchEntityType;
  title: string;
  data: GlobalSearchResult[];
}

const GlobalSearchScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<GlobalSearchScreenNavigationProp>();
  const drizzleDb = useDrizzle();
  const { selectedStory } = useStoryStore();
  const storyId = selectedStory?.id;

  const globalSearchService = useRef(createGlobalSearchService(drizzleDb)).current;

  const [query, setQuery] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedSetCommittedQuery = useMemo(
    () => debounce((value: string) => setCommittedQuery(value), SEARCH_DEBOUNCE_MS),
    []
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
    if (!storyId || trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    globalSearchService.searchAllEntities(storyId, trimmed)
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
  }, [committedQuery, storyId, globalSearchService]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title: t('global_search_title') });
    }, [navigation, t])
  );

  const sections = useMemo<ResultSection[]>(() => {
    const byEntityType = new Map<GlobalSearchEntityType, GlobalSearchResult[]>();
    for (const result of results) {
      if (!byEntityType.has(result.entityType)) byEntityType.set(result.entityType, []);
      byEntityType.get(result.entityType)!.push(result);
    }
    return SECTION_ORDER
      .filter(({ entityType }) => (byEntityType.get(entityType)?.length ?? 0) > 0)
      .map(({ entityType, titleKey }) => ({
        entityType,
        title: `${t(titleKey)} (${byEntityType.get(entityType)!.length})`,
        data: byEntityType.get(entityType)!,
      }));
  }, [results, t]);

  const handleResultPress = useCallback((result: GlobalSearchResult) => {
    navigateToEntityDetail(navigation, result.entityType, result.id);
  }, [navigation]);

  const trimmedQuery = query.trim();
  const showPrompt = trimmedQuery.length < MIN_QUERY_LENGTH;
  const showNoResults = !showPrompt && !loading && sections.length === 0;

  return (
    <View style={styles(colors).container}>
      <View style={styles(colors).searchContainer}>
        <TextInput
          placeholder={t('global_search_placeholder')}
          value={query}
          onChangeText={setQuery}
          autoFocus
          style={{ width: '100%' }}
        />
      </View>

      {loading && <ActivityIndicator size="small" color={colors.primary} style={styles(colors).loadingIndicator} />}

      {showPrompt && (
        <View style={styles(colors).messageContainer}>
          <Text style={styles(colors).messageText}>{t('global_search_prompt')}</Text>
        </View>
      )}

      {showNoResults && (
        <View style={styles(colors).messageContainer}>
          <Text style={styles(colors).messageText}>{t('global_search_no_results', { term: trimmedQuery })}</Text>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.entityType}:${item.id}`}
        renderItem={({ item }) => <GlobalSearchResultItem result={item} onPress={handleResultPress} />}
        renderSectionHeader={({ section }) => (
          <Text style={styles(colors).sectionHeader}>{section.title}</Text>
        )}
        style={styles(colors).list}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
};

const styles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: colors.background,
  },
  searchContainer: {
    paddingTop: 5,
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
