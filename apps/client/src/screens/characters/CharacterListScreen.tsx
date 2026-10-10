import ScreenContainer from '@/src/components/layout/ScreenContainer/ScreenContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { CharacterSelect } from '../../db/schemas/characters';
import { useScreenTour } from '../../guides/useScreenTour';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import OutsideArcNotice from '../../components/features/arcs/OutsideArcNotice';
import { useEntityArcScope } from '../../hooks/useEntityArcScope';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { useOpenPresenceMatrixViewer } from '../../hooks/useOpenPresenceMatrixViewer';
import { useStoryRole } from '../../hooks/useStoryRole';
import { useStoryTagFilterOptions } from '../../hooks/useStoryTagFilterOptions';
import type { CharacterWithTags } from '../../services/storymanagement/CharacterService';
import { createCharacterService } from '../../services/storymanagement/CharacterService';
import { createCharacterRelationService } from '../../services/storymanagement/CharacterRelationService';
import { useCharacterStore } from '../../state/characterStore';
import { useStoryStore } from '../../state/storyStore';
import type { CharactersScreenNavigationProp } from '../../navigation/navigationProps';
import { readShowcaseRequest } from '../../showcase/showcaseRequest';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { useStoryVocabulary } from '../../vocabulary/useStoryVocabulary';
import GuideAnchor from '@/src/guides/GuideAnchor';

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

  const [relations, setRelations] = useState<CharacterRelation[]>([]);
  const [allCharacters, setAllCharacters] = useState<CharacterSelect[]>([]);
  const { canEdit } = useStoryRole(storyId);
  const memoizedTagFilterOptions = useStoryTagFilterOptions(storyId);

  // Styles are always defined at the top

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `fetchRelations` clears synchronously only when no story is selected; everything else waits for `await`. The rule cannot verify across the callback boundary.
    fetchRelations();
  }, [fetchRelations]);

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
