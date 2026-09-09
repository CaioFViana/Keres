import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useStorySchemaFields } from '../../hooks/useStorySchemaFields';
import type { LocationStackParamList } from '../../navigation/MainSystemStack';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { useVocabularyEntityCopy } from '../../vocabulary/useVocabularyEntityCopy';
import { LocationFormContent } from './LocationFormContent';
import { useLocationFormActions } from './useLocationFormActions';
import { useLocationFormAssociations } from './useLocationFormAssociations';
import { useLocationFormResources } from './useLocationFormResources';
import { useLocationFormState } from './useLocationFormState';

type LocationFormScreenRouteProp = RouteProp<LocationStackParamList, 'LocationForm'>;
type LocationFormScreenNavigationProp = NativeStackNavigationProp<
  LocationStackParamList,
  'LocationForm'
>;

const styles = StyleSheet.create({
  tagSection: {
    marginTop: 20,
    marginBottom: 0,
  },
  noteSection: {
    marginTop: 20,
    marginBottom: -10,
  },
});

const LocationFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<LocationFormScreenNavigationProp>();
  const route = useRoute<LocationFormScreenRouteProp>();
  const { locationId: initialLocationId } = route.params || {};
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Location');
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();
  const commonInputStyles = getCommonInputStyles(colors);
  const customFields = useStorySchemaFields(selectedStory?.id, 'Location');

  const { drizzleDb, locationServiceRef, locationRelationServiceRef } = useLocationFormResources();

  const locationFormState = useLocationFormState({
    initialLocationId,
    storyId: selectedStory?.id,
    drizzleDb,
    locationServiceRef,
    customFields,
  });
  const {
    currentLocationId,
    name,
    setName,
    description,
    setDescription,
    climate,
    setClimate,
    culture,
    setCulture,
    politics,
    setPolitics,
    isFavorite,
    setIsFavorite,
    extraNotes,
    setExtraNotes,
    customValues,
    setCustomValues,
    loading,
    isEditing,
  } = locationFormState;

  const {
    availableTags,
    selectedTagIds,
    allNotes,
    locationNoteRelations,
    persistTagRelations,
    saveNoteRelation,
    deleteNoteRelation,
    persistNoteRelations,
    handleTagSelectionChange,
    allLocations,
    allLocationRelations,
    pendingLocationRelations,
    handleSetParent,
    handleAddChild,
    handleAddConnection,
    handleRemoveLocationRelation,
    persistPendingLocationRelations,
  } = useLocationFormAssociations({
    currentLocationId,
    storyId: selectedStory?.id,
    userId,
    locationServiceRef,
    locationRelationServiceRef,
  });

  const { deleting, handleDelete, handleSave, saving, seeAlsoManagerRef } = useLocationFormActions({
    state: locationFormState,
    customFields,
    drizzleDb,
    locationServiceRef,
    navigation,
    storyId: selectedStory?.id,
    userId,
    persistTagRelations,
    persistNoteRelations,
    persistPendingLocationRelations,
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
    <LocationFormContent
      allLocationRelations={allLocationRelations}
      allLocations={allLocations}
      allNotes={allNotes}
      availableTags={availableTags}
      climate={climate}
      colors={colors}
      commonInputStyles={commonInputStyles}
      copy={copy}
      culture={culture}
      currentLocationId={currentLocationId}
      customFields={customFields}
      customValues={customValues}
      deleteNoteRelation={deleteNoteRelation}
      deleting={deleting}
      description={description}
      extraNotes={extraNotes}
      formDescription={copy.formDescription}
      formTitle={formTitle}
      handleAddChild={handleAddChild}
      handleAddConnection={handleAddConnection}
      handleDelete={handleDelete}
      handleRemoveLocationRelation={handleRemoveLocationRelation}
      handleSave={handleSave}
      handleSetParent={handleSetParent}
      handleTagSelectionChange={handleTagSelectionChange}
      isEditing={isEditing}
      isFavorite={isFavorite}
      locationNoteRelations={locationNoteRelations}
      name={name}
      pendingLocationRelations={pendingLocationRelations}
      politics={politics}
      saving={saving}
      saveNoteRelation={saveNoteRelation}
      seeAlsoManagerRef={seeAlsoManagerRef}
      selectedStory={selectedStory}
      selectedTagIds={selectedTagIds}
      setClimate={setClimate}
      setCulture={setCulture}
      setCustomValues={setCustomValues}
      setDescription={setDescription}
      setExtraNotes={setExtraNotes}
      setIsFavorite={setIsFavorite}
      setName={setName}
      setPolitics={setPolitics}
      styles={styles}
      t={t}
    />
  );
};

export default LocationFormScreen;
