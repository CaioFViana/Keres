import Button from '@/src/components/common/controls/Button/Button';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import CustomAttributeDetailFields from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields';
import CharacterSceneManager from '@/src/components/features/characters/CharacterManager/CharacterSceneManager';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import FavoritedByList from '@/src/components/features/favorites/FavoritedByList/FavoritedByList';
import EntityGalleryManager from '@/src/components/features/gallery/GalleryManager/EntityGalleryManager';
import EntityMetadata from '@/src/components/features/mentions/EntityMetadataWithBacklinks';
import ItemCharacterManager from '@/src/components/features/items/ItemManager/ItemCharacterManager';
import NoteManager from '@/src/components/features/notes/NoteManager';
import CharacterRelationManager from '@/src/components/features/relations/CharacterRelationManager/CharacterRelationManager';
import AppearsInArcsSection from '@/src/components/features/arcs/AppearsInArcsSection';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import ScenePresenceList from '@/src/components/features/scenes/ScenePresenceList/ScenePresenceList';
import { CharacterStatPanel } from '@/src/components/features/stats/CharacterStatPanel/CharacterStatPanel';
import { ModeManager } from '@/src/components/features/stats/ModeManager/ModeManager';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import TagList from '@/src/components/common/display/TagList/TagList';
import React from 'react';
import { Text } from 'react-native';
import type { StatNotation } from '@keres/shared/graphs/statLadder';

export function CharacterDetailContent(props: any) {
  const {
    character,
    navigation,
    t,
    characterTags,
    styles,
    commentField,
    characterId,
    openGalleryMediaViewer,
    canEdit,
    statSystemEnabled,
    statData,
    selectedStory,
    characterModes,
    noopModeWrite,
    characterRelations,
    allCharacters,
    handleSaveRelation,
    handleDeleteRelation,
    characterSceneRelations,
    allScenes,
    handleSaveCharacterScene,
    handleDeleteCharacterScene,
    allItems,
    allItemJourneys,
    characterLocationEntries,
    locationCopy,
    sceneCopy,
    characterNoteRelations,
    allNotes,
    saveNoteRelation,
    deleteNoteRelation,
    appearingArcs,
  } = props;
  return (
    <DetailContainer
      title={character.name}
      footer={
        <>
          <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
        </>
      }
    >
      <TagList tags={characterTags} variant="chip" emptyMessage={t('no_tags_found')} />

      {character.title && <Text style={styles.subTitle}>{character.title}</Text>}

      <CommentableDetailField
        {...commentField('gender', character.gender || t('common_na'))}
        label={t('gender')}
      />
      <CommentableDetailField
        {...commentField('race', character.race || t('common_na'))}
        label={t('race')}
      />
      {character.subrace && (
        <CommentableDetailField
          {...commentField('subrace', character.subrace)}
          label={t('subrace')}
        />
      )}
      <CommentableDetailField
        {...commentField('description', character.description || t('common_na'))}
        label={t('description')}
      />
      <CommentableDetailField
        {...commentField('personality', character.personality || t('common_na'))}
        label={t('personality')}
      />
      <CommentableDetailField
        {...commentField('motivation', character.motivation || t('common_na'))}
        label={t('motivation')}
      />
      <CommentableDetailField
        {...commentField('qualities', character.qualities || t('common_na'))}
        label={t('qualities')}
      />
      <CommentableDetailField
        {...commentField('weaknesses', character.weaknesses || t('common_na'))}
        label={t('weaknesses')}
      />
      <CommentableDetailField
        {...commentField('biography', character.biography || t('common_na'))}
        label={t('biography')}
      />
      <CommentableDetailField
        {...commentField('plannedTimeline', character.plannedTimeline || t('common_na'))}
        label={t('planned_timeline')}
      />

      <CustomAttributeDetailFields
        storyId={character.storyId}
        entityType="Character"
        entityId={characterId}
      />

      <DetailField
        label={t('is_favorite')}
        value={character.isFavorite ? t('common_yes') : t('common_no')}
      />
      <CommentableDetailField
        {...commentField('extraNotes', character.extraNotes || t('common_na'))}
        label={t('extra_notes')}
      />

      <ScreenSection title={t('media_section_title')} />
      <EntityGalleryManager
        ownerId={characterId}
        ownerType="Character"
        onPressMedia={openGalleryMediaViewer}
        editable={canEdit}
      />

      {statSystemEnabled ? (
        <>
          <ScreenSection title={t('stats_title')} />
          <CharacterStatPanel
            characterId={characterId}
            characterName={character.name}
            data={statData}
            notation={(selectedStory?.statNotation ?? 'letter') as StatNotation}
            onCompare={(modeId) =>
              navigation.navigate('CustomizationStack', {
                screen: 'StatComparison',
                params: { characterId, modeId: modeId ?? undefined },
              })
            }
          />
        </>
      ) : null}

      <ModeManager
        modes={characterModes}
        editable={false}
        onCreate={noopModeWrite}
        onUpdate={noopModeWrite}
        onDelete={noopModeWrite}
      />

      <CharacterRelationManager
        characterRelations={characterRelations}
        characters={allCharacters}
        onSave={handleSaveRelation}
        onDelete={handleDeleteRelation}
        editable={false}
        currentStoryId={character.storyId}
        currentCharacterId={characterId}
      />

      <CharacterSceneManager
        characterSceneRelations={characterSceneRelations}
        availableScenes={allScenes}
        onSave={handleSaveCharacterScene}
        onDelete={handleDeleteCharacterScene}
        currentStoryId={character.storyId}
        currentCharacterId={characterId}
        editable={false}
      />

      <ItemCharacterManager
        allItems={allItems}
        allItemJourneys={allItemJourneys}
        allScenes={allScenes}
        currentCharacterId={characterId}
      />

      <ScenePresenceList
        entries={characterLocationEntries}
        title={locationCopy.entities}
        noItemsMessage="no_locations_assigned_to_character"
        entityType="Location"
        sceneLabel={sceneCopy.entity}
      />

      <NoteManager
        noteRelations={characterNoteRelations}
        availableNotes={allNotes}
        onSave={saveNoteRelation}
        onDelete={deleteNoteRelation}
        editable={false}
        currentStoryId={character.storyId}
        currentEntityId={characterId}
        currentEntityType="Character"
      />

      <AppearsInArcsSection arcs={appearingArcs} />

      <SeeAlsoManager
        storyId={character.storyId}
        entityType="Character"
        entityId={characterId}
        editable={false}
      />

      <FavoritedByList storyId={character.storyId} entityId={characterId} entityType="Character" />

      <EntityMetadata
        version={character.version}
        createdAt={character.createdAt}
        updatedAt={character.updatedAt}
        entityType="Character"
        entityId={character.id}
      />
    </DetailContainer>
  );
}
