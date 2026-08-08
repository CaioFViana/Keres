import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import Select from '@/src/components/common/inputs/Select/Select';
import SuggestionTextInput from '@/src/components/common/inputs/SuggestionTextInput/SuggestionTextInput';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { ItemJourney } from '@keres/shared/entities/Item';
import { RouteProp, StackActions, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import NoteManager from '@/src/components/features/notes/NoteManager';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { ItemJourneyStackParamList } from '../../navigation/MainSystemStack';
import { createItemJourneyService } from '../../services/storymanagement/ItemJourneyService';
import { useCharacterStore } from '../../state/characterStore'; // Assuming CharacterStore for characters
import { useItemStore } from '../../state/itemStore'; // Assuming ItemStore for items
import { useSceneStore } from '../../state/sceneStore'; // Assuming SceneStore for scenes
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { setDocumentTitle } from '../../utils/documentTitle';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { AppAlert } from '../../utils/AppAlert';

type ItemJourneyFormScreenRouteProp = RouteProp<ItemJourneyStackParamList, 'ItemJourneyForm'>;
type ItemJourneyFormScreenNavigationProp = NativeStackNavigationProp<ItemJourneyStackParamList, 'ItemJourneyForm'>;

const ItemJourneyFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<ItemJourneyFormScreenNavigationProp>();
  const route = useRoute<ItemJourneyFormScreenRouteProp>();
  const { itemJourneyId: initialItemJourneyId, itemId: prefilledItemId } = route.params || {};
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();

  const { items, fetchItems, setDbAndStoryId: setItemDbAndStoryId, initializeService: initializeItemService } = useItemStore();
  const { scenes, fetchScenes, setDbAndStoryId: setSceneDbAndStoryId, initializeService: initializeSceneService } = useSceneStore();
  const { characters, fetchCharacters, setDbAndStoryId: setCharacterDbAndStoryId, initializeService: initializeCharacterService } = useCharacterStore();

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();

  const confirmDelete = useConfirmDelete();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const itemJourneyServiceRef = useRef<ReturnType<typeof createItemJourneyService> | null>(null);

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
  }, [drizzleDb, selectedStory?.id,
    setItemDbAndStoryId, initializeItemService, fetchItems,
    setSceneDbAndStoryId, initializeSceneService, fetchScenes,
    setCharacterDbAndStoryId, initializeCharacterService, fetchCharacters
  ]);


  const [currentItemJourneyId, setCurrentItemJourneyId] = useState<string | undefined>(initialItemJourneyId);
  // Pré-preenchido quando a criação parte da tela de um Item (ver ItemJourneyTimeline) - sem
  // isso o usuário teria que selecionar de novo, na mão, o item de onde ele acabou de vir.
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
  } = useEntityRelations({ entityType: 'ItemJourney', entityId: currentItemJourneyId });

  const [loading, setLoading] = useState(true);

  const isEditing = !!currentItemJourneyId;

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(isEditing ? t('edit_item_journey_title') : t('create_item_journey_title'));
      navigation.getParent()?.setOptions({
        title: isEditing ? t('edit_item_journey_title') : t('create_item_journey_title'),
        headerRight: () => <View />,
      });
    }, [navigation, isEditing, t])
  );

  useEffect(() => {
    const loadItemJourney = async () => {
      if (!itemJourneyServiceRef.current || !selectedStory?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        if (isEditing) {
          const fetchedItemJourney = await itemJourneyServiceRef.current.getById(currentItemJourneyId!);
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

  const handleSave = async () => {
    if (!itemId) {
      AppAlert.alert(t('error'), t('item_required'));
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

    setLoading(true);

    try {
      const itemJourneyData: Omit<ItemJourney, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'> = {
        storyId: selectedStory.id,
        itemId: itemId!,
        sceneId: sceneId!,
        newCharacterOwnerId: newCharacterOwnerId,
        newState: newState.trim(),
        extraNotes: extraNotes
      };

      let savedItemJourneyId: string | undefined = currentItemJourneyId;

      if (isEditing && currentItemJourneyId) {
        const savedItemJourney = await itemJourneyServiceRef.current!.updateItemJourney(userId, currentItemJourneyId, itemJourneyData);
        savedItemJourneyId = savedItemJourney.id;
        AppAlert.alert(t('success'), t('item_journey_updated_successfully'));
      } else {
        const savedItemJourney = await itemJourneyServiceRef.current!.createItemJourney(userId, itemJourneyData);
        savedItemJourneyId = savedItemJourney.id;
        setCurrentItemJourneyId(savedItemJourney.id);
        AppAlert.alert(t('success'), t('item_journey_created_successfully'));
      }

      if (savedItemJourneyId) {
        await persistTagRelations(savedItemJourneyId);
      }
      entityEventEmitter.emit('item_journey_changed', selectedStory.id, savedItemJourneyId);

      if (!isEditing && savedItemJourneyId) {
        navigation.dispatch(StackActions.replace('ItemJourneyForm', { itemJourneyId: savedItemJourneyId }));
      } else {
        navigation.goBack();
      }
    } catch (err) {
      console.error('Failed to save item journey:', err);
      AppAlert.alert(t('error'), t('failed_to_save_item_journey'));
    } finally {
      setLoading(false);
    }
  };

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
      messageKey: 'delete_item_journey_message',
      successKey: 'item_journey_deleted_successfully',
      failureKey: 'failed_to_delete_item_journey',
      onLoadingChange: setLoading,
      onConfirm: async () => {
        await itemJourneyServiceRef.current!.deleteItemJourney(userId, currentItemJourneyId);
        entityEventEmitter.emit('item_journey_changed', selectedStory?.id, currentItemJourneyId);
        navigation.goBack();
      },
    });
  };

  const itemOptions = useMemo(() =>
    items
      .filter(item => !item.isDeleted)
      .map(item => ({ label: item.name, value: item.id })),
    [items]
  );

  const sceneOptions = useMemo(() =>
    scenes
      .filter(scene => !scene.isDeleted)
      .map(scene => ({ label: scene.name, value: scene.id })),
    [scenes]
  );

  const characterOptions = useMemo(() =>
    characters
      .filter(char => !char.isDeleted)
      .map(char => ({ label: char.name, value: char.id })),
    [characters]
  );

  const styles = StyleSheet.create({
    scrollViewContent: { padding: 20, paddingBottom: scrollBottomPadding, flexGrow: 1 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
    label: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
    switchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15, marginBottom: 5 },
    saveButton: { marginTop: 20, marginBottom: 0 },
    deleteButton: { backgroundColor: 'red', marginBottom: 15 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    noteSection: { marginTop: 20, marginBottom: 10 },
    tagSection: { marginTop: 20, marginBottom: 10 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 10 },
  });

  if (loading) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={{ color: colors.text }}>{t('loading')}...</Text>
      </View>
    );
  }

  return (
      <KeyboardAwareScreen style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
          <Text style={[styles.title, { color: colors.text }]}>{isEditing ? t('edit_item_journey_title') : t('create_item_journey_title')}</Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>{t('item_journey_form_description')}</Text>

          <Text style={[styles.label, { color: colors.text }]}>{t('item')}</Text>
          <Select
            options={itemOptions}
            value={itemId}
            onValueChange={setItemId}
            placeholder={t('select_item')}
            multiple={false}
            allowDeselect={true}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('scene')}</Text>
          <Select
            options={sceneOptions}
            value={sceneId}
            onValueChange={setSceneId}
            placeholder={t('select_scene')}
            multiple={false}
            allowDeselect={true}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('new_character_owner')}</Text>
          <Select
            options={characterOptions}
            value={newCharacterOwnerId}
            onValueChange={setNewCharacterOwnerId}
            placeholder={t('select_new_character_owner')}
            multiple={false}
            allowDeselect={true}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('new_state')}</Text>
          <SuggestionTextInput
            placeholder={t('new_state_placeholder')}
            value={newState || ''}
            onChangeText={setNewState}
            type="item_state"
            style={commonInputStyles.input}
            storyId={selectedStory?.id || ''}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('extra_notes')}</Text>
          <TextInput
            placeholder={t('extra_notes_placeholder')}
            value={extraNotes || ''}
            onChangeText={setExtraNotes}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          {currentItemJourneyId && selectedStory?.id && (
            <View style={styles.tagSection}>
              <Text style={styles.sectionTitle}>{t('tags_title')}</Text>
              <MultiSelectPill
                options={availableTags.map(tag => ({ label: tag.name, value: tag.id, color: tag.color || colors.primaryContainer }))}
                selectedValues={selectedTagIds}
                onSelectionChange={setSelectedTagIds}
                placeholder={t('select_tags_for_item_journey')}
                label={t('item_journey_tags')}
              />
            </View>
          )}

          {currentItemJourneyId && selectedStory?.id && (
            <View style={styles.noteSection}>
              <Text style={styles.sectionTitle}>{t('notes_title')}</Text>
              <NoteManager
                noteRelations={itemJourneyNoteRelations}
                availableNotes={allNotes}
                onSave={saveNoteRelation}
                onDelete={deleteNoteRelation}
                editable={true}
                currentStoryId={selectedStory.id}
                currentEntityId={currentItemJourneyId}
                currentEntityType="ItemJourney"
              />
            </View>
          )}

          <Button onPress={handleSave} style={styles.saveButton}>{t('save_item_journey')}</Button>
          {isEditing && (<Button onPress={handleDelete} style={[styles.saveButton, styles.deleteButton]}>{t('delete_item_journey_title')}</Button>)}
      </KeyboardAwareScreen>
  );
};

export default ItemJourneyFormScreen;
