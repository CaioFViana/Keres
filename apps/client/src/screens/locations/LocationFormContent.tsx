import Button from '@/src/components/common/controls/Button/Button';
import CustomAttributeFields from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import FormField from '@/src/components/common/forms/FormField/FormField';
import FormSwitchField from '@/src/components/common/forms/FormSwitchField/FormSwitchField';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import NoteManager from '@/src/components/features/notes/NoteManager';
import LocationRelationManager from '@/src/components/features/relations/LocationRelationManager/LocationRelationManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import React from 'react';
import { View } from 'react-native';

export const LocationFormContent = (props: any) => {
  const {
    allLocationRelations,
    allLocations,
    allNotes,
    availableTags,
    colors,
    commonInputStyles,
    copy,
    currentLocationId,
    customFields,
    customValues,
    deleteNoteRelation,
    deleting,
    description,
    extraNotes,
    handleAddChild,
    handleAddConnection,
    handleDelete,
    handleRemoveLocationRelation,
    handleSave,
    handleSetParent,
    handleTagSelectionChange,
    isEditing,
    isFavorite,
    locationNoteRelations,
    name,
    pendingLocationRelations,
    politics,
    saving,
    seeAlsoManagerRef,
    selectedStory,
    selectedTagIds,
    setClimate,
    setCulture,
    setCustomValues,
    setDescription,
    setExtraNotes,
    setIsFavorite,
    setName,
    setPolitics,
    styles,
    t,
    climate,
    culture,
    saveNoteRelation,
  } = props;

  return (
    <EntityFormContainer
      title={props.formTitle}
      description={props.formDescription}
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
      <FormField label={t('field_climate')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('climate_placeholder')}
            value={climate || ''}
            onChangeText={setClimate}
            style={commonInputStyles.input}
          />
        )}
      </FormField>
      <FormField label={t('field_culture')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('culture_placeholder')}
            value={culture || ''}
            onChangeText={setCulture}
            style={commonInputStyles.input}
          />
        )}
      </FormField>
      <FormField label={t('field_politics')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('politics_placeholder')}
            value={politics || ''}
            onChangeText={setPolitics}
            style={commonInputStyles.input}
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
        onChange={(fieldId, value) =>
          setCustomValues((previous: any) => ({ ...previous, [fieldId]: value }))
        }
      />
      <View style={styles.tagSection}>
        <MultiSelectPill
          options={availableTags.map((tag: any) => ({
            label: tag.name,
            value: tag.id,
            color: tag.color || colors.primaryContainer,
          }))}
          selectedValues={selectedTagIds}
          onSelectionChange={handleTagSelectionChange}
          placeholder={t('select_tags_for_location')}
          label={t('location_tags')}
        />
      </View>
      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <NoteManager
            noteRelations={locationNoteRelations}
            availableNotes={allNotes}
            onSave={saveNoteRelation}
            onDelete={deleteNoteRelation}
            editable
            currentStoryId={selectedStory.id}
            currentEntityId={currentLocationId ?? ''}
            currentEntityType="Location"
          />
        </View>
      )}
      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <LocationRelationManager
            currentLocationId={currentLocationId ?? ''}
            allLocations={allLocations}
            allLocationRelations={
              currentLocationId ? allLocationRelations : pendingLocationRelations
            }
            onSetParent={handleSetParent}
            onAddChild={handleAddChild}
            onAddConnection={handleAddConnection}
            onRemoveRelation={handleRemoveLocationRelation}
            editable
          />
        </View>
      )}
      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <SeeAlsoManager
            ref={seeAlsoManagerRef}
            storyId={selectedStory.id}
            entityType="Location"
            entityId={currentLocationId ?? ''}
            editable
          />
        </View>
      )}
    </EntityFormContainer>
  );
};
