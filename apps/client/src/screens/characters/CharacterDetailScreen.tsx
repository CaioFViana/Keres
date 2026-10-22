import { createCommentFieldBindings } from '@/src/components/features/comments/CommentableDetailField/createCommentFieldBindings';
import type { OccurrenceTarget } from '@/src/utils/entity/occurrenceTarget';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import { groupScenePresenceEntries } from '@/src/components/features/scenes/ScenePresenceList/ScenePresenceList';
import { useAppearsInArcs } from '@/src/hooks/arcs/useAppearsInArcs';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useDetailRecord } from '@/src/hooks/lists/useDetailRecord';
import { useEntityComments } from '@/src/hooks/comments/useEntityComments';
import { useEntityRelations } from '@/src/hooks/relations/useEntityRelations';
import { useOpenGalleryMediaViewer } from '@/src/hooks/media/useOpenGalleryMediaViewer';
import { useOpenPresenceMatrixViewer } from '@/src/hooks/character/useOpenPresenceMatrixViewer';
import { useStoryRole } from '@/src/hooks/story/useStoryRole';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { type ThemeColors } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import type { CharactersScreenNavigationProp } from '@/src/navigation/navigationProps';
import { useStoryStats } from '@/src/hooks/story/useStoryStats';
import { useStoryStore } from '@/src/state/story/storyStore';
import { useVocabularyEntityCopy } from '@/src/hooks/vocabulary/useVocabularyEntityCopy';
import { CharacterDetailContent } from './CharacterDetailContent';
import { createCharacterDetailMutations } from './createCharacterDetailMutations';
import { useCharacterDetailServices } from './useCharacterDetailServices';
import { useCharacterStoryLists } from './useCharacterStoryLists';

// Define the parameter list for this screen
export type CharacterDetailScreenParamList = {
  CharacterDetail: { characterId: string; occurrence?: OccurrenceTarget };
};

type CharacterDetailScreenRouteProp = RouteProp<CharacterDetailScreenParamList, 'CharacterDetail'>;

/** The detail screen never writes; the manager requires the callbacks, so they get a no-op. */
const noopModeWrite = async () => {};

const CharacterDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const navigation = useNavigation<CharactersScreenNavigationProp>();
  const openGalleryMediaViewer = useOpenGalleryMediaViewer();
  const { openCharacter: openPresenceMatrix } = useOpenPresenceMatrixViewer();
  const route = useRoute<CharacterDetailScreenRouteProp>();
  const { characterId, occurrence } = route.params;
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Character');
  const sceneCopy = useVocabularyEntityCopy('Scene');
  const locationCopy = useVocabularyEntityCopy('Location');
  const { userId } = useUserSettingsStore();

  const services = useCharacterDetailServices();
  const {
    record: character,
    loading,
    failure,
  } = useDetailRecord({
    id: characterId,
    load: services.characterService.getById,
    event: 'character_changed',
    label: 'character details',
    onGone: navigation.goBack,
  });
  const { canEdit } = useStoryRole(character?.storyId);
  const { selectedStory } = useStoryStore();
  const statSystemEnabled = !!selectedStory?.statSystem;
  // Always loaded: modes exist even with the stats system turned off, and this is where
  // the reader consults them (creating and editing happens on the form).
  const statData = useStoryStats(character?.storyId);
  const characterModes = useMemo(
    () => statData.modes.filter((mode) => mode.characterId === characterId),
    [statData.modes, characterId],
  );
  const { commentsByField, canComment, isStoryOwner, currentUserId, addComment, deleteComment } =
    useEntityComments(character?.storyId, 'Character', characterId);

  const {
    selectedTags: characterTags,
    allNotes,
    noteRelations: characterNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'Character', entityId: characterId });
  const appearingArcs = useAppearsInArcs(character?.storyId ?? '', 'character', characterId);
  const {
    characters: allCharacters,
    relations: characterRelations,
    characterScenes: characterSceneRelations,
    scenes: allScenes,
    items: allItems,
    itemJourneys: allItemJourneys,
    locations: allLocations,
  } = useCharacterStoryLists(services, character?.storyId, characterId);

  const styles = useThemedStyles(createStyles);

  const {
    handleSaveRelation,
    handleDeleteRelation,
    handleSaveCharacterScene,
    handleDeleteCharacterScene,
  } = createCharacterDetailMutations({
    relationService: services.relationService,
    characterSceneService: services.characterSceneService,
    character,
    userId,
    t,
    characterId,
  });

  const headerTitle = character
    ? character.name || copy.detailsTitle
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
        label: t('presence_matrix_title'),
        onPress: () => openPresenceMatrix(characterId),
        visible: !!(selectedStory?.type === 'linear'),
      },
      {
        id: 'action-1',
        icon: 'pencil-outline',
        label: t('edit'),
        onPress: () => navigation.navigate('CharacterForm', { characterId }),
        visible: !!canEdit,
      },
    ],
  });

  const characterLocationEntries = useMemo(() => {
    const pairs = characterSceneRelations.flatMap((relation) => {
      if (relation.characterId !== characterId || relation.isDeleted) return [];
      const scene = allScenes.find((candidate) => candidate.id === relation.sceneId);
      const location = scene?.locationId
        ? allLocations.find((candidate) => candidate.id === scene.locationId)
        : undefined;
      return scene && !scene.isDeleted && location && !location.isDeleted
        ? [{ item: location, scene }]
        : [];
    });
    return groupScenePresenceEntries(pairs);
  }, [allLocations, allScenes, characterId, characterSceneRelations]);

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

  if (!character) {
    return <ScreenError padded message={copy.dataMissing} onGoBack={() => navigation.goBack()} />;
  }

  const commentField = createCommentFieldBindings({
    storyId: character.storyId,
    mentionSourceId: character.id,
    canComment,
    isStoryOwner,
    currentUserId,
    onDeleteComment: deleteComment,
    commentsByField,
    addComment,
  });

  return (
    <CharacterDetailContent
      character={character}
      navigation={navigation}
      t={t}
      characterTags={characterTags}
      styles={styles}
      commentField={commentField}
      characterId={characterId}
      openGalleryMediaViewer={openGalleryMediaViewer}
      canEdit={canEdit}
      statSystemEnabled={statSystemEnabled}
      statData={statData}
      selectedStory={selectedStory}
      characterModes={characterModes}
      noopModeWrite={noopModeWrite}
      characterRelations={characterRelations}
      allCharacters={allCharacters}
      handleSaveRelation={handleSaveRelation}
      handleDeleteRelation={handleDeleteRelation}
      characterSceneRelations={characterSceneRelations}
      allScenes={allScenes}
      allLocations={allLocations}
      storyType={selectedStory?.type}
      handleSaveCharacterScene={handleSaveCharacterScene}
      handleDeleteCharacterScene={handleDeleteCharacterScene}
      allItems={allItems}
      allItemJourneys={allItemJourneys}
      characterLocationEntries={characterLocationEntries}
      locationCopy={locationCopy}
      sceneCopy={sceneCopy}
      characterNoteRelations={characterNoteRelations}
      allNotes={allNotes}
      saveNoteRelation={saveNoteRelation}
      deleteNoteRelation={deleteNoteRelation}
      appearingArcs={appearingArcs}
      occurrence={occurrence}
    />
  );
};
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    subTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 15,
    },
  });

export default CharacterDetailScreen;
