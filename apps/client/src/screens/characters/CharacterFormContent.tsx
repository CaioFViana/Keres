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
import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import SuggestionTextInput from '@/src/components/common/inputs/SuggestionTextInput/SuggestionTextInput';
import CharacterRelationManager from '@/src/components/features/relations/CharacterRelationManager/CharacterRelationManager';
import { CharacterStatValuesEditor } from '@/src/components/features/stats/CharacterStatValuesEditor/CharacterStatValuesEditor';
import { ModeManager } from '@/src/components/features/stats/ModeManager/ModeManager';
import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import type { CharacterRelation } from '@keres/shared/entities/CharacterRelation';
import type { Note, NoteRelation } from '@keres/shared/entities/Note';
import type { TFunction } from 'i18next';
import { type Dispatch, type RefObject, type SetStateAction } from 'react';
import { type StyleProp, type TextStyle, View, type ViewStyle } from 'react-native';
import type { CharacterSelect } from '../../db/schemas/characters';
import type { ModeSelect } from '../../db/schemas/modes';
import type { StorySchemaFieldSelect, TagSelect } from '../../db/schema';
import type { StoryStatsData } from '../../hooks/useStoryStats';
import type { ModeService } from '../../services/storymanagement/ModeService';
import type { SaveNoteRelation } from '../../services/storymanagement/NoteRelationService';
import type { StatRelationService } from '../../services/storymanagement/StatRelationService';

type CharacterFormCopy = {
  saveLabel: string;
  deleteLabel: string;
  formDescription?: string;
};

export type CharacterFormContentProps = {
  formTitle: string;
  formDescription?: string;
  copy: CharacterFormCopy;
  handleSave: () => void;
  saving: boolean;
  deleting: boolean;
  isEditing: boolean;
  handleDelete: () => void;
  colors: { error: string; primaryContainer: string };
  t: TFunction;
  name: string;
  setName: (value: string) => void;
  title: string | null;
  setTitle: (value: string) => void;
  description: string | null;
  setDescription: (value: string) => void;
  gender: string | null;
  setGender: (value: string) => void;
  race: string | null;
  setRace: (value: string) => void;
  subrace: string | null;
  setSubrace: (value: string) => void;
  personality: string | null;
  setPersonality: (value: string) => void;
  motivation: string | null;
  setMotivation: (value: string) => void;
  qualities: string | null;
  setQualities: (value: string) => void;
  weaknesses: string | null;
  setWeaknesses: (value: string) => void;
  biography: string | null;
  setBiography: (value: string) => void;
  plannedTimeline: string | null;
  setPlannedTimeline: (value: string) => void;
  isFavorite: boolean;
  setIsFavorite: (value: boolean) => void;
  extraNotes: string | null;
  setExtraNotes: (value: string) => void;
  commonInputStyles: { input: StyleProp<TextStyle>; multiline: StyleProp<TextStyle> };
  selectedStory: { id: string; statSystem?: boolean | null } | null | undefined;
  customFields: StorySchemaFieldSelect[];
  customValues: CustomAttributeValues;
  setCustomValues: Dispatch<SetStateAction<CustomAttributeValues>>;
  styles: { tagSection: StyleProp<ViewStyle>; noteSection: StyleProp<ViewStyle> };
  availableTags: TagSelect[];
  selectedTagIds: string[];
  handleTagSelectionChange: (tagIds: string[]) => void;
  currentCharacterId: string | undefined;
  characterModes: ModeSelect[];
  modeService: () => ModeService;
  userId: string | null | undefined;
  statData: StoryStatsData;
  statRelationService: () => StatRelationService;
  characterRelations: CharacterRelation[];
  allCharacters: CharacterSelect[];
  handleSaveRelation: (relation: CharacterRelation) => void | Promise<void>;
  handleDeleteRelation: (relationId: string) => void | Promise<void>;
  characterNoteRelations: NoteRelation[];
  allNotes: Note[];
  saveNoteRelation: (relation: SaveNoteRelation) => Promise<void>;
  deleteNoteRelation: (relationId: string) => Promise<void>;
  seeAlsoManagerRef: RefObject<SeeAlsoManagerHandle | null>;
};

