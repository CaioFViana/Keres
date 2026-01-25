import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '../../components/common/GenericFilterSortList/GenericFilterSortList';
import Select from '../../components/common/Select/Select';
import ChoiceListItem from '../../components/listitem/ChoiceListItem';
import { useDrizzle } from '../../db';
import { ChoiceSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { ChoiceStackParamList, MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { useChapterStore } from '../../state/chapterStore';
import { useChoiceStore } from '../../state/choiceStore';
import { useSceneStore } from '../../state/sceneStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { debounce } from '../../utils/debounce';
import { entityEventEmitter } from '../../utils/EventEmitter';

export type ChoicesScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'ChoicesStack'>,
  NativeStackNavigationProp<ChoiceStackParamList, 'ChoiceDetail'>
>;

const ChoiceListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const drizzleDb = useDrizzle();
  const navigation = useNavigation<ChoicesScreenNavigationProp>();

  const {
    choices,
    searchTerm: storeSearchTerm,
    activeSort,
    sortDirection,
    advancedSearchCriteria,
    loading,
    error,
    fetchChoices,
    setSearchTerm: setStoreSearchTerm,
    setDbAndStoryId,
    initializeService,
    setSort,
    setAdvancedSearchCriteria,
  } = useChoiceStore();

  const { chapters, fetchChapters: fetchAllChapters, setDbAndStoryId: setChapterDb, initializeService: initializeChapterService } = useChapterStore();
  const { scenes, fetchScenes: fetchAllScenes, setDbAndStoryId: setSceneDb, initializeService: initializeSceneService } = useSceneStore();

  const [searchQuery, setSearchQuery] = useState(storeSearchTerm);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

  const debouncedSetStoreSearchTerm = useMemo(
    () => debounce((term: string) => setStoreSearchTerm(term), 1000),
    [setStoreSearchTerm]
  );

  useEffect(() => {
    debouncedSetStoreSearchTerm(searchQuery);
    return () => {
      debouncedSetStoreSearchTerm.cancel && debouncedSetStoreSearchTerm.cancel();
    };
  }, [searchQuery, debouncedSetStoreSearchTerm]);

  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setDbAndStoryId(drizzleDb, selectedStory.id);
      initializeService();
      setChapterDb(drizzleDb, selectedStory.id);
      initializeChapterService();
      setSceneDb(drizzleDb, selectedStory.id);
      initializeSceneService();
      fetchAllChapters();
      fetchAllScenes();
    }
  }, [drizzleDb, selectedStory?.id, setDbAndStoryId, initializeService, setChapterDb, initializeChapterService, setSceneDb, initializeSceneService, fetchAllChapters, fetchAllScenes]);

  useEffect(() => {
    const criteria: { [key: string]: any } = {};
    if (selectedChapterId) criteria.chapterId = selectedChapterId;
    if (selectedSceneId) criteria.sceneId = selectedSceneId;
    setAdvancedSearchCriteria(criteria);
  }, [selectedChapterId, selectedSceneId, setAdvancedSearchCriteria]);

  useEffect(() => {
    fetchChoices();
  }, [storeSearchTerm, activeSort, sortDirection, advancedSearchCriteria, fetchChoices]);

  useEffect(() => {
    const handleEntityChange = (storyId: string) => {
      if (selectedStory?.id === storyId) {
        fetchChoices();
        fetchAllChapters();
        fetchAllScenes();
      }
    };
    entityEventEmitter.on('choice_changed', handleEntityChange);
    entityEventEmitter.on('chapter_changed', handleEntityChange);
    entityEventEmitter.on('scene_changed', handleEntityChange);
    return () => {
      entityEventEmitter.off('choice_changed', handleEntityChange);
      entityEventEmitter.off('chapter_changed', handleEntityChange);
      entityEventEmitter.off('scene_changed', handleEntityChange);
    };
  }, [selectedStory?.id, fetchChoices, fetchAllChapters, fetchAllScenes]);

  const handleViewDetails = useCallback((choiceId: string) => {
    navigation.navigate('ChoiceDetail', { choiceId });
  }, [navigation]);

  const memoizedChoiceListItem = useCallback(({ item }: { item: ChoiceSelect }) => (
    <ChoiceListItem choice={item} onViewDetails={handleViewDetails} />
  ), [handleViewDetails]);

  const chapterOptions = useMemo(() => chapters.map(c => ({ label: c.name, value: c.id })), [chapters]);
  const sceneOptions = useMemo(() => {
    if (!selectedChapterId) return [];
    return scenes.filter(s => s.chapterId === selectedChapterId).map(s => ({ label: s.name, value: s.id }));
  }, [scenes, selectedChapterId]);

  useEffect(() => {
    setSelectedSceneId(null);
  }, [selectedChapterId]);

  const memoizedSortOptions = useMemo(() => ([
    { label: t('sort_by_text'), value: 'text' },
    { label: t('sort_by_created_at'), value: 'createdAt' },
    { label: t('sort_by_updated_at'), value: 'updatedAt' }
  ]), [t]);

  const handleSearch = useCallback((term: string) => setSearchQuery(term), []);
  const handleSortChange = useCallback((sortBy: string | null) => setSort(sortBy, sortDirection), [setSort, sortDirection]);
  const handleSortDirectionChange = useCallback((direction: 'asc' | 'desc') => setSort(activeSort, direction), [setSort, activeSort]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: t('choices_title'),
        headerRight: () => (
          <View style={styles.headerRightContainer}>
            <TouchableOpacity onPress={() => navigation.navigate('ChoiceForm', {})} style={styles.headerButton}>
              <Ionicons name="add" size={30} color={colors.text} />
            </TouchableOpacity>
          </View>
        ),
      });
    }, [navigation, colors.text, t])
  );

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centerContent: { justifyContent: 'center', alignItems: 'center' },
    detailText: { fontSize: 16, color: colors.text, marginBottom: 5 },
    errorText: { color: colors.error },
    headerRightContainer: { flexDirection: 'row', marginRight: 15 },
    headerButton: { marginLeft: 15 },
    buttonContainer: { marginTop: 20 },
    filterContainer: { flexDirection: 'row', padding:0, paddingBottom: 10, zIndex: 1000 },
    selectWrapperLeft: { flex: 1, paddingRight:5},
    selectWrapperRight: { flex: 1, paddingLeft:5}
  });

  const filterComponent = (
    <View style={styles.filterContainer}>
      <View style={styles.selectWrapperLeft}>
        <Select
          options={chapterOptions}
          value={selectedChapterId}
          onValueChange={(value) => setSelectedChapterId(value as string)}
          placeholder={t('select_chapter')}
          multiple={false}
        />
      </View>
      <View style={styles.selectWrapperRight}>
        <Select
          options={sceneOptions}
          value={selectedSceneId}
          onValueChange={(value) => setSelectedSceneId(value as string)}
          placeholder={t('select_scene')}
          multiple={false}
          disabled={!selectedChapterId || sceneOptions.length === 0}
        />
      </View>
    </View>
  );

  if (loading && choices.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.detailText}>{t('loading_choices')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={[styles.detailText, styles.errorText]}>{error}</Text>
        <View style={styles.buttonContainer}>
          <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GenericFilterSortList
        data={choices}
        renderItem={memoizedChoiceListItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        searchPlaceholder={t('search_choices')}
        currentSearchTerm={searchQuery}
        filterComponent={filterComponent}
        filterOptions={[]}
        onFilterChange={() => {}}
        selectedFilterValues={[]}
        sortOptions={memoizedSortOptions}
        onSortChange={handleSortChange}
        onSortDirectionChange={handleSortDirectionChange}
        currentSortDirection={sortDirection}
        currentSortValue={activeSort}
        disableTagFilter={true}
        entityName="Choice"
        storyId={selectedStory?.id || ''}
        onAdvancedSearch={setAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={advancedSearchCriteria}
        isLoading={loading}
        disableFavoriteFilter={true}
      />
    </View>
  );
};

export default ChoiceListScreen;