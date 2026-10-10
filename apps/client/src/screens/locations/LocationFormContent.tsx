import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import EntityFormActions from '@/src/components/common/forms/EntityFormActions/EntityFormActions';
import EntityCustomAttributeFields from '@/src/components/common/forms/CustomAttributeFields/EntityCustomAttributeFields';
import EntitySeeAlsoManager from '@/src/components/features/seealso/EntitySeeAlsoManager/EntitySeeAlsoManager';
import EntityNotesManager from '@/src/components/features/notes/EntityNotesManager/EntityNotesManager';
import EntityTagPicker from '@/src/components/features/tags/EntityTagPicker/EntityTagPicker';
import FormTextAreaField from '@/src/components/common/forms/FormTextAreaField/FormTextAreaField';
import FormTextField from '@/src/components/common/forms/FormTextField/FormTextField';
import FormField from '@/src/components/common/forms/FormField/FormField';
import FormSwitchField from '@/src/components/common/forms/FormSwitchField/FormSwitchField';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import LocationRelationManager from '@/src/components/features/relations/LocationRelationManager/LocationRelationManager';
import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { LOCATION_INT_EXT, type LocationIntExt } from '@keres/shared';
import type { Note, NoteRelation } from '@keres/shared/entities/Note';
import type { TFunction } from 'i18next';
import { type Dispatch, type RefObject, type SetStateAction } from 'react';
import { type StyleProp, Text, type TextStyle, View, type ViewStyle } from 'react-native';
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
  colors: { error: string; primaryContainer: string; textSecondary: string };
  t: TFunction;
  name: string;
  setName: (value: string) => void;
  description: string | null;
  setDescription: (value: string) => void;
  intExt: LocationIntExt | null;
  setIntExt: (value: LocationIntExt | null) => void;
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
    intExt,
    setIntExt,
    saveNoteRelation,
  } = props;

  return (
    <EntityFormContainer
      title={formTitle}
      description={formDescription}
      actions={
        <EntityFormActions
          isEditing={isEditing}
          busy={saving || deleting}
          deleteLabel={copy.deleteLabel}
          saveLabel={copy.saveLabel}
          onDelete={handleDelete}
          onSave={handleSave}
        />
      }
    >
      <FormTextField
        label={t('name')}
        placeholder={t('name_placeholder')}
        value={name}
        onChangeText={setName}
        style={commonInputStyles.input}
      />
      <FormTextAreaField
        label={t('description')}
        placeholder={t('description_placeholder')}
        value={description}
        onChangeText={setDescription}
        style={commonInputStyles.multiline}
      />
      <FormField label={t('field_intExt')}>
        <SingleSelectPill
          options={LOCATION_INT_EXT.map((value) => ({
            label: t(`int_ext_${value}`),
            value,
          }))}
          value={intExt}
          onValueChange={(value) => setIntExt((value as LocationIntExt | null) ?? null)}
          placeholder={t('int_ext_placeholder')}
          allowDeselect
        />
        <Text style={{ color: props.colors.textSecondary }}>{t('int_ext_hint')}</Text>
      </FormField>
      <FormTextField
        label={t('field_climate')}
        placeholder={t('climate_placeholder')}
        value={climate}
        onChangeText={setClimate}
        style={commonInputStyles.input}
      />
      <FormTextField
        label={t('field_culture')}
        placeholder={t('culture_placeholder')}
        value={culture}
        onChangeText={setCulture}
        style={commonInputStyles.input}
      />
      <FormTextField
        label={t('field_politics')}
        placeholder={t('politics_placeholder')}
        value={politics}
        onChangeText={setPolitics}
        style={commonInputStyles.input}
      />
      <FormSwitchField label={t('is_favorite')} value={isFavorite} onValueChange={setIsFavorite} />
      <FormTextAreaField
        label={t('extra_notes')}
        placeholder={t('extra_notes_placeholder')}
        value={extraNotes}
        onChangeText={setExtraNotes}
        style={commonInputStyles.multiline}
      />
      <EntityCustomAttributeFields
        storyId={selectedStory?.id || ''}
        fields={customFields}
        values={customValues}
        setValues={setCustomValues}
      />
      <View style={styles.tagSection}>
        <EntityTagPicker
          tags={availableTags}
          selectedTagIds={selectedTagIds}
          onSelectionChange={handleTagSelectionChange}
          placeholder={t('select_tags_for_location')}
          label={t('location_tags')}
          defaultColor={colors.primaryContainer}
        />
      </View>
      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <EntityNotesManager
            noteRelations={locationNoteRelations}
            availableNotes={allNotes}
            onSave={async (relation) => {
              await saveNoteRelation(relation);
            }}
            onDelete={async (relationId) => {
              await deleteNoteRelation(relationId);
            }}
            target={{
              storyId: selectedStory.id,
              entityType: 'Location',
              entityId: currentLocationId ?? '',
            }}
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
          <EntitySeeAlsoManager
            managerRef={seeAlsoManagerRef}
            target={{
              storyId: selectedStory.id,
              entityType: 'Location',
              entityId: currentLocationId ?? '',
            }}
          />
        </View>
      )}
    </EntityFormContainer>
  );
};
