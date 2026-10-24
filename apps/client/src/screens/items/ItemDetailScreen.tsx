import { DetailTabPanels, DetailTabs } from '@/src/components/layout/DetailTabs/DetailTabs';
import { useDetailTab, useDetailTabItems } from '@/src/hooks/nav/useDetailTab';
import Button from '@/src/components/common/controls/Button/Button';
import { createEntityCommentFieldBindings } from '@/src/components/features/comments/CommentableDetailField/createCommentFieldBindings';
import type { OccurrenceTarget } from '@/src/utils/entity/occurrenceTarget';
import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import EntityMetadata from '@/src/mentions/EntityMetadataWithBacklinks';
import TagList from '@/src/components/common/display/TagList/TagList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import CustomAttributeDetailFields from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import FavoritedByList from '@/src/components/features/favorites/FavoritedByList/FavoritedByList';
import EntityGalleryManager from '@/src/components/features/gallery/GalleryManager/EntityGalleryManager';
import ItemJourneyTimeline from '@/src/components/features/item-journeys/ItemJourney/ItemJourneyTimeline';
import NoteManager from '@/src/components/features/notes/NoteManager';
import AppearsInArcsSection from '@/src/components/features/arcs/AppearsInArcsSection';
import { useAppearsInArcs } from '@/src/hooks/arcs/useAppearsInArcs';
import SeeAlsoManager from '@/src/components/features/see-also/SeeAlsoManager/SeeAlsoManager';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useDetailRecord } from '@/src/hooks/lists/useDetailRecord';
import { useStoryEntities } from '@/src/hooks/lists/useStoryEntities';
import { useEntityComments } from '@/src/hooks/comments/useEntityComments';
import { useEntityRelations } from '@/src/hooks/relations/useEntityRelations';
import { useOpenGalleryMediaViewer } from '@/src/hooks/media/useOpenGalleryMediaViewer';
import { useOpenPresenceMatrixViewer } from '@/src/hooks/character/useOpenPresenceMatrixViewer';
import { useStoryRole } from '@/src/hooks/story/useStoryRole';
import { useStoryStore } from '@/src/state/story/storyStore';
import { useTheme } from '@/src/theme';
import { useVocabularyEntityCopy } from '@/src/hooks/vocabulary/useVocabularyEntityCopy';
import { useStoryVocabulary } from '@/src/hooks/vocabulary/useStoryVocabulary';
import type { ItemsScreenNavigationProp } from './ItemListScreen';
import { useItemDetailServices } from './useItemDetailServices';

export type ItemDetailScreenParamList = {
  ItemDetail: { itemId: string; occurrence?: OccurrenceTarget };
};

const CHARACTER_EVENTS = ['character_changed'] as const;

type ItemDetailScreenRouteProp = RouteProp<ItemDetailScreenParamList, 'ItemDetail'>;

const ItemDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  useTheme();
  const navigation = useNavigation<ItemsScreenNavigationProp>();
  const openGalleryMediaViewer = useOpenGalleryMediaViewer();
  const { openItem: openJourneyMap } = useOpenPresenceMatrixViewer();
  const route = useRoute<ItemDetailScreenRouteProp>();
  const { itemId, occurrence } = route.params;
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Item');
  const { agree, term } = useStoryVocabulary();
  const characterOwnerEnding = agree('Character', {
    masculine: 'o',
    feminine: 'a',
    neutral: 'o',
  });
  const { selectedStory } = useStoryStore();

  const { itemService, characterService } = useItemDetailServices();
  const {
    record: item,
    loading,
    failure,
  } = useDetailRecord({
    id: itemId,
    load: itemService.getById,
    event: 'item_changed',
    label: 'item details',
    onGone: navigation.goBack,
  });
  const { canEdit } = useStoryRole(item?.storyId);
  const comments = useEntityComments(item?.storyId, 'Item', itemId);

  const {
    selectedTags: itemTags,
    allNotes,
    noteRelations: itemNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'Item', entityId: itemId });
  const appearingArcs = useAppearsInArcs(item?.storyId ?? '', 'item', itemId);
  const allCharacters = useStoryEntities({
    storyId: selectedStory?.id,
    enabled: item !== null,
    load: characterService.getAllByStoryId,
    events: CHARACTER_EVENTS,
    label: 'all characters',
  });

  const headerTitle = item
    ? item.name || copy.detailsTitle
    : failure === 'notFound'
      ? copy.notFound
      : failure === 'failed'
        ? t('error')
        : t('loading');

  useScreenHeader({
    target: 'parent',
    title: headerTitle,
    actions: [
      {
        id: 'action-0',
        icon: 'map-outline',
        label: t('presence_matrix_item_title'),
        onPress: () => openJourneyMap(itemId),
        visible: !!(selectedStory?.type === 'linear'),
      },
      {
        id: 'action-1',
        icon: 'pencil-outline',
        label: t('edit'),
        onPress: () => navigation.navigate('ItemForm', { itemId }),
        visible: !!canEdit,
      },
    ],
  });

  const [tab, setTab] = useDetailTab(occurrence);
  const tabItems = useDetailTabItems(t);

  if (loading) {
    return <ScreenLoading padded message={copy.loadingDetails} />;
  }
  if (failure) {
    return (
      <ScreenError
        padded
        message={failure === 'notFound' ? copy.notFound : copy.failedToLoad}
        onGoBack={() => navigation.goBack()}
      />
    );
  }
  if (!item) {
    return <ScreenError padded message={copy.dataMissing} onGoBack={() => navigation.goBack()} />;
  }

  const owner = item.characterOwnerId
    ? allCharacters.find((c) => c.id === item.characterOwnerId)
    : undefined;

  const commentField = createEntityCommentFieldBindings(item.storyId, comments, item.id);

  const detailsPanel = (
    <>
      <TagList tags={itemTags} variant="chip" emptyMessage={t('no_tags_found')} />

      <CommentableDetailField
        {...commentField('description', item.description || t('common_na'))}
        label={t('description')}
      />

      <CommentableDetailField
        {...commentField('category', item.category || t('common_na'))}
        label={t('category')}
      />

      <CommentableDetailField
        {...commentField('initialState', item.initialState || t('common_na'))}
        label={t('initial_state')}
      />

      <DetailField
        label={t('item_character_owner_label', {
          character: term('Character'),
          ending: characterOwnerEnding,
        })}
        value={owner?.name || t('common_na')}
      />

      <ScreenSection title={t('media_section_title')} />

      <EntityGalleryManager
        ownerId={itemId}
        ownerType="Item"
        onPressMedia={openGalleryMediaViewer}
        editable={canEdit}
      />
    </>
  );

  const relationsPanel = (
    <>
      {selectedStory && (
        <>
          <ItemJourneyTimeline
            item={item}
            storyId={selectedStory.id}
            storyType={selectedStory.type}
          />
        </>
      )}

      <NoteManager
        noteRelations={itemNoteRelations}
        availableNotes={allNotes}
        onSave={saveNoteRelation}
        onDelete={deleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={itemId}
        currentEntityType="Item"
      />

      <AppearsInArcsSection arcs={appearingArcs} />

      <SeeAlsoManager storyId={item.storyId} entityType="Item" entityId={itemId} editable={false} />
    </>
  );

  const otherPanel = (
    <>
      <CustomAttributeDetailFields storyId={item.storyId} entityType="Item" entityId={itemId} />

      <CommentableDetailField
        {...commentField('extraNotes', item.extraNotes || t('common_na'))}
        label={t('extra_notes')}
      />

      <DetailField
        label={t('is_favorite')}
        value={item.isFavorite ? t('common_yes') : t('common_no')}
      />

      <FavoritedByList storyId={item.storyId} entityId={itemId} entityType="Item" />

      <EntityMetadata
        version={item.version}
        createdAt={item.createdAt}
        updatedAt={item.updatedAt}
        entityType="Item"
        entityId={item.id}
      />
    </>
  );

  return (
    <DetailContainer
      title={item.name}
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

export default ItemDetailScreen;
