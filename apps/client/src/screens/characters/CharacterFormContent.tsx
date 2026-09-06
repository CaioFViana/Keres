import Button from '@/src/components/common/controls/Button/Button';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import FormField from '@/src/components/common/forms/FormField/FormField';
import FormSwitchField from '@/src/components/common/forms/FormSwitchField/FormSwitchField';
import CustomAttributeFields from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import SuggestionTextInput from '@/src/components/common/inputs/SuggestionTextInput/SuggestionTextInput';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import NoteManager from '@/src/components/features/notes/NoteManager';
import CharacterRelationManager from '@/src/components/features/relations/CharacterRelationManager/CharacterRelationManager';
import { CharacterStatValuesEditor } from '@/src/components/features/stats/CharacterStatValuesEditor/CharacterStatValuesEditor';
import { ModeManager } from '@/src/components/features/stats/ModeManager/ModeManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import React from 'react';
import { View } from 'react-native';

export function CharacterFormContent(props: any) {
  const {
    formTitle,
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
    pendingCharacterRelations,
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
        onChange={(fieldId, value) =>
          setCustomValues((prev: any) => ({ ...prev, [fieldId]: value }))
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
                order: Math.max(0, ...characterModes.map((existing: any) => existing.order + 1)),
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
}
