import Button from '@/src/components/common/controls/Button/Button';
import CustomAttributeFields, {
  type CustomAttributeValues,
} from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import FormField from '@/src/components/common/forms/FormField/FormField';
import FormSwitchField from '@/src/components/common/forms/FormSwitchField/FormSwitchField';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import NoteManager from '@/src/components/features/notes/NoteManager';
import LocationRelationManager from '@/src/components/features/relations/LocationRelationManager/LocationRelationManager';
import SeeAlsoManager, {
  type SeeAlsoManagerHandle,
} from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import type { Note, NoteRelation } from '@keres/shared/entities/Note';
import type { TFunction } from 'i18next';
import React, { type Dispatch, type RefObject, type SetStateAction } from 'react';
import { type StyleProp, type TextStyle, View, type ViewStyle } from 'react-native';
import type {
  LocationRelationSelect,
  LocationSelect,
  StorySchemaFieldSelect,
  TagSelect,
} from '../../db/schema';
import type { SaveNoteRelation } from '../../services/storymanagement/NoteRelationService';

type LocationFormCopy = {
  saveLabel: string;
  deleteLabel: string;
  formDescription?: string;
};

export type LocationFormContentProps = {
  formTitle: string;
  formDescription?: string;
  copy: LocationFormCopy;
  handleSave: () => void;
  saving: boolean;
  deleting: boolean;
  isEditing: boolean;
  handleDelete: () => void;
  colors: { error: string; primaryContainer: string };
  t: TFunction;
  name: string;
  setName: (value: string) => void;
  description: string | null;
  setDescription: (value: string) => void;
  climate: string | null;
  setClimate: (value: string) => void;
  culture: string | null;
  setCulture: (value: string) => void;
  politics: string | null;
  setPolitics: (value: string) => void;
  isFavorite: boolean;
  setIsFavorite: (value: boolean) => void;
  extraNotes: string | null;
  setExtraNotes: (value: string) => void;
  commonInputStyles: { input: StyleProp<TextStyle>; multiline: StyleProp<TextStyle> };
  selectedStory: { id: string } | null | undefined;
  customFields: StorySchemaFieldSelect[];
  customValues: CustomAttributeValues;
  setCustomValues: Dispatch<SetStateAction<CustomAttributeValues>>;
  styles: { tagSection: StyleProp<ViewStyle>; noteSection: StyleProp<ViewStyle> };
  availableTags: TagSelect[];
  selectedTagIds: string[];
  handleTagSelectionChange: (tagIds: string[]) => void;
  currentLocationId: string | undefined;
  locationNoteRelations: NoteRelation[];
  allNotes: Note[];
  saveNoteRelation: (relation: SaveNoteRelation) => Promise<void>;
  deleteNoteRelation: (relationId: string) => Promise<void>;
  allLocations: LocationSelect[];
  allLocationRelations: LocationRelationSelect[];
  handleSetParent: (newParentId: string | null) => void | Promise<void>;
  handleAddChild: (childId: string) => void | Promise<void>;
  handleAddConnection: (otherLocationId: string) => void | Promise<void>;
  handleRemoveLocationRelation: (relationId: string) => void | Promise<void>;
  seeAlsoManagerRef: RefObject<SeeAlsoManagerHandle | null>;
};

export const LocationFormContent = (props: LocationFormContentProps) => {
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
    formDescription,
    formTitle,
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
      title={formTitle}
      description={formDescription}
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
          setCustomValues((previous) => ({ ...previous, [fieldId]: value }))
        }
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
          placeholder={t('select_tags_for_location')}
          label={t('location_tags')}
        />
      </View>
      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <NoteManager
            noteRelations={locationNoteRelations}
            availableNotes={allNotes}
            onSave={async (relation) => {
              await saveNoteRelation(relation);
            }}
            onDelete={async (relationId) => {
              await deleteNoteRelation(relationId);
            }}
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
            allLocationRelations={allLocationRelations}
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
