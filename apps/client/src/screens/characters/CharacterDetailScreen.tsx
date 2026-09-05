import Button from '@/src/components/common/controls/Button/Button';
import { createCommentFieldBindings } from '@/src/components/features/comments/CommentableDetailField/createCommentFieldBindings';
import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import EntityMetadata from '@/src/components/features/mentions/EntityMetadataWithBacklinks';
import TagList from '@/src/components/common/display/TagList/TagList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import CustomAttributeDetailFields from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields';
import CharacterSceneManager from '@/src/components/features/characters/CharacterManager/CharacterSceneManager'; // The manager component
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import FavoritedByList from '@/src/components/features/favorites/FavoritedByList/FavoritedByList';
import EntityGalleryManager from '@/src/components/features/gallery/GalleryManager/EntityGalleryManager';
import ItemCharacterManager from '@/src/components/features/items/ItemManager/ItemCharacterManager'; // Import ItemCharacterManager
import NoteManager from '@/src/components/features/notes/NoteManager'; // Import NoteManager
import CharacterRelationManager from '@/src/components/features/relations/CharacterRelationManager/CharacterRelationManager'; // Import CharacterRelationManager
import ScenePresenceList, {
  groupScenePresenceEntries,
} from '@/src/components/features/scenes/ScenePresenceList/ScenePresenceList';
import AppearsInArcsSection from '@/src/components/features/arcs/AppearsInArcsSection';
import { useAppearsInArcs } from '@/src/hooks/useAppearsInArcs';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import type { CharacterRelation } from '@keres/shared/entities/CharacterRelation'; // Import CharacterRelation
import type { CharacterScene } from '@keres/shared/entities/CharacterScene'; // Entity type
import type { Item, ItemJourney } from '@keres/shared/entities/Item'; // Import Item and ItemJourney entities
import type { Location } from '@keres/shared/entities/Location'; // Import Location entity
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { useDrizzle } from '../../db';
import type { SceneSelect } from '../../db/schema'; // For available scenes
import type { CharacterSelect } from '../../db/schemas/characters';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import {
  useEntityEventSubscriptions,
  useEntityInitialLoad,
} from '../../hooks/useEntityRefreshLifecycle';
import { useEntityComments } from '../../hooks/useEntityComments';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useOpenGalleryMediaViewer } from '../../hooks/useOpenGalleryMediaViewer';
import { useOpenPresenceMatrixViewer } from '../../hooks/useOpenPresenceMatrixViewer';
import { useStoryRole } from '../../hooks/useStoryRole';
import type { CharacterRelationServiceInterface } from '../../services/storymanagement/CharacterRelationService';
import { createCharacterRelationService } from '../../services/storymanagement/CharacterRelationService'; // Import CharacterRelationService
import type { CharacterSceneServiceInterface } from '../../services/storymanagement/CharacterSceneService';
import { createCharacterSceneService } from '../../services/storymanagement/CharacterSceneService'; // Service for CharacterScene
import { createCharacterService } from '../../services/storymanagement/CharacterService';
import type { ItemJourneyService } from '../../services/storymanagement/ItemJourneyService';
import { createItemJourneyService } from '../../services/storymanagement/ItemJourneyService'; // Import ItemJourneyService
import type { ItemService } from '../../services/storymanagement/ItemService';
import { createItemService } from '../../services/storymanagement/ItemService'; // Import ItemService
import type { LocationService } from '../../services/storymanagement/LocationService';
import { createLocationService } from '../../services/storymanagement/LocationService'; // Import LocationService
import { createSceneService } from '../../services/storymanagement/SceneService';
import { useUserSettingsStore } from '../../state/userSettingsStore'; // Import useUserSettingsStore
import { useTheme } from '../../theme';
import { AppAlert } from '../../utils/AppAlert';
import { entityEventEmitter } from '../../utils/EventEmitter';
import type { CharactersScreenNavigationProp } from '../../navigation/navigationProps';
import { CharacterStatPanel } from '../../components/features/stats/CharacterStatPanel/CharacterStatPanel';
import { ModeManager } from '../../components/features/stats/ModeManager/ModeManager';
import { useStoryStats } from '../../hooks/useStoryStats';
import { useStoryStore } from '../../state/storyStore';
import { useVocabularyEntityCopy } from '../../vocabulary/useVocabularyEntityCopy';
import type { StatNotation } from '@keres/shared/graphs/statLadder';

