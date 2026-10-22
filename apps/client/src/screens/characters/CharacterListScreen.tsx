import ScreenContainer from '@/src/components/layout/ScreenContainer/ScreenContainer';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import GenericFilterSortList from '@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import CharacterListItem from '@/src/components/features/list-items/CharacterListItem';
import CharacterRelationRows from '@/src/components/features/relations/CharacterRelationRows';
import type { CharacterRelation } from '@keres/shared/entities/narrative/CharacterRelation';
import { useDrizzle } from '@/src/db';
import type { CharacterSelect } from '@/src/db/schemas/characters';
import { useScreenTour } from '@/src/hooks/guides/useScreenTour';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import OutsideArcNotice from '@/src/components/features/arcs/OutsideArcNotice';
import { useEntityArcScope } from '@/src/hooks/arcs/useEntityArcScope';
import { useEntityListScreen } from '@/src/hooks/lists/useEntityListScreen';
import { useOpenPresenceMatrixViewer } from '@/src/hooks/character/useOpenPresenceMatrixViewer';
import { useStoryRole } from '@/src/hooks/story/useStoryRole';
import { useLoadedResource } from '@/src/hooks/lists/useLoadedResource';
import { useStoryTagFilterOptions } from '@/src/hooks/story/useStoryTagFilterOptions';
import type { CharacterWithTags } from '@/src/services/storymanagement/entities/CharacterService';
import { createCharacterService } from '@/src/services/storymanagement/entities/CharacterService';
import { createCharacterRelationService } from '@/src/services/storymanagement/relations/CharacterRelationService';
import { useCharacterStore } from '@/src/state/story/characterStore';
import { useStoryStore } from '@/src/state/story/storyStore';
import type { CharactersScreenNavigationProp } from '@/src/navigation/navigationProps';
import { readShowcaseRequest } from '@/src/services/showcase/showcaseRequest';
import { useStoryVocabulary } from '@/src/hooks/vocabulary/useStoryVocabulary';
import GuideAnchor from '@/src/components/features/guides/GuideAnchor';

const RELATION_EVENTS = ['character_relation_changed'] as const;
const NO_RELATION_DATA: {
  relations: CharacterRelation[];
  allCharacters: CharacterSelect[];
} = { relations: [], allCharacters: [] };

const CharactersScreen = () => {
  useBackButtonHandler();
  useScreenTour('CharactersStack');
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
    findMatching,
    handleToggleFavorite,
  } = useEntityListScreen({
    useStore: useCharacterStore,
    collectionKey: 'characters',
    changeEvent: 'character_changed',
  });

  const {
    data: visibleCharacters,
    outsideCount,
    expanded: showingOtherArcs,
    toggle: toggleOtherArcs,
    previewCount,
  } = useEntityArcScope({
    storyId,
    kind: 'character',
    rows: characters as CharacterWithTags[],
    searchTerm: listProps.currentSearchTerm,
    findMatching,
  });

  const { canEdit } = useStoryRole(storyId);
  const memoizedTagFilterOptions = useStoryTagFilterOptions(storyId);

  const loadRelations = useMemo(
    () =>
      storyId
        ? async () => {
            const [relations, allCharacters] = await Promise.all([
              createCharacterRelationService(drizzleDb).getCharacterRelationsByStoryId(storyId),
              createCharacterService(drizzleDb).getAllByStoryId(storyId),
            ]);
            return { relations, allCharacters };
          }
        : null,
    [drizzleDb, storyId],
  );
  const {
    data: { relations, allCharacters },
  } = useLoadedResource({
    load: loadRelations,
    initial: NO_RELATION_DATA,
    events: RELATION_EVENTS,
    storyId,
    label: 'character relations',
  });

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

  const handleViewDetails = useCallback(
    (characterId: string) => {
      navigation.navigate('CharacterDetail', { characterId });
    },
    [navigation],
  );

  // Showcase capture: open a named character's detail after install remaps ids.
  useEffect(() => {
    const request = readShowcaseRequest();
    if (
      !request ||
      request.stack !== 'CharactersStack' ||
      request.screen !== 'CharacterDetail' ||
      !request.focusName ||
      characters.length === 0
    ) {
      return;
    }
    const match = characters.find(
      (character: CharacterWithTags) =>
        character.name === request.focusName && !character.isDeleted,
    );
    if (!match) return;
    navigation.replace('CharacterDetail', { characterId: match.id });
  }, [characters, navigation]);

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
      <GuideAnchor screen="Characters" part="list" style={{ flex: 1 }}>
        <GenericFilterSortList
          {...listProps}
          onPreviewCount={previewCount}
          data={visibleCharacters}
          resultsNotice={
            <OutsideArcNotice
              count={outsideCount}
              expanded={showingOtherArcs}
              onToggle={toggleOtherArcs}
            />
          }
          renderItem={memoizedRenderItem}
          keyExtractor={(item) => item.id}
          searchPlaceholder={t('search_entities', { entities: term('Character', true) })}
          filterOptions={memoizedTagFilterOptions}
          sortOptions={memoizedSortOptions}
          entityName="Character"
          storyId={storyId || ''}
          onAdvancedSearch={setStoreAdvancedSearchCriteria}
          currentAdvancedSearchCriteria={storeAdvancedSearchCriteria}
          emptyStateTitle={t('characters_empty_title')}
          emptyStateMessage={t('characters_empty_message')}
          emptyStateActions={
            canEdit
              ? [
                  {
                    label: t('characters_empty_create'),
                    onPress: () => navigation.navigate('CharacterForm', { characterId: undefined }),
                    testID: 'empty-create-character',
                  },
                ]
              : []
          }
        />
      </GuideAnchor>
    </ScreenContainer>
  );
};

export default CharactersScreen;