export function CharacterFormContent(props: CharacterFormContentProps) {
  const {
    formTitle,
    formDescription,
    copy,
    handleSave,
    saving,
    deleting,
    isEditing,
    handleDelete,
    colors,
    t,
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
    commonInputStyles,
    selectedStory,
    customFields,
    customValues,
    setCustomValues,
    styles,
    availableTags,
    selectedTagIds,
    handleTagSelectionChange,
    currentCharacterId,
    characterModes,
    modeService,
    userId,
    statData,
    statRelationService,
    characterRelations,
    allCharacters,
    handleSaveRelation,
    handleDeleteRelation,
    characterNoteRelations,
    allNotes,
    saveNoteRelation,
    deleteNoteRelation,
    seeAlsoManagerRef,
  } = props;
  return (
    <EntityFormContainer
      title={formTitle}
      description={formDescription}
      actions={
        <EntityFormActions
          isEditing={isEditing}
          busy={saving || deleting}
          colors={colors}
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

      <FormTextField
        label={t('title')}
        placeholder={t('character_title_placeholder')}
        value={title}
        onChangeText={setTitle}
        style={commonInputStyles.input}
      />

      <FormTextAreaField
        label={t('description')}
        placeholder={t('description_placeholder')}
        value={description}
        onChangeText={setDescription}
        style={commonInputStyles.multiline}
      />

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

      <FormTextAreaField
        label={t('personality')}
        placeholder={t('personality_placeholder')}
        value={personality}
        onChangeText={setPersonality}
        style={commonInputStyles.multiline}
      />

      <FormTextAreaField
        label={t('motivation')}
        placeholder={t('motivation_placeholder')}
        value={motivation}
        onChangeText={setMotivation}
        style={commonInputStyles.multiline}
      />

      <FormTextAreaField
        label={t('qualities')}
        placeholder={t('qualities_placeholder')}
        value={qualities}
        onChangeText={setQualities}
        style={commonInputStyles.multiline}
      />

      <FormTextAreaField
        label={t('weaknesses')}
        placeholder={t('weaknesses_placeholder')}
        value={weaknesses}
        onChangeText={setWeaknesses}
        style={commonInputStyles.multiline}
      />

      <FormTextAreaField
        label={t('biography')}
        placeholder={t('biography_placeholder')}
        value={biography}
        onChangeText={setBiography}
        style={commonInputStyles.multiline}
      />

      <FormTextAreaField
        label={t('planned_timeline')}
        placeholder={t('planned_timeline_placeholder')}
        value={plannedTimeline}
        onChangeText={setPlannedTimeline}
        style={commonInputStyles.multiline}
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
          placeholder={t('select_tags_for_character')}
          label={t('character_tags')}
          defaultColor={colors.primaryContainer}
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
            characterRelations={characterRelations}
            characters={allCharacters}
            onSave={handleSaveRelation}
            onDelete={handleDeleteRelation}
            editable={true}
            currentStoryId={selectedStory.id}
            currentCharacterId={currentCharacterId ?? ''}
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <EntityNotesManager
            noteRelations={characterNoteRelations}
            availableNotes={allNotes}
            onSave={async (relation) => {
              await saveNoteRelation(relation);
            }}
            onDelete={async (relationId) => {
              await deleteNoteRelation(relationId);
            }}
            target={{
              storyId: selectedStory.id,
              entityType: 'Character',
              entityId: currentCharacterId ?? '',
            }}
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <EntitySeeAlsoManager
            managerRef={seeAlsoManagerRef}
            target={{
              storyId: selectedStory.id,
              entityType: 'Character',
              entityId: currentCharacterId ?? '',
            }}
          />
        </View>
      )}
    </EntityFormContainer>
  );
}
