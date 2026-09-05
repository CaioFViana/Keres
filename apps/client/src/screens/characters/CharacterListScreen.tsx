import ScreenContainer from '@/src/components/layout/ScreenContainer/ScreenContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import type { CharactersScreenNavigationProp } from '../../navigation/navigationProps';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { useStoryVocabulary } from '../../vocabulary/useStoryVocabulary';

const CharactersScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { term } = useStoryVocabulary();

  const drizzleDb = useDrizzle();
  const navigation = useNavigation<CharactersScreenNavigationProp>();
  const selectedStory = useStoryStore((state) => state.selectedStory);
  const { openCharacterList } = useOpenPresenceMatrixViewer();

  const {
    listProps,
    items: characters,
    isInitialLoading,
    error,
    storyId,
    advancedSearchCriteria: storeAdvancedSearchCriteria,
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

  useScreenHeader({
    target: 'parent',
    title: term('Character', true),
    actions: [
      {
        id: 'action-0',
        icon: 'map-outline',
        label: t('presence_matrix_title'),
        onPress: openCharacterList,
        visible: !!(selectedStory?.type === 'linear'),
      },
      {
        id: 'action-1',
        icon: 'git-network-outline',
        label: t('character_relation_map_title'),
        onPress: () => navigation.navigate('CharacterRelationView'),
      },
      {
        id: 'action-2',
        icon: 'add',
        label: t('add'),
        onPress: () => navigation.navigate('CharacterForm', { characterId: undefined }),
        visible: !!canEdit,
      },
    ],
  });

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
    return (
      <ScreenLoading
        message={t('vocabulary_loading_entities', { entities: term('Character', true) })}
      />
    );
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <ScreenContainer>
      <GenericFilterSortList
        {...listProps}
        data={characters}
        renderItem={memoizedRenderItem}
        keyExtractor={(item) => item.id}
        searchPlaceholder={t('search_entities', { entities: term('Character', true) })}
        filterOptions={memoizedTagFilterOptions}
        sortOptions={memoizedSortOptions}
        entityName="Character"
        storyId={storyId || ''}
        onAdvancedSearch={setStoreAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={storeAdvancedSearchCriteria}
      />
    </ScreenContainer>
  );
};

export default CharactersScreen;
