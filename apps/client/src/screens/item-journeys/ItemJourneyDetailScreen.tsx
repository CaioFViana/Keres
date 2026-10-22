import { DetailTabPanels, DetailTabs } from '@/src/components/layout/DetailTabs/DetailTabs';
import { useDetailTab, useDetailTabItems } from '@/src/hooks/nav/useDetailTab';
import Button from '@/src/components/common/controls/Button/Button';
import { createEntityCommentFieldBindings } from '@/src/components/features/comments/CommentableDetailField/createCommentFieldBindings';
import type { OccurrenceTarget } from '@/src/utils/entity/occurrenceTarget';

import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import EntityMetadata from '@/src/mentions/EntityMetadataWithBacklinks';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import NoteManager from '@/src/components/features/notes/NoteManager';
import SeeAlsoManager from '@/src/components/features/see-also/SeeAlsoManager/SeeAlsoManager';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import TagList from '@/src/components/common/display/TagList/TagList';
import { useDrizzle } from '@/src/db';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useDetailRecord } from '@/src/hooks/lists/useDetailRecord';
import { useEntityComments } from '@/src/hooks/comments/useEntityComments';
import { useEntityRelations } from '@/src/hooks/relations/useEntityRelations';
import { useNavigateToEntityDetail } from '@/src/hooks/nav/useNavigateToEntityDetail';
import { useStoryRole } from '@/src/hooks/story/useStoryRole';
import { useCharacterStore } from '@/src/state/story/characterStore';
import { useItemStore } from '@/src/state/story/itemStore';
import { useSceneStore } from '@/src/state/story/sceneStore';
import { useStoryStore } from '@/src/state/story/storyStore';
import { useTheme } from '@/src/theme';
import { layout } from '@/src/theme/layout';
import { useVocabularyEntityCopy } from '@/src/hooks/vocabulary/useVocabularyEntityCopy';
import { useStoryVocabulary } from '@/src/hooks/vocabulary/useStoryVocabulary';
import type { ItemStackParamList } from '@/src/navigation/drawer/MainSystemDrawer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useItemJourneyDetailServices } from './useItemJourneyDetailServices';

export type ItemJourneyDetailScreenParamList = {
  ItemJourneyDetail: { itemJourneyId: string; occurrence?: OccurrenceTarget };
};

type ItemJourneyDetailScreenRouteProp = RouteProp<
  ItemJourneyDetailScreenParamList,
  'ItemJourneyDetail'
>;

const ItemJourneyDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<ItemStackParamList, 'ItemJourneyDetail'>>();
  const route = useRoute<ItemJourneyDetailScreenRouteProp>();
  const { itemJourneyId, occurrence } = route.params;
  const { t } = useTranslation();
  const itemCopy = useVocabularyEntityCopy('Item');
  const sceneCopy = useVocabularyEntityCopy('Scene');
  const { agree, term } = useStoryVocabulary();
  const characterTerm = term('Character');
  const characterOwnerEnding = agree('Character', {
    masculine: 'o',
    feminine: 'a',
    neutral: 'o',
  });
  const characterOwnerPrefix = agree('Character', {
    masculine: 'Novo',
    feminine: 'Nova',
    neutral: 'Novo(a)',
  });
  const { selectedStory } = useStoryStore();

  const drizzleDb = useDrizzle();
  const { itemJourneyService } = useItemJourneyDetailServices();

  const {
    items,
    fetchItems,
    setDbAndStoryId: setItemDbAndStoryId,
    initializeService: initializeItemService,
  } = useItemStore();
  const {
    scenes,
    fetchScenes,
    setDbAndStoryId: setSceneDbAndStoryId,
    initializeService: initializeSceneService,
  } = useSceneStore();
  const {
    characters,
    fetchCharacters,
    setDbAndStoryId: setCharacterDbAndStoryId,
    initializeService: initializeCharacterService,
  } = useCharacterStore();

  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setItemDbAndStoryId(drizzleDb, selectedStory.id);
      initializeItemService();
      fetchItems();

      setSceneDbAndStoryId(drizzleDb, selectedStory.id);
      initializeSceneService();
      fetchScenes();

      setCharacterDbAndStoryId(drizzleDb, selectedStory.id);
      initializeCharacterService();
      fetchCharacters();
    }
  }, [
    drizzleDb,
    selectedStory?.id,
    setItemDbAndStoryId,
    initializeItemService,
    fetchItems,
    setSceneDbAndStoryId,
    initializeSceneService,
    fetchScenes,
    setCharacterDbAndStoryId,
    initializeCharacterService,
    fetchCharacters,
  ]);

  const {
    record: itemJourney,
    loading,
    failure,
  } = useDetailRecord({
    id: itemJourneyId,
    load: itemJourneyService.getById,
    event: 'item_journey_changed',
    label: 'item journey details',
    onGone: navigation.goBack,
  });
  const { canEdit } = useStoryRole(itemJourney?.storyId);
  const comments = useEntityComments(itemJourney?.storyId, 'ItemJourney', itemJourneyId);

  const {
    selectedTags: itemJourneyTags,
    allNotes,
    noteRelations: itemJourneyNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'ItemJourney', entityId: itemJourneyId });
  const notFoundMessage = t('vocabulary_entity_not_found', {
    entity: itemCopy.itemJourney,
    ending: 'a',
  });

  const relatedItem = items.find((item) => item.id === itemJourney?.itemId);
  const relatedScene = scenes.find((scene) => scene.id === itemJourney?.sceneId);
  const newCharacterOwner = characters.find((char) => char.id === itemJourney?.newCharacterOwnerId);

  const navigateToDetail = useNavigateToEntityDetail();

  const handleItemPress = useCallback(() => {
    if (!relatedItem) return;
    navigateToDetail('Item', relatedItem.id);
  }, [navigateToDetail, relatedItem]);

  const handleScenePress = useCallback(() => {
    if (!relatedScene) return;
    navigateToDetail('Scene', relatedScene.id);
  }, [navigateToDetail, relatedScene]);

  const handleNewOwnerPress = useCallback(() => {
    if (!newCharacterOwner) return;
    navigateToDetail('Character', newCharacterOwner.id);
  }, [navigateToDetail, newCharacterOwner]);

  // The title names the item the journey belongs to, so it follows the item list as well.
  const headerTitle = itemJourney
    ? `${relatedItem?.name || itemCopy.unknown} - ${itemJourney.newState}`
    : failure === 'notFound'
      ? notFoundMessage
      : failure === 'failed'
        ? t('error')
        : t('loading');

  useScreenHeader({
    target: 'parent',
    title: headerTitle,
    actions: [
      {
        id: 'action-0',
        icon: 'pencil-outline',
        label: t('edit'),
        onPress: () => navigation.navigate('ItemJourneyForm', { itemJourneyId }),
        visible: !!canEdit,
      },
    ],
  });

  const [tab, setTab] = useDetailTab(occurrence);
  const tabItems = useDetailTabItems(t);

  if (loading) {
    return (
      <ScreenLoading
        padded
        message={t('vocabulary_loading_entity_details', { entity: itemCopy.itemJourney })}
      />
    );
  }
  if (failure) {
    return (
      <ScreenError
        padded
        message={
          failure === 'notFound'
            ? notFoundMessage
            : t('vocabulary_failed_to_load_entity', { entity: itemCopy.itemJourney })
        }
        onGoBack={() => navigation.goBack()}
      />
    );
  }
  if (!itemJourney) {
    return (
      <ScreenError
        padded
        message={t('vocabulary_entity_data_missing', { entity: itemCopy.itemJourney })}
        onGoBack={() => navigation.goBack()}
      />
    );
  }

  const commentField = createEntityCommentFieldBindings(itemJourney.storyId, comments);

  const detailsPanel = (
    <>
      <TagList tags={itemJourneyTags} variant="chip" emptyMessage={t('no_tags_found')} />

      <CommentableDetailField
        {...commentField('newState', itemJourney.newState || t('common_na'))}
        label={t('item_state')}
      />
    </>
  );

  const relationsPanel = (
    <>
      {relatedItem && (
        <TouchableOpacity onPress={handleItemPress} style={layout.row} activeOpacity={0.7}>
          <View style={{ flex: 1 }}>
            <DetailField label={itemCopy.entity} value={relatedItem.name} />
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

      {relatedScene && (
        <TouchableOpacity onPress={handleScenePress} style={layout.row} activeOpacity={0.7}>
          <View style={{ flex: 1 }}>
            <DetailField label={sceneCopy.entity} value={relatedScene.name} />
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

      {newCharacterOwner && (
        <TouchableOpacity onPress={handleNewOwnerPress} style={layout.row} activeOpacity={0.7}>
          <View style={{ flex: 1 }}>
            <DetailField
              label={t('item_journey_new_character_owner_label', {
                character: characterTerm,
                ending: characterOwnerEnding,
                prefix: characterOwnerPrefix,
              })}
              value={newCharacterOwner.name}
            />
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

      <NoteManager
        noteRelations={itemJourneyNoteRelations}
        availableNotes={allNotes}
        onSave={saveNoteRelation}
        onDelete={deleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={itemJourneyId}
        currentEntityType="ItemJourney"
      />

      <SeeAlsoManager
        storyId={itemJourney.storyId}
        entityType="ItemJourney"
        entityId={itemJourneyId}
        editable={false}
      />
    </>
  );

  const otherPanel = (
    <>
      <CommentableDetailField
        {...commentField('extraNotes', itemJourney.extraNotes || t('common_na'))}
        label={t('extra_notes')}
      />

      <EntityMetadata
        version={itemJourney.version}
        createdAt={itemJourney.createdAt}
        updatedAt={itemJourney.updatedAt}
      />
    </>
  );

  return (
    <DetailContainer
      title={headerTitle}
      landing={occurrence ?? null}
      footer={
        <>
          <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
        </>
      }
      tabs={<DetailTabs tabs={tabItems} value={tab} onChange={setTab} />}
      scrollResetKey={tab}
    >
      <DetailTabPanels
        value={tab}
        panels={{ details: detailsPanel, relations: relationsPanel, other: otherPanel }}
      />
    </DetailContainer>
  );
};

export default ItemJourneyDetailScreen;
