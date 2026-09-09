import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { useStorySchemaFields } from '../../hooks/useStorySchemaFields';
import type { CharacterStackParamList } from '../../navigation/MainSystemStack';
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
  const { colors } = useTheme();
  const navigation = useNavigation<CharacterFormScreenNavigationProp>();
  const route = useRoute<CharacterFormScreenRouteProp>();
  const { characterId: initialCharacterId } = route.params || {};
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Character');
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();
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
    currentCharacterId,
    storyId: selectedStory?.id,
    userId,
    drizzleDb,
    characterServiceRef,
    characterRelationServiceRef,
  });

  const { deleting, handleDelete, handleSave, saving, seeAlsoManagerRef } = useCharacterFormActions({
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
  });

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
      pendingCharacterRelations={pendingCharacterRelations}
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
