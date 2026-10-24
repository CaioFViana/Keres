import { DetailTabPanels, DetailTabs } from '@/src/components/layout/DetailTabs/DetailTabs';
import { useDetailTab, useDetailTabItems } from '@/src/hooks/nav/useDetailTab';
import { useLocationRelationActions } from './useLocationRelationActions';
import { useLocationDetailServices } from './useLocationDetailServices';
import { useLocationStoryLists } from './useLocationStoryLists';
import { createEntityCommentFieldBindings } from '@/src/components/features/comments/CommentableDetailField/createCommentFieldBindings';
import type { OccurrenceTarget } from '@/src/utils/entity/occurrenceTarget';
import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import EntityMetadata from '@/src/mentions/EntityMetadataWithBacklinks';
import TagList from '@/src/components/common/display/TagList/TagList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import CustomAttributeDetailFields from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import FavoritedByList from '@/src/components/features/favorites/FavoritedByList/FavoritedByList';
import EntityGalleryManager from '@/src/components/features/gallery/GalleryManager/EntityGalleryManager';
import LocationItemManager from '@/src/components/features/locations/LocationManager/LocationItemManager';
import NoteManager from '@/src/components/features/notes/NoteManager';
import LocationRelationManager from '@/src/components/features/relations/LocationRelationManager/LocationRelationManager';
import RelatedScenesList from '@/src/components/features/scenes/RelatedScenesList/RelatedScenesList';
import ScenePresenceList, {
  groupScenePresenceEntries,
} from '@/src/components/features/scenes/ScenePresenceList/ScenePresenceList';
import AppearsInArcsSection from '@/src/components/features/arcs/AppearsInArcsSection';
import { useAppearsInArcs } from '@/src/hooks/arcs/useAppearsInArcs';
import SeeAlsoManager from '@/src/components/features/see-also/SeeAlsoManager/SeeAlsoManager';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useDetailRecord } from '@/src/hooks/lists/useDetailRecord';
import { useEntityComments } from '@/src/hooks/comments/useEntityComments';
import { useEntityRelations } from '@/src/hooks/relations/useEntityRelations';
import { useOpenGalleryMediaViewer } from '@/src/hooks/media/useOpenGalleryMediaViewer';
import { useStoryRole } from '@/src/hooks/story/useStoryRole';
import type { LocationStackParamList } from '@/src/navigation/drawer/MainSystemDrawer';
import { useStoryStore } from '@/src/state/story/storyStore';
import { useVocabularyEntityCopy } from '@/src/hooks/vocabulary/useVocabularyEntityCopy';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import type { LocationsScreenNavigationProp } from './LocationListScreen';

export type LocationDetailScreenParamList = {
  LocationDetail: { locationId: string; occurrence?: OccurrenceTarget };
};

type LocationDetailScreenRouteProp = RouteProp<LocationStackParamList, 'LocationDetail'>;

const LocationDetailsScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });

  const navigation = useNavigation<LocationsScreenNavigationProp>();
  const openGalleryMediaViewer = useOpenGalleryMediaViewer();
  const route = useRoute<LocationDetailScreenRouteProp>();
  const { locationId, occurrence } = route.params;
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Location');
  const sceneCopy = useVocabularyEntityCopy('Scene');
  const { selectedStory } = useStoryStore();
  const { userId } = useUserSettingsStore();

  const { locationService, relationService } = useLocationDetailServices();

  const {
    record: location,
    loading,
    failure,
  } = useDetailRecord({
    id: locationId,
    load: locationService.getById,
    event: 'location_changed',
    label: 'location details',
    onGone: navigation.goBack,
  });
  const { canEdit } = useStoryRole(location?.storyId);
  const comments = useEntityComments(location?.storyId, 'Location', locationId);

  const {
    selectedTags: locationTags,
    allNotes,
    noteRelations: locationNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'Location', entityId: locationId });
  const appearingArcs = useAppearsInArcs(location?.storyId ?? '', 'location', locationId);

  const {
    characters: allCharacters,
    scenes: allScenes,
    characterScenes: characterSceneRelations,
    items: allItems,
    itemJourneys: allItemJourneys,
    locations: allLocations,
    locationRelations: allLocationRelations,
  } = useLocationStoryLists(selectedStory?.id, location !== null);

  const errorMessage = failure === 'notFound' ? copy.notFound : copy.failedToLoad;
  const headerTitle = location
    ? location.name || copy.detailsTitle
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
        id: 'edit',
        icon: 'pencil-outline',
        label: t('edit'),
        onPress: () => {
          if (location && canEdit) navigation.navigate('LocationForm', { locationId: location.id });
        },
        visible: !!(location && canEdit),
      },
    ],
  });

  const { handleSetParent, handleAddChild, handleAddConnection, handleRemoveLocationRelation } =
    useLocationRelationActions({
      relationService,
      storyId: selectedStory?.id,
      userId,
      locationId,
      t,
    });

  const locationCharacterEntries = useMemo(() => {
    const scenesById = new Map(
      allScenes
        .filter((scene) => scene.locationId === locationId)
        .map((scene) => [scene.id, scene]),
    );
    const pairs = characterSceneRelations.flatMap((relation) => {
      const scene = scenesById.get(relation.sceneId);
      const character = allCharacters.find((candidate) => candidate.id === relation.characterId);
      return scene && character ? [{ item: character, scene }] : [];
    });
    return groupScenePresenceEntries(pairs);
  }, [allCharacters, allScenes, characterSceneRelations, locationId]);

  const [tab, setTab] = useDetailTab(occurrence);
  const tabItems = useDetailTabItems(t);

  if (loading) {
    return <ScreenLoading padded message={copy.loadingDetails} />;
  }

  if (failure) {
    return <ScreenError padded message={errorMessage} onGoBack={() => navigation.goBack()} />;
  }

  if (!location) {
    return <ScreenError padded message={copy.notFound} onGoBack={() => navigation.goBack()} />;
  }

  const commentField = createEntityCommentFieldBindings(location.storyId, comments, location.id);

  const detailsPanel = (
    <>
      <TagList tags={locationTags} variant="chip" emptyMessage={t('no_tags_found')} />

      <CommentableDetailField
        {...commentField('description', location.description || t('common_na'))}
        label={t('description')}
      />

      <DetailField
        label={t('field_intExt')}
        value={location.intExt ? t(`int_ext_${location.intExt}`) : t('common_na')}
      />

      <CommentableDetailField
        {...commentField('climate', location.climate || t('common_na'))}
        label={t('field_climate')}
      />

      <CommentableDetailField
        {...commentField('culture', location.culture || t('common_na'))}
        label={t('field_culture')}
      />

      <CommentableDetailField
        {...commentField('politics', location.politics || t('common_na'))}
        label={t('field_politics')}
      />

      <ScreenSection title={t('media_section_title')} />

      <EntityGalleryManager
        ownerId={locationId}
        ownerType="Location"
        onPressMedia={openGalleryMediaViewer}
        editable={canEdit}
      />
    </>
  );

  const relationsPanel = (
    <>
      <LocationRelationManager
        currentLocationId={locationId}
        allLocations={allLocations}
        allLocationRelations={allLocationRelations}
        onSetParent={handleSetParent}
        onAddChild={handleAddChild}
        onAddConnection={handleAddConnection}
        onRemoveRelation={handleRemoveLocationRelation}
        editable={false}
      />

      <ScenePresenceList
        entries={locationCharacterEntries}
        title={t('characters_in_location_title')}
        noItemsMessage="no_characters_in_location"
        entityType="Character"
        sceneLabel={sceneCopy.entity}
      />

      <RelatedScenesList
        scenes={allScenes}
        matchesScene={(scene) => scene.locationId === locationId}
        title={t('scenes_in_location_title')}
        noItemsMessage="no_scenes_in_location"
        getDetails={(scene) =>
          scene.summary ? [{ label: t('summary'), value: scene.summary }] : []
        }
      />

      <LocationItemManager
        currentLocationId={locationId}
        availableItemJourneys={allItemJourneys}
        availableItems={allItems}
        availableScenes={allScenes}
        availableCharacters={allCharacters}
      />

      <NoteManager
        noteRelations={locationNoteRelations}
        availableNotes={allNotes}
        onSave={saveNoteRelation}
        onDelete={deleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={locationId}
        currentEntityType="Location"
      />

      <AppearsInArcsSection arcs={appearingArcs} />

      <SeeAlsoManager
        storyId={location.storyId}
        entityType="Location"
        entityId={locationId}
        editable={false}
      />
    </>
  );

  const otherPanel = (
    <>
      <CustomAttributeDetailFields
        storyId={location.storyId}
        entityType="Location"
        entityId={locationId}
      />

      <CommentableDetailField
        {...commentField('extraNotes', location.extraNotes || t('common_na'))}
        label={t('extra_notes')}
      />

      <FavoritedByList storyId={location.storyId} entityId={locationId} entityType="Location" />

      <EntityMetadata
        version={location.version}
        createdAt={location.createdAt}
        updatedAt={location.updatedAt}
        entityType="Location"
        entityId={location.id}
      />
    </>
  );

  return (
    <DetailContainer
      title={location.name}
      landing={occurrence ?? null}
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

export default LocationDetailsScreen;
