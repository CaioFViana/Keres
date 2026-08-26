import { Ionicons } from '@expo/vector-icons';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import CharacterListItem from '@/src/components/features/list-items/CharacterListItem';
import CharacterRelationRows from '@/src/components/features/relations/CharacterRelationRows';
import type { CharacterRelation } from '@keres/shared/entities/CharacterRelation';
import { useDrizzle } from '../../db';
import type { TagSelect } from '../../db/schema';
import type { CharacterSelect } from '../../db/schemas/characters';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { useOpenPresenceMatrixViewer } from '../../hooks/useOpenPresenceMatrixViewer';
import { useStoryRole } from '../../hooks/useStoryRole';
import type { CharacterWithTags } from '../../services/storymanagement/CharacterService';
import { createCharacterService } from '../../services/storymanagement/CharacterService';
import { createTagService } from '../../services/storymanagement/TagService';
import { createCharacterRelationService } from '../../services/storymanagement/CharacterRelationService';
import { useCharacterStore } from '../../state/characterStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import type { CharactersScreenNavigationProp } from '../../navigation/navigationProps';
import { setDocumentTitle } from '../../utils/documentTitle';
import { entityEventEmitter } from '../../utils/EventEmitter';

const CharactersScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const drizzleDb = useDrizzle();
  const navigation = useNavigation<CharactersScreenNavigationProp>();
  const selectedStory = useStoryStore((state) => state.selectedStory);
  const { openCharacterList } = useOpenPresenceMatrixViewer();

  const {
    items: characters,
    loading,
    isInitialLoading,
    error,
    storyId,
    searchQuery,
    activeFilterTags,
    favoriteFilterState,
    activeSort,
    sortDirection,
    advancedSearchCriteria: storeAdvancedSearchCriteria,
    handleSearch,
    handleSearchSubmit,
    handleSortChange,
    handleSortDirectionChange,
    handleFilterTagsChange,
    handleFavoriteFilterChange,
    setAdvancedSearchCriteria: setStoreAdvancedSearchCriteria,
    toggleFavorite,
  } = useEntityListScreen({
    useStore: useCharacterStore,
    collectionKey: 'characters',
    changeEvent: 'character_changed',
  });

  const [allTags, setAllTags] = useState<TagSelect[]>([]);
  const [relations, setRelations] = useState<CharacterRelation[]>([]);
  const [allCharacters, setAllCharacters] = useState<CharacterSelect[]>([]);
  const tagService = useRef(createTagService(drizzleDb)).current;
  const { canEdit } = useStoryRole(storyId);

  // Styles are always defined at the top
  const styles = StyleSheet.create({
    ...commonScreenStyleDefs(colors),
  });

  // Tags power the filter dropdown, so they're fetched here rather than by the list hook.
  const fetchTags = useCallback(async () => {
    if (!storyId) {
      setAllTags([]);
      return;
    }
    try {
      const fetchedTags = await tagService.getTagsByStoryId(storyId);
      setAllTags(fetchedTags);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  }, [storyId, tagService]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const fetchRelations = useCallback(async () => {
    if (!storyId) {
      setRelations([]);
      setAllCharacters([]);
      return;
    }
    const [loadedRelations, loadedCharacters] = await Promise.all([
      createCharacterRelationService(drizzleDb).getCharacterRelationsByStoryId(storyId),
      createCharacterService(drizzleDb).getAllByStoryId(storyId),
    ]);
    setRelations(loadedRelations);
    setAllCharacters(loadedCharacters);
  }, [drizzleDb, storyId]);

  useEffect(() => {
    fetchRelations();
  }, [fetchRelations]);

  useEffect(() => {
    const handleTagChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) fetchTags();
    };
    entityEventEmitter.on('tag_changed', handleTagChange);
    return () => entityEventEmitter.off('tag_changed', handleTagChange);
  }, [fetchTags, storyId]);

  useEffect(() => {
    const refresh = (changedStoryId: string) => {
      if (changedStoryId === storyId) fetchRelations();
    };
    entityEventEmitter.on('character_relation_changed', refresh);
    return () => entityEventEmitter.off('character_relation_changed', refresh);
  }, [fetchRelations, storyId]);

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(t('characters_title'));
      navigation.getParent()?.setOptions({
        title: t('characters_title'),
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 15, gap: 15 }}>
            {selectedStory?.type === 'linear' && (
              <TouchableOpacity
                onPress={openCharacterList}
                accessibilityLabel={t('presence_matrix_title')}
              >
                <Ionicons name="map-outline" size={26} color={colors.text} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => navigation.navigate('CharacterRelationView')}>
              <Ionicons name="git-network-outline" size={26} color={colors.text} />
            </TouchableOpacity>
            {canEdit && (
              <TouchableOpacity
                onPress={() => navigation.navigate('CharacterForm', { characterId: undefined })}
              >
                <Ionicons name="add" size={30} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        ),
      });
    }, [navigation, colors.text, t, canEdit, openCharacterList, selectedStory?.type]),
  );

  const handleToggleFavorite = useCallback(
    async (characterId: string, isFavorite: boolean) => {
      await toggleFavorite(characterId, isFavorite);
    },
    [toggleFavorite],
  );

  const handleViewDetails = useCallback(
    (characterId: string) => {
      navigation.navigate('CharacterDetail', { characterId });
    },
    [navigation],
  );

  const memoizedRenderItem = useCallback(
    ({ item }: { item: CharacterWithTags }) => (
      <CharacterListItem
        character={item}
        onToggleFavorite={handleToggleFavorite}
        onViewDetails={handleViewDetails}
        renderRelations={({ expanded, onExpandedChange }) => (
          <CharacterRelationRows
            characterId={item.id}
            relations={relations}
            characters={allCharacters}
            expanded={expanded}
            onExpandedChange={onExpandedChange}
          />
        )}
      />
    ),
    [allCharacters, handleToggleFavorite, handleViewDetails, relations],
  );

  const memoizedTagFilterOptions = useMemo(() => {
    return allTags.map((tag: TagSelect) => ({ label: tag.name, value: tag.id, color: tag.color }));
  }, [allTags]);

  const memoizedSortOptions = useMemo(() => {
    return [
      { label: t('sort_by_name'), value: 'name' },
      { label: t('sort_by_created_at'), value: 'createdAt' },
      { label: t('sort_by_updated_at'), value: 'updatedAt' },
    ];
  }, [t]);

  if (isInitialLoading) {
    return <ScreenLoading message={t('loading_characters')} />;
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.container}>
      <GenericFilterSortList
        data={characters}
        renderItem={memoizedRenderItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        onSearchSubmit={handleSearchSubmit}
        searchPlaceholder={t('search_characters')}
        currentSearchTerm={searchQuery} // Display local state for responsive input
        filterOptions={memoizedTagFilterOptions}
        onFilterChange={handleFilterTagsChange}
        selectedFilterValues={activeFilterTags}
        sortOptions={memoizedSortOptions}
        onSortChange={handleSortChange}
        onSortDirectionChange={handleSortDirectionChange}
        currentSortDirection={sortDirection}
        currentSortValue={activeSort}
        onFavoriteFilterChange={handleFavoriteFilterChange}
        currentFavoriteFilterState={favoriteFilterState}
        entityName="Character"
        storyId={storyId || ''}
        onAdvancedSearch={setStoreAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={storeAdvancedSearchCriteria}
        isLoading={loading}
      />
    </View>
  );
};

export default CharactersScreen;
