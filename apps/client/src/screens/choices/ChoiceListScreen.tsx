import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '../../components/common/GenericFilterSortList/GenericFilterSortList';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import Select from '../../components/common/Select/Select';
import ChoiceListItem from '../../components/listitem/ChoiceListItem';
import { useDrizzle } from '../../db';
import { ChoiceSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { ChoiceStackParamList, MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { useChapterStore } from '../../state/chapterStore';
import { useChoiceStore } from '../../state/choiceStore';
import { useSceneStore } from '../../state/sceneStore';
import { useTheme } from '../../theme';
import { entityEventEmitter } from '../../utils/EventEmitter';

export type ChoicesScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'ChoicesStack'>,
  NativeStackNavigationProp<ChoiceStackParamList, 'ChoiceDetail' | 'ChoiceView'>
>;

const ChoiceListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const drizzleDb = useDrizzle();
  const navigation = useNavigation<ChoicesScreenNavigationProp>();

  const {
    items: choices,
    loading,
    error,
    storyId,
    searchQuery,
    activeSort,
    sortDirection,
    advancedSearchCriteria,
    handleSearch,
    handleSortChange,
    handleSortDirectionChange,
    setAdvancedSearchCriteria,
    refetch: fetchChoices,
  } = useEntityListScreen({
    useStore: useChoiceStore,
    collectionKey: 'choices',
    changeEvent: 'choice_changed',
  });

  // Chapters and scenes feed this screen's own filter dropdowns, so they stay wired here.
  const { chapters, fetchChapters: fetchAllChapters, setDbAndStoryId: setChapterDb, initializeService: initializeChapterService } = useChapterStore();
  const { scenes, fetchScenes: fetchAllScenes, setDbAndStoryId: setSceneDb, initializeService: initializeSceneService } = useSceneStore();

  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

  useEffect(() => {
    if (drizzleDb && storyId) {
      setChapterDb(drizzleDb, storyId);
      initializeChapterService();
      setSceneDb(drizzleDb, storyId);
      initializeSceneService();
      fetchAllChapters();
      fetchAllScenes();
    }
  }, [drizzleDb, storyId, setChapterDb, initializeChapterService, setSceneDb, initializeSceneService, fetchAllChapters, fetchAllScenes]);

  useEffect(() => {
    const criteria: { [key: string]: any } = {};
    if (selectedChapterId) criteria.chapterId = selectedChapterId;
    if (selectedSceneId) criteria.sceneId = selectedSceneId;
    setAdvancedSearchCriteria(criteria);
  }, [selectedChapterId, selectedSceneId, setAdvancedSearchCriteria]);

  // Choices are derived from chapters and scenes, so their changes refresh this list too.
  useEffect(() => {
    const handleStructureChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) {
        fetchChoices();
        fetchAllChapters();
        fetchAllScenes();
      }
    };
    entityEventEmitter.on('chapter_changed', handleStructureChange);
    entityEventEmitter.on('scene_changed', handleStructureChange);
    return () => {
      entityEventEmitter.off('chapter_changed', handleStructureChange);
      entityEventEmitter.off('scene_changed', handleStructureChange);
    };
  }, [storyId, fetchChoices, fetchAllChapters, fetchAllScenes]);

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


  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: t('choices_title'),
        headerRight: () => (
          <View style={styles.headerRightContainer}>
            <TouchableOpacity onPress={() => navigation.navigate('ChoiceView')} style={styles.headerButton}>
              <Ionicons name="search" size={30} color={colors.text} />
            </TouchableOpacity>
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
    headerRightContainer: { flexDirection: 'row', marginRight: 15 },
    headerButton: { marginLeft: 15 },
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
          allowDeselect={true}
        />
      </View>
      <View style={styles.selectWrapperRight}>
        <Select
          options={sceneOptions}
          value={selectedSceneId}
          onValueChange={(value) => setSelectedSceneId(value as string)}
          placeholder={t('select_scene')}
          multiple={false}
          allowDeselect={true}
          disabled={!selectedChapterId || sceneOptions.length === 0}
        />
      </View>
    </View>
  );

  if (loading && choices.length === 0) {
    return <ScreenLoading message={t('loading_choices')} />;
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
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
        storyId={storyId || ''}
        onAdvancedSearch={setAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={advancedSearchCriteria}
        isLoading={loading}
        disableFavoriteFilter={true}
      />
    </View>
  );
};

export default ChoiceListScreen;