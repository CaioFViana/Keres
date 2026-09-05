import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import FormSwitchField from '@/src/components/common/forms/FormSwitchField/FormSwitchField';
import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import CustomAttributeFields, {
  getDefaultCustomAttributeValues,
  validateRequiredCustomAttributes,
} from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import SuggestionTextInput from '@/src/components/common/inputs/SuggestionTextInput/SuggestionTextInput';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import NoteManager from '@/src/components/features/notes/NoteManager'; // Import NoteManager
import CharacterRelationManager from '@/src/components/features/relations/CharacterRelationManager/CharacterRelationManager'; // Import CharacterRelationManager
import { CharacterStatValuesEditor } from '@/src/components/features/stats/CharacterStatValuesEditor/CharacterStatValuesEditor';
import { ModeManager } from '@/src/components/features/stats/ModeManager/ModeManager';
import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import type { Character } from '@keres/shared/entities/Character';
import type { CharacterRelation } from '@keres/shared/entities/CharacterRelation'; // Import CharacterRelation
import type { RouteProp } from '@react-navigation/native';
import { StackActions, useNavigation, useRoute } from '@react-navigation/native'; // Import StackActions
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useDrizzle } from '../../db';
import type { CharacterSelect } from '../../db/schemas/characters'; // Import CharacterSelect for character objects
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useStorySchemaFields } from '../../hooks/useStorySchemaFields';
import type { CharacterStackParamList } from '../../navigation/MainSystemStack';
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import type { CharacterRelationServiceInterface } from '../../services/storymanagement/CharacterRelationService';
import { createCharacterRelationService } from '../../services/storymanagement/CharacterRelationService'; // Import CharacterRelationService
import { createCharacterService } from '../../services/storymanagement/CharacterService';
import { useStoryStats } from '../../hooks/useStoryStats';
import { createModeService } from '../../services/storymanagement/ModeService';
import { createStatRelationService } from '../../services/storymanagement/StatRelationService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { entityEventEmitter } from '../../utils/EventEmitter'; // Import EventEmitter
import { useVocabularyEntityCopy } from '../../vocabulary/useVocabularyEntityCopy';

type CharacterFormScreenRouteProp = RouteProp<CharacterStackParamList, 'CharacterForm'>;
type CharacterFormScreenNavigationProp = NativeStackNavigationProp<
  CharacterStackParamList,
  'CharacterForm'
>; // Corrected type alias

const CharacterFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<CharacterFormScreenNavigationProp>(); // Use the specific navigation type
  const route = useRoute<CharacterFormScreenRouteProp>();
  const { characterId: initialCharacterId } = route.params || {}; // Renamed to initialCharacterId
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Character');
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();

  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();

  const confirmDelete = useConfirmDelete();

  const characterServiceRef = useRef<ReturnType<typeof createCharacterService> | null>(null);
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);
  const characterRelationServiceRef = useRef<CharacterRelationServiceInterface | null>(null); // Ref for CharacterRelationService

  // Initialize services once when drizzleDb is available
  useEffect(() => {
    if (drizzleDb) {
      if (!characterServiceRef.current) {
        characterServiceRef.current = createCharacterService(drizzleDb);
      }
      if (!characterRelationServiceRef.current) {
        characterRelationServiceRef.current = createCharacterRelationService(drizzleDb);
      }
    }
  }, [drizzleDb]);

  const [currentCharacterId, setCurrentCharacterId] = useState<string | undefined>(
    initialCharacterId,
  ); // State to manage characterId
  const [name, setName] = useState('');
  const [title, setTitle] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [race, setRace] = useState<string | null>(null);
  const [subrace, setSubrace] = useState<string | null>(null);
  const [personality, setPersonality] = useState<string | null>(null);
  const [motivation, setMotivation] = useState<string | null>(null);
  const [qualities, setQualities] = useState<string | null>(null);
  const [weaknesses, setWeaknesses] = useState<string | null>(null);
  const [biography, setBiography] = useState<string | null>(null);
  const [plannedTimeline, setPlannedTimeline] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);

  const [allCharacters, setAllCharacters] = useState<CharacterSelect[]>([]); // To pass to CharacterRelationManager
  // Modes and stat values only exist once the character has an id, so the two blocks below appear only
  // when editing - creating with modes already in place would require a pending queue like the relations'
  // one, with no gain: the author has only just named the character.
  const statData = useStoryStats(selectedStory?.id);
  const characterModes = useMemo(
    () => statData.modes.filter((mode) => mode.characterId === currentCharacterId),
    [statData.modes, currentCharacterId],
  );
  const modeService = useCallback(() => createModeService(drizzleDb), [drizzleDb]);
  const statRelationService = useCallback(() => createStatRelationService(drizzleDb), [drizzleDb]);
  const [characterRelations, setCharacterRelations] = useState<CharacterRelation[]>([]); // State for relations
  // While `currentCharacterId` is undefined (creating), it is held here - there is no real id yet to save
  // the relation against. Replayed in `persistPendingCharacterRelations` after the main save.
  const [pendingCharacterRelations, setPendingCharacterRelations] = useState<CharacterRelation[]>(
    [],
  );

  const customFields = useStorySchemaFields(selectedStory?.id, 'Character');
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const customDefaultsAppliedRef = useRef(false);

  const {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    allNotes,
    noteRelations: characterNoteRelations,
    persistTagRelations,
    saveNoteRelation,
    deleteNoteRelation,
    persistNoteRelations,
  } = useEntityRelations({ entityType: 'Character', entityId: currentCharacterId });

  const [loading, setLoading] = useState(true);
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);

  const isEditing = !!currentCharacterId;
  const formTitle = isEditing ? copy.editTitle : copy.createTitle;

  useScreenHeader({
    target: 'parent',
    title: formTitle,
  });

  const fetchAllCharactersInStory = useCallback(async () => {
    if (!characterServiceRef.current || !selectedStory?.id) {
      setAllCharacters([]);
      return;
    }
    try {
      const fetchedCharacters = await characterServiceRef.current.getAllByStoryId(selectedStory.id);
      setAllCharacters(fetchedCharacters.filter((c) => !c.isDeleted)); // Filter out deleted characters
    } catch (err) {
      console.error('Failed to fetch all characters:', err);
    }
  }, [selectedStory?.id]);

  const fetchRelationsForCharacter = useCallback(async () => {
    if (!characterRelationServiceRef.current || !selectedStory?.id || !currentCharacterId) {
      setCharacterRelations([]);
      return;
    }
    try {
      const fetchedRelations = await characterRelationServiceRef.current.getRelationsForCharacter(
        selectedStory.id,
        currentCharacterId,
      );
      setCharacterRelations(fetchedRelations);
    } catch (err) {
      console.error('Failed to fetch character relations:', err);
    }
  }, [selectedStory?.id, currentCharacterId]);

  useEffect(() => {
    const loadCharacterAndData = async () => {
      if (!characterServiceRef.current || !selectedStory?.id) {
        console.warn('Character service or selected story not available.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (isEditing) {
          const fetchedCharacter = await characterServiceRef.current.getById(currentCharacterId!);
          if (fetchedCharacter) {
            setName(fetchedCharacter.name);
            setTitle(fetchedCharacter.title);
            setDescription(fetchedCharacter.description);
            setGender(fetchedCharacter.gender);
            setRace(fetchedCharacter.race);
            setSubrace(fetchedCharacter.subrace);
            setPersonality(fetchedCharacter.personality);
            setMotivation(fetchedCharacter.motivation);
            setQualities(fetchedCharacter.qualities);
            setWeaknesses(fetchedCharacter.weaknesses);
            setBiography(fetchedCharacter.biography);
            setPlannedTimeline(fetchedCharacter.plannedTimeline);
            setIsFavorite(fetchedCharacter.isFavorite);
            setExtraNotes(fetchedCharacter.extraNotes);

            const existingValues = await createAttributeValueService(drizzleDb).getValuesForEntity(
              currentCharacterId!,
            );
            setCustomValues(Object.fromEntries(existingValues.map((v) => [v.fieldId, v.value])));
          } else {
            console.warn('Character not found:', currentCharacterId);
          }
        }
      } catch (err) {
        console.error('Failed to load character:', err);
      } finally {
        setLoading(false);
        fetchAllCharactersInStory();
        fetchRelationsForCharacter();
      }
    };
    loadCharacterAndData();
  }, [
    currentCharacterId,
    drizzleDb,
    isEditing,
    selectedStory?.id,
    t,
    fetchAllCharactersInStory,
    fetchRelationsForCharacter,
  ]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  const handleSave = () =>
    runSave(async () => {
      if (!name.trim()) {
        AppAlert.alert(t('error'), t('name_required'));
        return;
      }
      const missingRequiredField = validateRequiredCustomAttributes(customFields, customValues);
      if (missingRequiredField) {
        AppAlert.alert(t('error'), t('custom_attribute_required', { field: missingRequiredField }));
        return;
      }
      if (!userId) {
        AppAlert.alert(t('error'), t('user_not_identified'));
        return;
      }
      if (!selectedStory?.id) {
        AppAlert.alert(t('error'), t('no_story_selected'));
        return;
      }

      try {
        const characterData: Omit<
          Character,
          'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        > = {
          name: name.trim(),
          title: title ? title.trim() : null,
          description,
          gender,
          race,
          subrace,
          personality,
          motivation,
          qualities,
          weaknesses,
          biography,
          plannedTimeline,
          isFavorite,
          extraNotes,
        };

        let savedCharacter: Character;

        if (isEditing) {
          savedCharacter = await characterServiceRef.current!.updateCharacter(
            userId,
            currentCharacterId!,
            characterData,
          );
          AppAlert.alert(t('success'), copy.updated);
        } else {
          savedCharacter = await characterServiceRef.current!.createCharacter(userId, {
            ...characterData,
            storyId: selectedStory.id,
          });
          AppAlert.alert(t('success'), copy.created);
          setCurrentCharacterId(savedCharacter.id); // Set the ID for the newly created character
        }

        if (savedCharacter.id) {
          await persistTagRelations(savedCharacter.id);
          await persistNoteRelations(savedCharacter.id);
          await seeAlsoManagerRef.current?.persistPending(savedCharacter.id);
          await persistPendingCharacterRelations(savedCharacter.id);
          await createAttributeValueService(drizzleDb).saveValuesForEntity(
            userId,
            selectedStory.id,
            'Character',
            savedCharacter.id,
            customValues,
          );
        }

        entityEventEmitter.emit('character_changed', selectedStory.id, savedCharacter.id); // Emit change event

        // After saving character, if it's a new character, relations can now be added
        // Or if it was an edit, relations data might need a refresh.
        if (!isEditing && savedCharacter.id) {
          // If it was a new character, relations section will become editable now
          // A full reload or navigate might be better here to ensure all states are correct
          navigation.dispatch(
            StackActions.replace('CharacterForm', { characterId: savedCharacter.id }),
          ); // Fixed navigation.replace
        } else {
          navigation.goBack();
        }
      } catch (err) {
        console.error('Failed to save character:', err);
        AppAlert.alert(t('error'), copy.failedToSave);
      }
    });

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }

    if (!currentCharacterId || !characterServiceRef.current) {
      return;
    }

    confirmDelete({
      titleKey: 'delete_character_title',
      title: copy.deleteLabel,
      messageKey: 'delete_character_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_character',
      failureMessage: copy.failedToDelete,
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await characterServiceRef.current!.deleteCharacter(userId, currentCharacterId);
        entityEventEmitter.emit('character_changed', selectedStory?.id, currentCharacterId);
        navigation.goBack();
      },
    });
  };

  const handleTagSelectionChange = useCallback(
    (newSelection: string[]) => {
      setSelectedTagIds(newSelection);
    },
    [setSelectedTagIds],
  );

  const handleSaveRelation = async (relation: CharacterRelation) => {
    if (!currentCharacterId) {
      setPendingCharacterRelations((prev) => {
        const existingIndex = prev.findIndex((r) => r.id === relation.id);
        return existingIndex > -1
          ? prev.map((r, index) => (index === existingIndex ? relation : r))
          : [...prev, relation];
      });
      AppAlert.alert(t('success'), t('relation_saved_successfully'));
      return;
    }
    if (!characterRelationServiceRef.current || !selectedStory?.id || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const savedRelation = await characterRelationServiceRef.current.saveCharacterRelation(
        userId,
        relation,
      );
      setCharacterRelations((prev) => {
        const existingIndex = prev.findIndex((r) => r.id === savedRelation.id);
        if (existingIndex > -1) {
          return prev.map((r, index) => (index === existingIndex ? savedRelation : r));
        } else {
          return [...prev, savedRelation];
        }
      });
      entityEventEmitter.emit('character_relation_changed', selectedStory.id, currentCharacterId);
      AppAlert.alert(t('success'), t('relation_saved_successfully'));
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_save_relation'));
      console.error('Failed to save character relation:', error);
    }
  };

  const handleDeleteRelation = async (relationId: string) => {
    if (!currentCharacterId) {
      setPendingCharacterRelations((prev) => prev.filter((r) => r.id !== relationId));
      AppAlert.alert(t('success'), t('relation_deleted_successfully'));
      return;
    }
    if (!characterRelationServiceRef.current || !selectedStory?.id || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await characterRelationServiceRef.current.deleteCharacterRelation(
        userId,
        relationId,
      );
      if (success) {
        setCharacterRelations((prev) => prev.filter((r) => r.id !== relationId));
        entityEventEmitter.emit('character_relation_changed', selectedStory.id, currentCharacterId);
        AppAlert.alert(t('success'), t('relation_deleted_successfully'));
      } else {
        AppAlert.alert(t('error'), t('failed_to_delete_relation'));
      }
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_delete_relation'));
      console.error('Failed to delete character relation:', error);
    }
  };

  /**
   * Actually saves the relations accumulated while the character did not exist yet -
   * `character1Id`/`character2Id` held '' in place of the id (the form's placeholder, see
   * `CharacterRelationManager`); it swaps in the real id here.
   */
  const persistPendingCharacterRelations = async (targetCharacterId: string) => {
    if (!characterRelationServiceRef.current || !selectedStory?.id || !userId) return;
    for (const pending of pendingCharacterRelations) {
      await characterRelationServiceRef.current.saveCharacterRelation(userId, {
        ...pending,
        character1Id: pending.character1Id === '' ? targetCharacterId : pending.character1Id,
        character2Id: pending.character2Id === '' ? targetCharacterId : pending.character2Id,
      });
    }
    setPendingCharacterRelations([]);
    if (pendingCharacterRelations.length > 0) {
      entityEventEmitter.emit('character_relation_changed', selectedStory.id, targetCharacterId);
    }
  };

  const styles = StyleSheet.create({
    noteSection: {
      // Renamed from tagSection for clarity.
      marginTop: 20,
      marginBottom: -10,
    },
    tagSection: {
      marginTop: 20,
      marginBottom: 0,
    },
  });

  if (loading) {
    return <ScreenLoading />;
  }

  return (
    <EntityFormContainer
      title={formTitle}
      description={copy.formDescription}
      actions={
        <>
          <Button onPress={handleSave} disabled={saving || deleting}>
            {copy.saveLabel}
          </Button>
          {isEditing && (
            <Button
              onPress={handleDelete}
              style={{ backgroundColor: colors.error }}
              disabled={saving || deleting}
            >
              {copy.deleteLabel}
            </Button>
          )}
        </>
      }
    >
      <FormField label={t('name')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('name_placeholder')}
            value={name}
            onChangeText={setName}
            style={commonInputStyles.input}
          />
        )}
      </FormField>

      <FormField label={t('title')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('character_title_placeholder')}
            value={title || ''}
            onChangeText={setTitle}
            style={commonInputStyles.input}
          />
        )}
      </FormField>

      <FormField label={t('description')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('description_placeholder')}
            value={description || ''}
            onChangeText={setDescription}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>

      <FormField label={t('gender')}>
        <SuggestionTextInput
          placeholder={t('gender_placeholder')}
          value={gender || ''}
          onChangeText={setGender}
          type="character_gender"
          storyId={selectedStory?.id || ''}
        />
      </FormField>

      <FormField label={t('race')}>
        <SuggestionTextInput
          placeholder={t('race_placeholder')}
          value={race || ''}
          onChangeText={setRace}
          type="character_race"
          storyId={selectedStory?.id || ''}
        />
      </FormField>

      <FormField label={t('subrace')}>
        <SuggestionTextInput
          placeholder={t('subrace_placeholder')}
          value={subrace || ''}
          onChangeText={setSubrace}
          type="character_subrace"
          storyId={selectedStory?.id || ''}
        />
      </FormField>

      <FormField label={t('personality')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('personality_placeholder')}
            value={personality || ''}
            onChangeText={setPersonality}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>

      <FormField label={t('motivation')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('motivation_placeholder')}
            value={motivation || ''}
            onChangeText={setMotivation}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>

      <FormField label={t('qualities')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('qualities_placeholder')}
            value={qualities || ''}
            onChangeText={setQualities}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>

      <FormField label={t('weaknesses')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('weaknesses_placeholder')}
            value={weaknesses || ''}
            onChangeText={setWeaknesses}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>

      <FormField label={t('biography')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('biography_placeholder')}
            value={biography || ''}
            onChangeText={setBiography}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>

      <FormField label={t('planned_timeline')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('planned_timeline_placeholder')}
            value={plannedTimeline || ''}
            onChangeText={setPlannedTimeline}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>

      <FormSwitchField label={t('is_favorite')} value={isFavorite} onValueChange={setIsFavorite} />

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

      <CustomAttributeFields
        storyId={selectedStory?.id || ''}
        fields={customFields}
        values={customValues}
        onChange={(fieldId, value) => setCustomValues((prev) => ({ ...prev, [fieldId]: value }))}
      />

      <View style={styles.tagSection}>
        <MultiSelectPill
          options={availableTags.map((tag) => ({
            label: tag.name,
            value: tag.id,
            color: tag.color || colors.primaryContainer,
          }))}
          selectedValues={selectedTagIds}
          onSelectionChange={handleTagSelectionChange}
          placeholder={t('select_tags_for_character')}
          label={t('character_tags')}
        />
      </View>

      {selectedStory?.id && currentCharacterId && (
        <View style={styles.noteSection}>
          <ModeManager
            modes={characterModes}
            editable
            onCreate={async (mode) => {
              await modeService().createMode(userId!, {
                storyId: selectedStory.id,
                characterId: currentCharacterId,
                ...mode,
                // The highest + 1: counting would repeat an existing mode's number after a deletion in the middle of
                // the list.
                order: Math.max(0, ...characterModes.map((existing) => existing.order + 1)),
              });
            }}
            onUpdate={(modeId, mode) => modeService().updateMode(userId!, modeId, mode)}
            onDelete={(modeId) => modeService().deleteMode(userId!, modeId)}
          />
        </View>
      )}

      {selectedStory?.id && currentCharacterId && selectedStory.statSystem && (
        <View style={styles.noteSection}>
          <CharacterStatValuesEditor
            characterId={currentCharacterId}
            data={statData}
            editable
            onSetValue={({ modeId, statId, value }) =>
              statRelationService().setValue(userId!, {
                storyId: selectedStory.id,
                characterId: currentCharacterId,
                modeId,
                statId,
                value,
              })
            }
            onClearValue={({ modeId, statId }) =>
              statRelationService().clearValue(userId!, {
                characterId: currentCharacterId,
                modeId,
                statId,
              })
            }
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <CharacterRelationManager
            characterRelations={currentCharacterId ? characterRelations : pendingCharacterRelations}
            characters={allCharacters}
            onSave={handleSaveRelation}
            onDelete={handleDeleteRelation}
            editable={true} // Editable in form screen
            currentStoryId={selectedStory.id}
            currentCharacterId={currentCharacterId ?? ''}
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <NoteManager
            noteRelations={characterNoteRelations}
            availableNotes={allNotes}
            onSave={saveNoteRelation}
            onDelete={deleteNoteRelation}
            editable={true}
            currentStoryId={selectedStory.id}
            currentEntityId={currentCharacterId ?? ''}
            currentEntityType="Character"
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <SeeAlsoManager
            ref={seeAlsoManagerRef}
            storyId={selectedStory.id}
            entityType="Character"
            entityId={currentCharacterId ?? ''}
            editable={true}
          />
        </View>
      )}
    </EntityFormContainer>
  );
};

export default CharacterFormScreen;
