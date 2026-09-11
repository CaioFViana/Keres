import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { useEntityFormSecondaryDraft } from '../../hooks/useEntityFormSecondaryDraft';
import { useStorySchemaFields } from '../../hooks/useStorySchemaFields';
import type { CharacterStackParamList } from '../../navigation/MainSystemStack';
import { readEntityFormSecondaryDraft } from '../../services/storymanagement/EntityFormSecondaryDraftStore';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { useVocabularyEntityCopy } from '../../vocabulary/useVocabularyEntityCopy';
import { CharacterFormContent } from './CharacterFormContent';
import { useCharacterFormActions } from './useCharacterFormActions';
import { useCharacterFormAssociations } from './useCharacterFormAssociations';
import { useCharacterFormResources } from './useCharacterFormResources';
import { useCharacterFormState } from './useCharacterFormState';

type CharacterFormScreenRouteProp = RouteProp<CharacterStackParamList, 'CharacterForm'>;
type CharacterFormScreenNavigationProp = NativeStackNavigationProp<
  CharacterStackParamList,
  'CharacterForm'
>;

const styles = StyleSheet.create({
  noteSection: {
    marginTop: 20,
    marginBottom: -10,
  },
  tagSection: {
    marginTop: 20,
    marginBottom: 0,
  },
});

const CharacterFormScreen = () => {
  // Registers the nested-stack back action for the Drawer header (and hardware back).
  // Without this, Detail's action is cleared on blur and the form has nothing to pop with.
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<CharacterFormScreenNavigationProp>();
  const route = useRoute<CharacterFormScreenRouteProp>();
  const { characterId: initialCharacterId } = route.params || {};
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Character');
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const draftNoticeShownRef = useRef(false);
  const commonInputStyles = getCommonInputStyles(colors);
  const customFields = useStorySchemaFields(selectedStory?.id, 'Character');

  const { drizzleDb, characterServiceRef, characterRelationServiceRef } =
    useCharacterFormResources();

  const characterFormState = useCharacterFormState({
    initialCharacterId,
    storyId: selectedStory?.id,
    drizzleDb,
    characterServiceRef,
    customFields,
  });
  const {
    currentCharacterId,
    name,
    setName,
    title,
    setTitle,
    description,
    setDescription,
    gender,
    setGender,
    race,
    setRace,
    subrace,
    setSubrace,
    personality,
    setPersonality,
    motivation,
    setMotivation,
    qualities,
    setQualities,
    weaknesses,
    setWeaknesses,
    biography,
    setBiography,
    plannedTimeline,
    setPlannedTimeline,
    isFavorite,
    setIsFavorite,
    extraNotes,
    setExtraNotes,
    customValues,
    setCustomValues,
    loading,
    isEditing,
  } = characterFormState;

  const {
    availableTags,
    selectedTagIds,
    allNotes,
    characterNoteRelations,
    pendingNoteRelations,
    persistTagRelations,
    saveNoteRelation,
    deleteNoteRelation,
    persistNoteRelations,
    handleTagSelectionChange,
    allCharacters,
    characterRelations,
    pendingCharacterRelations,
    handleSaveRelation,
    handleDeleteRelation,
    persistPendingCharacterRelations,
    statData,
    characterModes,
    modeService,
    statRelationService,
  } = useCharacterFormAssociations({
    initialCharacterId,
    currentCharacterId,
    storyId: selectedStory?.id,
    userId,
    drizzleDb,
    characterServiceRef,
    characterRelationServiceRef,
  });

  useEffect(() => {
    if (!selectedStory?.id || !initialCharacterId || draftNoticeShownRef.current) return;
    void readEntityFormSecondaryDraft(selectedStory.id, 'Character', initialCharacterId).then(
      (draft) => {
        if (!draft) return;
        const hasDraft =
          draft.selectedTagIds.length > 0 ||
          draft.pendingNoteRelations.length > 0 ||
          draft.pendingEntityRelations.length > 0 ||
          Object.keys(draft.customValues).length > 0;
        if (!hasDraft) return;
        draftNoticeShownRef.current = true;
        showNotification(t('entity_secondary_draft_restored'), 'info');
      },
    );
  }, [initialCharacterId, selectedStory?.id, showNotification, t]);

  const getCustomValues = useCallback(
    () => characterFormState.customValues,
    [characterFormState.customValues],
  );
  const getPendingEntityRelations = useCallback(
    () => pendingCharacterRelations,
    [pendingCharacterRelations],
  );
  const { persistSecondaryDraft, clearSecondaryDraft } = useEntityFormSecondaryDraft({
    storyId: selectedStory?.id,
    entityType: 'Character',
    selectedTagIds,
    pendingNoteRelations,
    getCustomValues,
    getPendingEntityRelations,
  });
  const { deleting, handleDelete, handleSave, saving, seeAlsoManagerRef } = useCharacterFormActions(
    {
      state: characterFormState,
      customFields,
      drizzleDb,
      characterServiceRef,
      navigation,
      storyId: selectedStory?.id,
      userId,
      persistTagRelations,
      persistNoteRelations,
      persistPendingCharacterRelations,
      persistSecondaryDraft,
      clearSecondaryDraft,
    },
  );

  const formTitle = isEditing ? copy.editTitle : copy.createTitle;

  useScreenHeader({
    target: 'parent',
    title: formTitle,
  });

  if (loading) {
    return <ScreenLoading />;
  }

  return (
    <CharacterFormContent
      formTitle={formTitle}
      formDescription={copy.formDescription}
      copy={copy}
      handleSave={handleSave}
      saving={saving}
      deleting={deleting}
      isEditing={isEditing}
      handleDelete={handleDelete}
      colors={colors}
      t={t}
      name={name}
      setName={setName}
      title={title}
      setTitle={setTitle}
      description={description}
      setDescription={setDescription}
      gender={gender}
      setGender={setGender}
      race={race}
      setRace={setRace}
      subrace={subrace}
      setSubrace={setSubrace}
      personality={personality}
      setPersonality={setPersonality}
      motivation={motivation}
      setMotivation={setMotivation}
      qualities={qualities}
      setQualities={setQualities}
      weaknesses={weaknesses}
      setWeaknesses={setWeaknesses}
      biography={biography}
      setBiography={setBiography}
      plannedTimeline={plannedTimeline}
      setPlannedTimeline={setPlannedTimeline}
      isFavorite={isFavorite}
      setIsFavorite={setIsFavorite}
      extraNotes={extraNotes}
      setExtraNotes={setExtraNotes}
      commonInputStyles={commonInputStyles}
      selectedStory={selectedStory}
      customFields={customFields}
      customValues={customValues}
      setCustomValues={setCustomValues}
      styles={styles}
      availableTags={availableTags}
      selectedTagIds={selectedTagIds}
      handleTagSelectionChange={handleTagSelectionChange}
      currentCharacterId={currentCharacterId}
      characterModes={characterModes}
      modeService={modeService}
      userId={userId}
      statData={statData}
      statRelationService={statRelationService}
      characterRelations={characterRelations}
      allCharacters={allCharacters}
      handleSaveRelation={handleSaveRelation}
      handleDeleteRelation={handleDeleteRelation}
      characterNoteRelations={characterNoteRelations}
      allNotes={allNotes}
      saveNoteRelation={saveNoteRelation}
      deleteNoteRelation={deleteNoteRelation}
      seeAlsoManagerRef={seeAlsoManagerRef}
    />
  );
};

export default CharacterFormScreen;