// Define the parameter list for this screen
export type CharacterDetailScreenParamList = {
  CharacterDetail: { characterId: string };
};

type CharacterDetailScreenRouteProp = RouteProp<CharacterDetailScreenParamList, 'CharacterDetail'>;

/** The detail screen never writes; the manager requires the callbacks, so they get a no-op. */
const noopModeWrite = async () => {};

const CharacterDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<CharactersScreenNavigationProp>();
  const openGalleryMediaViewer = useOpenGalleryMediaViewer();
  const { openCharacter: openPresenceMatrix } = useOpenPresenceMatrixViewer();
  const route = useRoute<CharacterDetailScreenRouteProp>();
  const { characterId } = route.params;
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Character');
  const sceneCopy = useVocabularyEntityCopy('Scene');
  const locationCopy = useVocabularyEntityCopy('Location');
  const { userId } = useUserSettingsStore(); // Get userId from store

  const drizzleDb = useDrizzle();
  const characterServiceRef = useRef<ReturnType<typeof createCharacterService> | null>(null);
  const characterRelationServiceRef = useRef<CharacterRelationServiceInterface | null>(null); // Ref for CharacterRelationService
  const characterSceneServiceRef = useRef<CharacterSceneServiceInterface | null>(null); // Ref for CharacterSceneService
  const itemServiceRef = useRef<ItemService | null>(null); // Ref for ItemService
  const itemJourneyServiceRef = useRef<ItemJourneyService | null>(null); // Ref for ItemJourneyService
  const locationServiceRef = useRef<LocationService | null>(null); // Ref for LocationService

  // Initialize services once when drizzleDb is available
  useEffect(() => {
    if (drizzleDb) {
      if (!characterServiceRef.current) {
        characterServiceRef.current = createCharacterService(drizzleDb);
      }
      if (!characterRelationServiceRef.current) {
        characterRelationServiceRef.current = createCharacterRelationService(drizzleDb);
      }
      if (!characterSceneServiceRef.current) {
        characterSceneServiceRef.current = createCharacterSceneService(drizzleDb);
      }
      if (!itemServiceRef.current) {
        itemServiceRef.current = createItemService(drizzleDb);
      }
      if (!itemJourneyServiceRef.current) {
        itemJourneyServiceRef.current = createItemJourneyService(drizzleDb);
      }
      if (!locationServiceRef.current) {
        locationServiceRef.current = createLocationService(drizzleDb);
      }
    }
  }, [drizzleDb]);

  const [character, setCharacter] = useState<CharacterSelect | null>(null);
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
  const {
    commentsByField,
    canComment,
    isStoryOwner,
    currentUserId,
    addComment,
    deleteComment,
    updateComment,
  } = useEntityComments(character?.storyId, 'Character', characterId);
  const [characterRelations, setCharacterRelations] = useState<CharacterRelation[]>([]); // State for relations
  const [allCharacters, setAllCharacters] = useState<CharacterSelect[]>([]); // State for all characters in story

  const {
    selectedTags: characterTags,
    allNotes,
    noteRelations: characterNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'Character', entityId: characterId });
  const appearingArcs = useAppearsInArcs(character?.storyId ?? '', 'character', characterId);
  const [allScenes, setAllScenes] = useState<SceneSelect[]>([]); // State for all scenes in story
  const [characterSceneRelations, setCharacterSceneRelations] = useState<CharacterScene[]>([]); // State for character scene relations
  const [allItems, setAllItems] = useState<Item[]>([]); // State for all items in story
  const [allItemJourneys, setAllItemJourneys] = useState<ItemJourney[]>([]); // State for all item journeys in story
  const [allLocations, setAllLocations] = useState<Location[]>([]); // State for all locations in story
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

  // Move styles declaration to the top
  const styles = StyleSheet.create({
    subTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 15,
    },
  });

  const fetchCharacter = useCallback(async () => {
    if (!characterServiceRef.current) {
      console.warn('Character service not initialized.');
      return;
    }
    try {
      setLoading(true);
      const fetchedCharacter = await characterServiceRef.current.getById(characterId);
      if (fetchedCharacter && !fetchedCharacter.isDeleted) {
        setCharacter(fetchedCharacter);
        setHeaderTitle(fetchedCharacter.name || copy.detailsTitle);
      } else if (fetchedCharacter && fetchedCharacter.isDeleted) {
        navigation.goBack();
      } else {
        setError(copy.notFound);
        setHeaderTitle(copy.notFound);
      }
    } catch (err) {
      console.error('Failed to fetch character details:', err);
      setError(copy.failedToLoad);
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [characterId, setCharacter, setLoading, setError, setHeaderTitle, navigation, copy, t]);

  const fetchRelationsForCharacter = useCallback(async () => {
    if (!characterRelationServiceRef.current || !character?.storyId || !characterId) {
      setCharacterRelations([]);
      return;
    }
    try {
      const fetchedRelations = await characterRelationServiceRef.current.getRelationsForCharacter(
        character.storyId,
        characterId,
      );
      setCharacterRelations(fetchedRelations);
    } catch (err) {
      console.error('Failed to fetch character relations:', err);
    }
  }, [character?.storyId, characterId]);

  const fetchAllCharactersInStory = useCallback(async () => {
    if (!characterServiceRef.current || !character?.storyId) {
      setAllCharacters([]);
      return;
    }
    try {
      const fetchedCharacters = await characterServiceRef.current.getAllByStoryId(
        character.storyId,
      );
      setAllCharacters(fetchedCharacters.filter((c) => !c.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all characters:', err);
    }
  }, [character?.storyId]);

  const fetchScenesForCharacter = useCallback(async () => {
    if (!characterSceneServiceRef.current || !character?.storyId || !characterId) {
      setCharacterSceneRelations([]);
      return;
    }
    try {
      const fetchedRelations = await characterSceneServiceRef.current.getRelationsForCharacter(
        character.storyId,
        characterId,
      );
      setCharacterSceneRelations(fetchedRelations);
    } catch (err) {
      console.error('Failed to fetch character scene relations:', err);
    }
  }, [character?.storyId, characterId]);

  const fetchAllScenesInStory = useCallback(async () => {
    if (!drizzleDb || !character?.storyId) {
      setAllScenes([]);
      return;
    }
    try {
      const sceneService = createSceneService(drizzleDb);
      const fetchedScenes = await sceneService.getScenesByStoryId(character.storyId);
      setAllScenes(fetchedScenes.filter((s) => !s.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all scenes:', err);
    }
  }, [character?.storyId, drizzleDb]);

  const fetchAllItemsInStory = useCallback(async () => {
    if (!itemServiceRef.current || !character?.storyId) {
      setAllItems([]);
      return;
    }
    try {
      const fetchedItems = await itemServiceRef.current.getAllByStoryId(character.storyId);
      setAllItems(fetchedItems.filter((i) => !i.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all items:', err);
    }
  }, [character?.storyId]);

  const fetchAllItemJourneysInStory = useCallback(async () => {
    if (!itemJourneyServiceRef.current || !character?.storyId) {
      setAllItemJourneys([]);
      return;
    }
    try {
      const fetchedItemJourneys = await itemJourneyServiceRef.current.getAllByStoryId(
        character.storyId,
      );
      setAllItemJourneys(fetchedItemJourneys.filter((ij) => !ij.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all item journeys:', err);
    }
  }, [character?.storyId]);

  const fetchAllLocationsInStory = useCallback(async () => {
    if (!locationServiceRef.current || !character?.storyId) {
      setAllLocations([]);
      return;
    }
    try {
      const fetchedLocations = await locationServiceRef.current.getAllByStoryId(character.storyId);
      setAllLocations(fetchedLocations.filter((l) => !l.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all locations:', err);
    }
  }, [character?.storyId]);

  const handleCharacterChange = useCallback(
    async (changedStoryId: string, changedCharacterId: string) => {
      if (changedCharacterId === characterId) {
        if (characterServiceRef.current) {
          const updatedCharacter = await characterServiceRef.current.getById(characterId);
          if (!updatedCharacter || updatedCharacter.isDeleted) {
            navigation.goBack();
          } else {
            setCharacter(updatedCharacter);
            setHeaderTitle(updatedCharacter.name || copy.detailsTitle);
          }
        }
      }
    },
    [characterId, navigation, setCharacter, setHeaderTitle, copy],
  );

  const handleCharacterRelationChange = useCallback(
    (changedStoryId: string, changedCharacterId: string) => {
      if (changedCharacterId === characterId) {
        fetchRelationsForCharacter();
      }
    },
    [characterId, fetchRelationsForCharacter],
  );

  const handleCharacterSceneChange = useCallback(
    (changedStoryId: string, changedCharacterId: string) => {
      if (changedCharacterId === characterId) {
        fetchScenesForCharacter();
      }
    },
    [characterId, fetchScenesForCharacter],
  );

  const handleItemChange = useCallback(
    (changedStoryId: string, changedItemId: string) => {
      if (character?.storyId === changedStoryId) {
        fetchAllItemsInStory();
      }
    },
    [character?.storyId, fetchAllItemsInStory],
  );

  const handleItemJourneyChange = useCallback(
    (changedStoryId: string, changedItemJourneyId: string) => {
      if (character?.storyId === changedStoryId) {
        fetchAllItemJourneysInStory();
      }
    },
    [character?.storyId, fetchAllItemJourneysInStory],
  );

  const handleLocationChange = useCallback(
    (changedStoryId: string, changedLocationId: string) => {
      if (character?.storyId === changedStoryId) {
        fetchAllLocationsInStory();
      }
    },
    [character?.storyId, fetchAllLocationsInStory],
  );

  useEntityInitialLoad(fetchCharacter);

  useEntityEventSubscriptions(
    useMemo(
      () => [
        { event: 'character_changed', listener: handleCharacterChange },
        { event: 'character_relation_changed', listener: handleCharacterRelationChange },
        { event: 'character_scene_changed', listener: handleCharacterSceneChange },
        { event: 'item_changed', listener: handleItemChange },
        { event: 'item_journey_changed', listener: handleItemJourneyChange },
        { event: 'location_changed', listener: handleLocationChange },
      ],
      [
        handleCharacterChange,
        handleCharacterRelationChange,
        handleCharacterSceneChange,
        handleItemChange,
        handleItemJourneyChange,
        handleLocationChange,
      ],
    ),
  );

  useEffect(() => {
    if (character) {
      fetchRelationsForCharacter();
      fetchAllCharactersInStory(); // Fetch all characters here
      fetchScenesForCharacter(); // Fetch character scene relations
      fetchAllScenesInStory(); // Fetch all scenes
      fetchAllItemsInStory(); // Fetch all items
      fetchAllItemJourneysInStory(); // Fetch all item journeys
      fetchAllLocationsInStory(); // Fetch all locations
    }
  }, [
    character,
    fetchRelationsForCharacter,
    fetchAllCharactersInStory,
    fetchScenesForCharacter,
    fetchAllScenesInStory,
    fetchAllItemsInStory,
    fetchAllItemJourneysInStory,
    fetchAllLocationsInStory,
  ]);

  const handleSaveRelation = async (relation: CharacterRelation) => {
    if (!characterRelationServiceRef.current || !character?.storyId || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const savedRelation = await characterRelationServiceRef.current.saveCharacterRelation(
        userId,
        relation,
      );
      // Update local state and emit event
      setCharacterRelations((prev) => {
        const existingIndex = prev.findIndex((r) => r.id === savedRelation.id);
        if (existingIndex > -1) {
          return prev.map((r, index) => (index === existingIndex ? savedRelation : r));
        } else {
          return [...prev, savedRelation];
        }
      });
      entityEventEmitter.emit('character_relation_changed', character?.storyId, characterId);
      AppAlert.alert(t('success'), t('relation_saved_successfully'));
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_save_relation'));
      console.error('Failed to save character relation:', error);
    }
  };

  const handleDeleteRelation = async (relationId: string) => {
    if (!characterRelationServiceRef.current || !character?.storyId || !userId) {
      // Added !userId check
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await characterRelationServiceRef.current.deleteCharacterRelation(
        userId,
        relationId,
      ); // Pass userId
      if (success) {
        setCharacterRelations((prev) => prev.filter((r) => r.id !== relationId));
        entityEventEmitter.emit('character_relation_changed', character?.storyId, characterId);
        AppAlert.alert(t('success'), t('relation_deleted_successfully'));
      } else {
        AppAlert.alert(t('error'), t('failed_to_delete_relation'));
      }
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_delete_relation'));
      console.error('Failed to delete character relation:', error);
    }
  };

  const handleSaveCharacterScene = async (characterScene: CharacterScene) => {
    if (!characterSceneServiceRef.current || !character?.storyId || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const savedCharacterScene = await characterSceneServiceRef.current.saveCharacterScene(
        userId,
        characterScene,
      );
      setCharacterSceneRelations((prev) => {
        const existingIndex = prev.findIndex((cs) => cs.id === savedCharacterScene.id);
        if (existingIndex > -1) {
          return prev.map((cs, index) => (index === existingIndex ? savedCharacterScene : cs));
        } else {
          return [...prev, savedCharacterScene];
        }
      });
      entityEventEmitter.emit('character_scene_changed', character?.storyId, characterId);
      AppAlert.alert(t('success'), t('character_scene_saved_successfully'));
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_save_character_scene'));
      console.error('Failed to save character scene:', error);
    }
  };

  const handleDeleteCharacterScene = async (characterSceneId: string) => {
    if (!characterSceneServiceRef.current || !character?.storyId || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await characterSceneServiceRef.current.deleteCharacterScene(
        userId,
        characterSceneId,
      );
      if (success) {
        setCharacterSceneRelations((prev) => prev.filter((cs) => cs.id !== characterSceneId));
        entityEventEmitter.emit('character_scene_changed', character?.storyId, characterId);
        AppAlert.alert(t('success'), t('character_scene_deleted_successfully'));
      } else {
        AppAlert.alert(t('error'), t('failed_to_delete_character_scene'));
      }
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_delete_character_scene'));
      console.error('Failed to delete character scene:', error);
    }
  };

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

  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
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
    onUpdateComment: updateComment,
    commentsByField,
    addComment,
  });

  return (
    <DetailContainer
      title={character.name}
      footer={
        <>
          <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
        </>
      }
    >
      <TagList tags={characterTags} variant="chip" emptyMessage={t('no_tags_found')} />

      {character.title && <Text style={styles.subTitle}>{character.title}</Text>}

      <CommentableDetailField
        {...commentField('gender', character.gender || t('common_na'))}
        label={t('gender')}
      />
      <CommentableDetailField
        {...commentField('race', character.race || t('common_na'))}
        label={t('race')}
      />
      {character.subrace && (
        <CommentableDetailField
          {...commentField('subrace', character.subrace)}
          label={t('subrace')}
        />
      )}
      <CommentableDetailField
        {...commentField('description', character.description || t('common_na'))}
        label={t('description')}
      />
      <CommentableDetailField
        {...commentField('personality', character.personality || t('common_na'))}
        label={t('personality')}
      />
      <CommentableDetailField
        {...commentField('motivation', character.motivation || t('common_na'))}
        label={t('motivation')}
      />
      <CommentableDetailField
        {...commentField('qualities', character.qualities || t('common_na'))}
        label={t('qualities')}
      />
      <CommentableDetailField
        {...commentField('weaknesses', character.weaknesses || t('common_na'))}
        label={t('weaknesses')}
      />
      <CommentableDetailField
        {...commentField('biography', character.biography || t('common_na'))}
        label={t('biography')}
      />
      <CommentableDetailField
        {...commentField('plannedTimeline', character.plannedTimeline || t('common_na'))}
        label={t('planned_timeline')}
      />

      <CustomAttributeDetailFields
        storyId={character.storyId}
        entityType="Character"
        entityId={characterId}
      />

      <DetailField
        label={t('is_favorite')}
        value={character.isFavorite ? t('common_yes') : t('common_no')}
      />
      <CommentableDetailField
        {...commentField('extraNotes', character.extraNotes || t('common_na'))}
        label={t('extra_notes')}
      />

      <ScreenSection title={t('media_section_title')} />
      <EntityGalleryManager
        ownerId={characterId}
        ownerType="Character"
        onPressMedia={openGalleryMediaViewer}
        editable={canEdit}
      />

      {statSystemEnabled ? (
        <>
          <ScreenSection title={t('stats_title')} />
          <CharacterStatPanel
            characterId={characterId}
            characterName={character.name}
            data={statData}
            notation={(selectedStory?.statNotation ?? 'letter') as StatNotation}
            onCompare={(modeId) =>
              navigation.navigate('CustomizationStack', {
                screen: 'StatComparison',
                params: { characterId, modeId: modeId ?? undefined },
              })
            }
          />
        </>
      ) : null}

      <ModeManager
        modes={characterModes}
        editable={false}
        onCreate={noopModeWrite}
        onUpdate={noopModeWrite}
        onDelete={noopModeWrite}
      />

      <CharacterRelationManager
        characterRelations={characterRelations}
        characters={allCharacters}
        onSave={handleSaveRelation}
        onDelete={handleDeleteRelation}
        editable={false}
        currentStoryId={character.storyId}
        currentCharacterId={characterId}
      />

      <CharacterSceneManager
        characterSceneRelations={characterSceneRelations}
        availableScenes={allScenes}
        onSave={handleSaveCharacterScene}
        onDelete={handleDeleteCharacterScene}
        currentStoryId={character.storyId}
        currentCharacterId={characterId}
        editable={false}
      />

      <ItemCharacterManager
        allItems={allItems}
        allItemJourneys={allItemJourneys}
        allScenes={allScenes}
        currentCharacterId={characterId}
      />

      <ScenePresenceList
        entries={characterLocationEntries}
        title={locationCopy.entities}
        noItemsMessage="no_locations_assigned_to_character"
        entityType="Location"
        sceneLabel={sceneCopy.entity}
      />

      <NoteManager
        noteRelations={characterNoteRelations}
        availableNotes={allNotes}
        onSave={saveNoteRelation}
        onDelete={deleteNoteRelation}
        editable={false}
        currentStoryId={character.storyId}
        currentEntityId={characterId}
        currentEntityType="Character"
      />

      <AppearsInArcsSection arcs={appearingArcs} />

      <SeeAlsoManager
        storyId={character.storyId}
        entityType="Character"
        entityId={characterId}
        editable={false}
      />

      <FavoritedByList storyId={character.storyId} entityId={characterId} entityType="Character" />

      <EntityMetadata
        version={character.version}
        createdAt={character.createdAt}
        updatedAt={character.updatedAt}
        entityType="Character"
        entityId={character.id}
      />
    </DetailContainer>
  );
};

export default CharacterDetailScreen;
