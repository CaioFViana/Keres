import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import MultiSelectPill, {
  SingleSelectPill,
} from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import SuggestionTextInput from '@/src/components/common/inputs/SuggestionTextInput/SuggestionTextInput';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import NoteManager from '@/src/components/features/notes/NoteManager';
import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import type { ItemJourney } from '@keres/shared/entities/Item';
import type { RouteProp } from '@react-navigation/native';
import { StackActions, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import type { ItemStackParamList } from '../../navigation/MainSystemStack';
import { createItemJourneyService } from '../../services/storymanagement/ItemJourneyService';
import { useCharacterStore } from '../../state/characterStore'; // Assuming CharacterStore for characters
import { useItemStore } from '../../state/itemStore'; // Assuming ItemStore for items
import { useSceneStore } from '../../state/sceneStore'; // Assuming SceneStore for scenes
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { useVocabularyEntityCopy } from '../../vocabulary/useVocabularyEntityCopy';
import { useStoryVocabulary } from '../../vocabulary/useStoryVocabulary';

type ItemJourneyFormScreenRouteProp = RouteProp<ItemStackParamList, 'ItemJourneyForm'>;
type ItemJourneyFormScreenNavigationProp = NativeStackNavigationProp<
  ItemStackParamList,
  'ItemJourneyForm'
>;

const ItemJourneyFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<ItemJourneyFormScreenNavigationProp>();
  const route = useRoute<ItemJourneyFormScreenRouteProp>();
  const { itemJourneyId: initialItemJourneyId, itemId: prefilledItemId } = route.params || {};
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
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();

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

  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();

  const confirmDelete = useConfirmDelete();

  const itemJourneyServiceRef = useRef<ReturnType<typeof createItemJourneyService> | null>(null);
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);

  useEffect(() => {
    if (drizzleDb && !itemJourneyServiceRef.current) {
      itemJourneyServiceRef.current = createItemJourneyService(drizzleDb);
    }
  }, [drizzleDb]);

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

  const [currentItemJourneyId, setCurrentItemJourneyId] = useState<string | undefined>(
    initialItemJourneyId,
  );
  // Pre-filled when the creation starts from an Item's screen (see ItemJourneyTimeline) - without
  // this the user would have to select by hand, again, the item they have just come from.
  const [itemId, setItemId] = useState<string | null>(prefilledItemId ?? null);
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [newCharacterOwnerId, setNewCharacterOwnerId] = useState<string | null>(null);
  const [newState, setNewState] = useState<string>('');
  const [extraNotes, setExtraNotes] = useState<string | null>(null);

  const {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    allNotes,
    noteRelations: itemJourneyNoteRelations,
    persistTagRelations,
    saveNoteRelation,
    deleteNoteRelation,
    persistNoteRelations,
  } = useEntityRelations({ entityType: 'ItemJourney', entityId: currentItemJourneyId });

  const [loading, setLoading] = useState(true);
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);

  const isEditing = !!currentItemJourneyId;
  const journey = itemCopy.itemJourney;
  const formTitle = t(isEditing ? 'vocabulary_edit_entity' : 'vocabulary_create_entity', {
    entity: journey,
  });

  useScreenHeader({
    target: 'parent',
    title: formTitle,
  });

  useEffect(() => {
    const loadItemJourney = async () => {
      if (!itemJourneyServiceRef.current || !selectedStory?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        if (isEditing) {
          const fetchedItemJourney = await itemJourneyServiceRef.current.getById(
            currentItemJourneyId!,
          );
          if (fetchedItemJourney) {
            setItemId(fetchedItemJourney.itemId);
            setSceneId(fetchedItemJourney.sceneId);
            setNewCharacterOwnerId(fetchedItemJourney.newCharacterOwnerId);
            setNewState(fetchedItemJourney.newState);
            setExtraNotes(fetchedItemJourney.extraNotes);
          } else {
            console.warn('Item journey not found:', currentItemJourneyId);
          }
        }
      } catch (err) {
        console.error('Failed to load item journey:', err);
      } finally {
        setLoading(false);
      }
    };
    loadItemJourney();
  }, [currentItemJourneyId, isEditing, selectedStory?.id, t]);

  const handleSave = () =>
    runSave(async () => {
      if (!itemId) {
        AppAlert.alert(t('error'), itemCopy.required);
        return;
      }
      if (!sceneId) {
        AppAlert.alert(t('error'), t('scene_required'));
        return;
      }
      if (!newState.trim()) {
        AppAlert.alert(t('error'), t('new_state_required'));
        return;
      }
      if (!userId || !selectedStory?.id) {
        AppAlert.alert(t('error'), t('user_not_identified'));
        return;
      }

      try {
        const itemJourneyData: Omit<
          ItemJourney,
          'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        > = {
          storyId: selectedStory.id,
          itemId: itemId!,
          sceneId: sceneId!,
          newCharacterOwnerId: newCharacterOwnerId,
          newState: newState.trim(),
          extraNotes: extraNotes,
        };

        let savedItemJourneyId: string | undefined = currentItemJourneyId;

        if (isEditing && currentItemJourneyId) {
          const savedItemJourney = await itemJourneyServiceRef.current!.updateItemJourney(
            userId,
            currentItemJourneyId,
            itemJourneyData,
          );
          savedItemJourneyId = savedItemJourney.id;
          AppAlert.alert(
            t('success'),
            t('vocabulary_entity_updated', { entity: journey, ending: 'a' }),
          );
        } else {
          const savedItemJourney = await itemJourneyServiceRef.current!.createItemJourney(
            userId,
            itemJourneyData,
          );
          savedItemJourneyId = savedItemJourney.id;
          setCurrentItemJourneyId(savedItemJourney.id);
          AppAlert.alert(
            t('success'),
            t('vocabulary_entity_created', { entity: journey, ending: 'a' }),
          );
        }

        if (savedItemJourneyId) {
          await persistTagRelations(savedItemJourneyId);
          await persistNoteRelations(savedItemJourneyId);
          await seeAlsoManagerRef.current?.persistPending(savedItemJourneyId);
        }
        entityEventEmitter.emit('item_journey_changed', selectedStory.id, savedItemJourneyId);

        if (!isEditing && savedItemJourneyId) {
          navigation.dispatch(
            StackActions.replace('ItemJourneyForm', { itemJourneyId: savedItemJourneyId }),
          );
        } else {
          navigation.goBack();
        }
      } catch (err) {
        console.error('Failed to save item journey:', err);
        AppAlert.alert(t('error'), t('vocabulary_failed_to_save_entity', { entity: journey }));
      }
    });

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!currentItemJourneyId || !itemJourneyServiceRef.current) {
      return;
    }

    confirmDelete({
      titleKey: 'delete_item_journey_title',
      title: t('vocabulary_delete_entity', { entity: journey }),
      messageKey: 'delete_item_journey_message',
      message: t('vocabulary_delete_entity_message', { entity: journey }),
      successMessage: t('vocabulary_entity_deleted', { entity: journey, ending: 'a' }),
      failureKey: 'failed_to_delete_item_journey',
      failureMessage: t('vocabulary_failed_to_delete_entity', { entity: journey }),
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await itemJourneyServiceRef.current!.deleteItemJourney(userId, currentItemJourneyId);
        entityEventEmitter.emit('item_journey_changed', selectedStory?.id, currentItemJourneyId);
        navigation.goBack();
      },
    });
  };

  const itemOptions = useMemo(
    () =>
      items.filter((item) => !item.isDeleted).map((item) => ({ label: item.name, value: item.id })),
    [items],
  );

  const sceneOptions = useMemo(
    () =>
      scenes
        .filter((scene) => !scene.isDeleted)
        .map((scene) => ({ label: scene.name, value: scene.id })),
    [scenes],
  );

  const characterOptions = useMemo(
    () =>
      characters
        .filter((char) => !char.isDeleted)
        .map((char) => ({ label: char.name, value: char.id })),
    [characters],
  );

  const styles = StyleSheet.create({
    noteSection: { marginTop: 20, marginBottom: 10 },
    tagSection: { marginTop: 20, marginBottom: 10 },
  });

  if (loading) {
    return <ScreenLoading />;
  }

  return (
    <EntityFormContainer
      title={formTitle}
      description={t('item_journey_form_description')}
      actions={
        <>
          <Button onPress={handleSave} disabled={saving || deleting}>
            {t('vocabulary_save_entity', { entity: journey })}
          </Button>
          {isEditing && (
            <Button
              onPress={handleDelete}
              style={{ backgroundColor: colors.error }}
              disabled={saving || deleting}
            >
              {t('vocabulary_delete_entity', { entity: journey })}
            </Button>
          )}
        </>
      }
    >
      <FormField label={itemCopy.entity}>
        <SingleSelectPill
          options={itemOptions}
          value={itemId}
          onValueChange={setItemId}
          placeholder={itemCopy.select}
          multiple={false}
          allowDeselect={true}
        />
      </FormField>

      <FormField label={sceneCopy.entity}>
        <SingleSelectPill
          options={sceneOptions}
          value={sceneId}
          onValueChange={setSceneId}
          placeholder={sceneCopy.select}
          multiple={false}
          allowDeselect={true}
        />
      </FormField>

      <FormField
        label={t('item_journey_new_character_owner_label', {
          character: characterTerm,
          ending: characterOwnerEnding,
          prefix: characterOwnerPrefix,
        })}
      >
        <SingleSelectPill
          options={characterOptions}
          value={newCharacterOwnerId}
          onValueChange={setNewCharacterOwnerId}
          placeholder={t('select_item_journey_new_character_owner', {
            character: characterTerm,
            ending: characterOwnerEnding,
            prefix: characterOwnerPrefix,
          })}
          multiple={false}
          allowDeselect={true}
        />
      </FormField>

      <FormField label={t('new_state')}>
        <SuggestionTextInput
          placeholder={t('new_state_placeholder')}
          value={newState || ''}
          onChangeText={setNewState}
          type="item_state"
          storyId={selectedStory?.id || ''}
        />
      </FormField>

      <FormField label={t('extra_notes')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('extra_notes_placeholder')}
            value={extraNotes || ''}
            onChangeText={setExtraNotes}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>

      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <ScreenSection title={t('tags_title')} />
          <MultiSelectPill
            options={availableTags.map((tag) => ({
              label: tag.name,
              value: tag.id,
              color: tag.color || colors.primaryContainer,
            }))}
            selectedValues={selectedTagIds}
            onSelectionChange={setSelectedTagIds}
            placeholder={t('select_tags_for_item_journey')}
            label={t('item_journey_tags')}
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <ScreenSection title={t('notes_title')} />
          <NoteManager
            noteRelations={itemJourneyNoteRelations}
            availableNotes={allNotes}
            onSave={saveNoteRelation}
            onDelete={deleteNoteRelation}
            editable={true}
            currentStoryId={selectedStory.id}
            currentEntityId={currentItemJourneyId ?? ''}
            currentEntityType="ItemJourney"
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <SeeAlsoManager
            ref={seeAlsoManagerRef}
            storyId={selectedStory.id}
            entityType="ItemJourney"
            entityId={currentItemJourneyId ?? ''}
            editable={true}
          />
        </View>
      )}
    </EntityFormContainer>
  );
};

export default ItemJourneyFormScreen;
